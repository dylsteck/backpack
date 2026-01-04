import { Elysia } from "elysia";
import Anthropic from "@anthropic-ai/sdk";
import { tools } from "../tools";

// Default model (latest Claude)
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

// Convert Vercel AI SDK tools to Anthropic format
function convertToolsToAnthropicFormat(): Anthropic.Tool[] {
	return Object.entries(tools).map(([name, toolDef]) => {
		// AI SDK wraps schemas - we need to extract the actual schema
		// For now, we'll manually construct schemas for each tool
		let inputSchema: Anthropic.Tool.InputSchema;

		if (name === 'searchItems') {
			inputSchema = {
				type: "object",
				properties: {
					query: { type: "string", description: "Text to search for in item content" },
					source: { type: "string", enum: ["farcaster", "teller"], description: "Filter by source: 'farcaster' for social posts, 'teller' for transactions" },
					type: { type: "string", enum: ["cast", "transaction"], description: "Filter by type" },
					limit: { type: "number", description: "Maximum number of items to return", default: 5 }
				}
			};
		} else if (name === 'obsidian_list_notes') {
			inputSchema = {
				type: "object",
				properties: {
					limit: { type: "number", description: "Maximum number of notes to return", default: 20 },
					search: { type: "string", description: "Optional search query to filter notes by title or content" }
				}
			};
		} else if (name === 'obsidian_read_note') {
			inputSchema = {
				type: "object",
				properties: {
					notePath: { type: "string", description: "The full path to the note file, or just the note title" }
				},
				required: ["notePath"]
			};
		} else if (name === 'obsidian_create_note') {
			inputSchema = {
				type: "object",
				properties: {
					title: { type: "string", description: "The title/filename for the new note (without .md extension)" },
					content: { type: "string", description: "The content of the note in Markdown format" },
					tags: { type: "array", items: { type: "string" }, description: "Optional array of tags to add to the note frontmatter" },
					folder: { type: "string", description: "Optional subfolder within the vault to create the note in" }
				},
				required: ["title", "content"]
			};
		} else if (name === 'obsidian_update_note') {
			inputSchema = {
				type: "object",
				properties: {
					notePath: { type: "string", description: "The path or title of the note to update" },
					content: { type: "string", description: "The content to add or replace" },
					mode: { type: "string", enum: ["append", "prepend", "replace"], description: "How to update: append (add to end), prepend (add to start), or replace (overwrite)", default: "append" }
				},
				required: ["notePath", "content"]
			};
		} else if (name === 'obsidian_add_backlink') {
			inputSchema = {
				type: "object",
				properties: {
					notePath: { type: "string", description: "The path or title of the note to add the backlink to" },
					targetNote: { type: "string", description: "The title of the note to link to" },
					context: { type: "string", description: "Optional context text to add around the link" }
				},
				required: ["notePath", "targetNote"]
			};
		} else if (name === 'obsidian_search') {
			inputSchema = {
				type: "object",
				properties: {
					query: { type: "string", description: "The search query" },
					searchIn: { type: "string", enum: ["all", "titles", "content", "tags"], description: "Where to search: all, titles, content, or tags", default: "all" },
					limit: { type: "number", description: "Maximum results to return", default: 10 }
				},
				required: ["query"]
			};
		} else {
			// Fallback for unknown tools
			inputSchema = { type: "object", properties: {} };
		}

		return {
			name,
			description: toolDef.description || `Tool: ${name}`,
			input_schema: inputSchema,
		};
	});
}

// Execute tool by name with input
async function executeTool(toolName: string, input: unknown) {
	const toolDef = tools[toolName as keyof typeof tools];
	if (!toolDef || !toolDef.execute) {
		throw new Error(`Unknown tool: ${toolName}`);
	}
	// Call the tool's execute function with input
	// We need to pass the tool execution context as second parameter
	// Type assertion needed because AI SDK tool signatures are complex
	const execute = toolDef.execute as (input: unknown, context?: unknown) => Promise<unknown>;
	const result = await execute(input, {
		toolCallId: `tool_${Date.now()}`,
		messages: [],
		abortSignal: new AbortController().signal
	});
	return result;
}

export const anthropicRoutes = new Elysia({ prefix: "/api/chat/anthropic" })
	.post("/", async ({ request }) => {
		try {
			// Get API key from Authorization header
			const authHeader = request.headers.get("Authorization");
			if (!authHeader?.startsWith("Bearer ")) {
				return new Response(
					JSON.stringify({ error: "Missing or invalid Authorization header" }),
					{ status: 401, headers: { "Content-Type": "application/json" } }
				);
			}
			const apiKey = authHeader.slice(7);

			// Parse request body
			const body = (await request.json()) as {
				messages?: Array<{ role: string; content: string }>;
				model?: string;
			};
			const { messages, model } = body;

			if (!messages || !Array.isArray(messages)) {
				return new Response(
					JSON.stringify({ error: "Invalid request: messages array required" }),
					{ status: 400, headers: { "Content-Type": "application/json" } }
				);
			}

			// Create Anthropic client with user's API key
			const client = new Anthropic({ apiKey });

			// Use custom model or default
			const modelId = model || DEFAULT_MODEL;

			// Convert messages to Anthropic format
			// Extract system message if first message is from system
			let systemPrompt: string | undefined;
			const anthropicMessages: Anthropic.MessageParam[] = [];

			for (const msg of messages) {
				if (msg.role === "system") {
					systemPrompt = msg.content;
				} else if (msg.role === "user" || msg.role === "assistant") {
					anthropicMessages.push({
						role: msg.role as "user" | "assistant",
						content: msg.content,
					});
				}
			}

			// Default system prompt for Cortex (with tool instructions)
			const finalSystemPrompt = systemPrompt || `You are Cortex, a helpful AI assistant that can search through the user's saved items including Farcaster posts and bank transactions.
You can also interact with the user's Obsidian vault - listing, reading, creating, and updating markdown notes.

When the user asks about their content, posts, spending, or wants to find something, use the searchItems tool.
When the user asks about their notes or wants to work with Obsidian, use the obsidian_* tools:
- obsidian_list_notes: List all notes in the vault
- obsidian_read_note: Read the full content of a specific note
- obsidian_create_note: Create a new note
- obsidian_update_note: Update an existing note (append, prepend, or replace)
- obsidian_add_backlink: Add [[wikilinks]] to connect notes
- obsidian_search: Search notes by title, content, or tags

After using any tool, provide a helpful summary of what you found or did.
If no results are found, suggest how the user might refine their search or request.`;

			// Get converted tools for Anthropic API
			const anthropicTools = convertToolsToAnthropicFormat();

			// Convert to ReadableStream for frontend compatibility
			const readableStream = new ReadableStream({
				async start(controller) {
					const encoder = new TextEncoder();
					try {
						let currentMessages = [...anthropicMessages];
						let continueLoop = true;
						let maxIterations = 5; // Prevent infinite loops

						while (continueLoop && maxIterations > 0) {
							maxIterations--;

							// Stream response using Anthropic SDK with tools
							const stream = client.messages.stream({
								model: modelId,
								messages: currentMessages,
								max_tokens: 4096,
								system: finalSystemPrompt,
								tools: anthropicTools,
							});

							// Stream events in real-time
							for await (const event of stream) {
								if (event.type === "content_block_start") {
									const block = event.content_block;

									// If it's a tool use, send indicator immediately
									if (block.type === "tool_use") {
										const toolIndicator = `[Using tool: ${block.name}]\n`;
										controller.enqueue(encoder.encode(toolIndicator));
									}
								} else if (event.type === "content_block_delta") {
									const delta = event.delta;

									// Stream text deltas immediately
									if (delta.type === "text_delta") {
										controller.enqueue(encoder.encode(delta.text));
									}
								}
							}

							// Get the final message to check for tool use
							const finalMessage = await stream.finalMessage();

							// Check if Claude used tools
							const toolUseBlocks = finalMessage.content.filter(
								(block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
							);

							if (toolUseBlocks.length > 0) {
								// Execute tools and collect results
								const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

								for (const toolUse of toolUseBlocks) {
									try {
										const result = await executeTool(toolUse.name, toolUse.input);
										toolResults.push({
											type: "tool_result",
											tool_use_id: toolUse.id,
											content: JSON.stringify(result),
										});
									} catch (error: unknown) {
										const errorMessage = error instanceof Error ? error.message : "Unknown error";
										toolResults.push({
											type: "tool_result",
											tool_use_id: toolUse.id,
											content: JSON.stringify({ error: errorMessage }),
											is_error: true,
										});
									}
								}

								// Add assistant's response and tool results to messages
								currentMessages.push({
									role: "assistant",
									content: finalMessage.content,
								});
								currentMessages.push({
									role: "user",
									content: toolResults,
								});

								// Continue the loop to get Claude's response after tool use
							} else {
								// No tool use, we're done
								continueLoop = false;
							}
						}

						controller.close();
					} catch (error) {
						console.error("Anthropic stream error:", error);
						controller.error(error);
					}
				},
			});

			return new Response(readableStream, {
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
					"Transfer-Encoding": "chunked",
				},
			});
		} catch (error) {
			console.error("Anthropic chat error:", error);
			
			// Handle specific Anthropic errors
			if (error instanceof Anthropic.AuthenticationError) {
				return new Response(
					JSON.stringify({ error: "Invalid API key" }),
					{ status: 401, headers: { "Content-Type": "application/json" } }
				);
			}
			
			if (error instanceof Anthropic.RateLimitError) {
				return new Response(
					JSON.stringify({ error: "Rate limit exceeded" }),
					{ status: 429, headers: { "Content-Type": "application/json" } }
				);
			}

			return new Response(
				JSON.stringify({ error: "Failed to process chat request" }),
				{ status: 500, headers: { "Content-Type": "application/json" } }
			);
		}
	});


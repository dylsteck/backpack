import { Elysia } from "elysia";
import Anthropic from "@anthropic-ai/sdk";

// Default model (latest Claude)
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

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
			const anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

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

			// Default system prompt for Cortex
			const finalSystemPrompt = systemPrompt || `You are Cortex, a helpful AI assistant that can search through the user's saved items including Farcaster posts and bank transactions.

When the user asks about their content, posts, spending, or wants to find something, provide helpful summaries and insights.
If no results are found, suggest how the user might refine their search or request.`;

			// Stream response using Anthropic SDK
			const stream = await client.messages.stream({
				model: modelId,
				messages: anthropicMessages,
				max_tokens: 4096,
				system: finalSystemPrompt,
			});

			// Convert to ReadableStream for frontend compatibility
			const readableStream = new ReadableStream({
				async start(controller) {
					const encoder = new TextEncoder();
					try {
						for await (const event of stream) {
							if (event.type === "content_block_delta") {
								const delta = event.delta;
								if ("text" in delta) {
									controller.enqueue(encoder.encode(delta.text));
								}
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


import { Elysia } from "elysia";
import { streamText, type ModelMessage, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { tools } from "../tools";

// Default model that supports tool calling (free tier)
const DEFAULT_MODEL = "mistralai/devstral-2512:free";

export const openrouterRoutes = new Elysia({ prefix: "/api/chat/openrouter" })
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
				messages?: ModelMessage[];
				model?: string;
			};
			const { messages, model } = body;

			if (!messages || !Array.isArray(messages)) {
				return new Response(
					JSON.stringify({ error: "Invalid request: messages array required" }),
					{ status: 400, headers: { "Content-Type": "application/json" } }
				);
			}

			// Create OpenRouter provider with user's API key
			// We try to pass headers here, but also in streamText just in case
			const openrouter = createOpenRouter({
				apiKey,
				headers: {
					"HTTP-Referer": "https://withcortex.com",
					"X-Title": "Cortex",
				},
			});

			// Use custom model or default
			const modelId = model || DEFAULT_MODEL;

			// Stream response with tools
			const result = streamText({
				model: openrouter.chat(modelId),
				messages,
				tools,
				// Allow up to 3 steps for tool execution
				stopWhen: stepCountIs(3),
				// Explicitly pass headers for the request
				headers: {
					"HTTP-Referer": "https://withcortex.com",
					"X-Title": "Cortex",
				},
				// System prompt to guide the assistant
				system: `You are Cortex, a helpful AI assistant that can search through the user's saved items including Farcaster posts and bank transactions.
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
If no results are found, suggest how the user might refine their search or request.`,
			});

			// Stream the text response
			return result.toTextStreamResponse();
		} catch (error) {
			console.error("OpenRouter chat error:", error);
			return new Response(
				JSON.stringify({ error: "Failed to process chat request" }),
				{ status: 500, headers: { "Content-Type": "application/json" } }
			);
		}
	});


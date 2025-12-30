import { Elysia } from "elysia";
import { streamText, type ModelMessage } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

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
			const body = (await request.json()) as { messages?: ModelMessage[] };
			const { messages } = body;

			if (!messages || !Array.isArray(messages)) {
				return new Response(
					JSON.stringify({ error: "Invalid request: messages array required" }),
					{ status: 400, headers: { "Content-Type": "application/json" } }
				);
			}

			// Create OpenRouter provider with user's API key
			const openrouter = createOpenRouter({ apiKey });

			// Stream response using a free model via OpenRouter
			const result = streamText({
				model: openrouter.chat("meta-llama/llama-3.2-3b-instruct:free"),
				messages,
			});

			return result.toTextStreamResponse();
		} catch (error) {
			console.error("OpenRouter chat error:", error);
			return new Response(
				JSON.stringify({ error: "Failed to process chat request" }),
				{ status: 500, headers: { "Content-Type": "application/json" } }
			);
		}
	});


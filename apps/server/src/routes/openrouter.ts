import { Elysia } from "elysia";
import { streamText, type ModelMessage } from "ai";
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
				// Allow up to 10 steps for tool execution (browser workflows need multiple steps)
				// This allows: navigate -> snapshot -> fill/click -> screenshot -> final response
				maxSteps: 10,
				// Explicitly pass headers for the request
				headers: {
					"HTTP-Referer": "https://withcortex.com",
					"X-Title": "Cortex",
				},
				// System prompt to guide the assistant
				system: `You are Cortex, a helpful AI assistant that can search through the user's saved items including Farcaster posts and bank transactions.
You can also interact with the user's Obsidian vault - listing, reading, creating, and updating markdown notes.
You can also control the in-app browser to navigate websites, interact with pages, and extract information.

When the user asks about their content, posts, spending, or wants to find something, use the searchItems tool.
When the user asks about their notes or wants to work with Obsidian, use the obsidian_* tools:
- obsidian_list_notes: List all notes in the vault
- obsidian_read_note: Read the full content of a specific note
- obsidian_create_note: Create a new note
- obsidian_update_note: Update an existing note (append, prepend, or replace)
- obsidian_add_backlink: Add [[wikilinks]] to connect notes
- obsidian_search: Search notes by title, content, or tags

When the user wants to browse the web, visit a website, or interact with web pages, use the browser_* tools:

⚠️ CRITICAL RULE FOR browser_navigate ⚠️
You MUST ALWAYS provide the "url" parameter as a string property in an object. The URL parameter is MANDATORY and cannot be omitted.

CORRECT examples:
- browser_navigate({"url": "withcortex.com"})
- browser_navigate({"url": "https://example.com"})
- browser_navigate({"url": "google.com"})

WRONG examples (these will FAIL):
- browser_navigate() ❌
- browser_navigate({}) ❌
- browser_navigate({"type": "url"}) ❌ (missing url)

Available browser tools:
- browser_navigate: Navigate to a URL. REQUIRED: {"url": "website.com"} - the url property is MANDATORY
- browser_snapshot: Get a snapshot of the current page showing all interactive elements with their uid values
- browser_click: Click on elements. REQUIRED: {"uid": "1_11"} - you MUST get the uid from browser_snapshot first
- browser_fill: Fill in form fields. REQUIRED: {"uid": "1_5", "value": "text to fill"} - get uid from snapshot
- browser_screenshot: Take a screenshot to see the current page
- browser_wait: Wait for content to load after navigation
- browser_evaluate: Run JavaScript to extract data or interact with the page
- browser_network: See network requests made by the page

⚠️ CRITICAL WORKFLOW FOR CLICKING ELEMENTS ⚠️
To click on an element, you MUST follow these steps:
1. First call browser_snapshot to see all elements and their uid values (e.g., uid=1_11)
2. Find the element you want in the snapshot (look for the text like "Base" or "link")
3. Use browser_click with the EXACT uid from the snapshot: browser_click({"uid": "1_11"})

CORRECT example:
- browser_snapshot() → find "uid=1_11 link url=\"https://base.org/\""
- browser_click({"uid": "1_11"}) ✅

WRONG examples:
- browser_click() ❌ (missing uid)
- browser_click({"text": "Base"}) ❌ (must use uid, not text)
- browser_click({"uid": "base"}) ❌ (uid must match snapshot exactly like "1_11")

Workflow for browser tasks:
1. ALWAYS call browser_navigate with {"url": "website.com"} format - the url parameter is MANDATORY
2. Wait for page to load (browser_wait) or take snapshot (browser_snapshot) to see what's available
3. To click: Get snapshot → find uid → call browser_click({"uid": "exact_uid_from_snapshot"})
4. Extract information (browser_screenshot, browser_evaluate, browser_snapshot)

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


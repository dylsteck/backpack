import { Elysia } from "elysia";
import { streamText, type CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { experimental_createMCPClient } from "@ai-sdk/mcp";
import { db } from "@cortex/db";
import { connections } from "@cortex/db";

export const chatRoutes = new Elysia({ prefix: "/api/chat" })
	.post("/", async ({ request }) => {
		const clients: Array<{ close: () => Promise<void> }> = [];

		try {
			// Parse request body
			const body = (await request.json()) as { messages?: CoreMessage[] };
			const { messages } = body;

			if (!messages || !Array.isArray(messages)) {
				return new Response("Invalid request", { status: 400 });
			}

			// Fetch all MCP connections
			const connectionList = await db
				.select()
				.from(connections);

			// Create MCP clients and collect tools
			const allTools: Record<string, any> = {};

			for (const connection of connectionList) {
				if (connection.status !== "connected") continue;

				try {
					let client;

					if (connection.transportType === "stdio") {
						const { command, args } = connection.transportConfig as {
							command: string;
							args?: string[];
						};

						const { Experimental_StdioMCPTransport } = await import("@ai-sdk/mcp/mcp-stdio");
						
						const transport = new Experimental_StdioMCPTransport({
							command,
							args: args || [],
						});

						client = await experimental_createMCPClient({ transport });
					} else if (connection.transportType === "http") {
						const { url, headers } = connection.transportConfig as {
							url: string;
							headers?: Record<string, string>;
						};

						client = await experimental_createMCPClient({
							transport: {
								type: "http",
								url,
								headers,
							},
						});
					} else if (connection.transportType === "sse") {
						const { url, headers } = connection.transportConfig as {
							url: string;
							headers?: Record<string, string>;
						};

						client = await experimental_createMCPClient({
							transport: {
								type: "sse",
								url,
								headers,
							},
						});
					}

					if (client) {
						clients.push(client);
						const tools = await client.tools();
						Object.assign(allTools, tools);
					}
				} catch (error) {
					console.error(`Failed to connect to MCP server ${connection.serverName}:`, error);
					// Continue with other connections
				}
			}

			// Get OpenAI API key from env
			const apiKey = process.env.OPENAI_API_KEY;
			if (!apiKey) {
				throw new Error("OPENAI_API_KEY not configured");
			}

			// Stream response with MCP tools
			const result = streamText({
				model: openai("gpt-4o"),
				messages,
				tools: allTools,
			});

			return result.toTextStreamResponse();
		} catch (error) {
			console.error("Chat error:", error);
			return new Response(
				JSON.stringify({ error: "Failed to process chat request" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		} finally {
			// Always close clients
			await Promise.all(clients.map((client) => client.close().catch(console.error)));
		}
	});


/**
 * MCP Server Routes
 * Exposes Backpack tools as an MCP server via Streamable HTTP transport
 * 
 * Code Mode: Only two tools - search() and execute()
 * The LLM writes JavaScript code that searches the SDK spec or executes SDK methods
 */

import { Elysia } from "elysia";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { searchTool, executeTool } from "../mcp/codemode";

const SERVER_NAME = "backpack";
const SERVER_VERSION = "1.0.0";

const mcpTools: Tool[] = [
	{
		name: "search",
		description: "Search the Backpack SDK spec for available methods. Write JavaScript code that filters backpackSpec to find relevant methods. Returns matching methods with their descriptions.",
		inputSchema: {
			type: "object",
			properties: {
				code: {
					type: "string",
					description: "JavaScript async arrow function to search the spec. Example: async () => { const results = []; for (const [name, method] of Object.entries(backpackSpec)) { if (name.includes('timeline')) results.push({ name, ...method }); } return results; }"
				}
			},
			required: ["code"]
		}
	},
	{
		name: "execute",
		description: "Execute JavaScript code that calls Backpack SDK methods. Write code to query data, search, sync, manage notes, control browser, etc. Returns the result of the code execution.",
		inputSchema: {
			type: "object",
			properties: {
				code: {
					type: "string",
					description: "JavaScript async arrow function to execute. Example: async () => { const timeline = await backpack.timeline({ limit: 10 }); return timeline.items; }"
				}
			},
			required: ["code"]
		}
	}
];

async function executeToolHandler(mcpToolName: string, args: unknown): Promise<CallToolResult> {
	const typedArgs = args as { code: string };
	
	if (!typedArgs.code) {
		return {
			content: [{ type: "text", text: "Error: 'code' parameter is required" }],
			isError: true
		};
	}

	try {
		let result;
		if (mcpToolName === "search") {
			result = await searchTool.execute({ code: typedArgs.code });
		} else if (mcpToolName === "execute") {
			result = await executeTool.execute({ code: typedArgs.code });
		} else {
			return {
				content: [{ type: "text", text: `Unknown tool: ${mcpToolName}` }],
				isError: true
			};
		}

		return {
			content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return {
			content: [{ type: "text", text: `Error: ${errorMessage}` }],
			isError: true
		};
	}
}

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id?: string | number | null;
	method: string;
	params?: unknown;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id?: string | number | null;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

async function handleMcpRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
	const { id, method, params } = request;

	try {
		switch (method) {
			case "initialize": {
				const initParams = params as { protocolVersion?: string } | undefined;
				return {
					jsonrpc: "2.0",
					id,
					result: {
						protocolVersion: initParams?.protocolVersion || "2024-11-05",
						capabilities: { tools: {} },
						serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
					}
				};
			}

			case "notifications/initialized": {
				return { jsonrpc: "2.0", id: null, result: {} };
			}

			case "tools/list": {
				return {
					jsonrpc: "2.0",
					id,
					result: { tools: mcpTools }
				};
			}

			case "tools/call": {
				const toolParams = params as { name: string; arguments?: unknown };
				const result = await executeToolHandler(toolParams.name, toolParams.arguments || {});
				return { jsonrpc: "2.0", id, result };
			}

			case "ping": {
				return { jsonrpc: "2.0", id, result: {} };
			}

			default: {
				return {
					jsonrpc: "2.0",
					id,
					error: { code: -32601, message: `Method not found: ${method}` }
				};
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		return {
			jsonrpc: "2.0",
			id,
			error: { code: -32603, message: errorMessage }
		};
	}
}

export const mcpServerRoutes = new Elysia({ prefix: "/mcp" })
	.post("/sse", async ({ request }) => {
		try {
			const body = await request.json() as JsonRpcRequest | JsonRpcRequest[];

			if (Array.isArray(body)) {
				const responses = await Promise.all(body.map(handleMcpRequest));
				return new Response(JSON.stringify(responses), {
					headers: { 
						"Content-Type": "application/json",
						"Access-Control-Allow-Origin": "*"
					}
				});
			}

			const response = await handleMcpRequest(body);
			return new Response(JSON.stringify(response), {
				headers: { 
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			});
		} catch (error) {
			console.error("[MCP Server] Error:", error);
			return new Response(
				JSON.stringify({
					jsonrpc: "2.0",
					id: null,
					error: { code: -32700, message: "Parse error" }
				}),
				{ status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
			);
		}
	})
	.options("/sse", () => {
		return new Response("", {
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, mcp-session-id"
			}
		});
	})
	.get("/health", () => {
		return {
			status: "ok",
			server: SERVER_NAME,
			version: SERVER_VERSION,
			tools: mcpTools.map(t => t.name),
			endpoint: "/mcp/sse"
		};
	});

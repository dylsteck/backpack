/**
 * MCP Server Routes
 * Exposes Cortex tools as an MCP server via Streamable HTTP transport
 */

import { Elysia } from "elysia";
import {
	type CallToolResult,
	type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { tools } from "../tools";

// Database schema for dynamic discovery (inlined to avoid build dependency)
function getDatabaseSchema(): string {
	return `Database Tables:
- apps: id, name, description, transport, oauth, icon_url, config, connection_type, created_at, updated_at
- connections: id, server_id, server_name, vendor, transport_type, transport_config, status, secret_uri, credential_storage, encrypted_credentials, connection_metadata, last_synced_at, created_at, updated_at
- items: id, source (farcaster/teller), type (cast/transaction), timestamp, data (JSON), created_at, updated_at
- chat_sessions: id, title, created_at, updated_at
- chat_messages: id, session_id, role, content, created_at

Note: timestamps are Unix milliseconds. The 'data' column is JSON text.`;
}

// Server info
const SERVER_NAME = "cortex";
const SERVER_VERSION = "1.0.0";

// Map MCP tool names to internal tool names
const toolNameMap: Record<string, string> = {
	"search_items": "searchItems",
	"analyze_data": "analyzeAllItems",
	"query_database": "querySQLite",
	"search_obsidian": "obsidian_search",  // Also handles listing
	"read_obsidian": "obsidian_read_note",
	"write_obsidian": "obsidian_create_note",  // Handles create/update/backlink based on mode
	"get_schema": "getSchema",  // Dynamic schema discovery
};

// Convert tools to MCP format (JSON Schema)
function getMcpTools(): Tool[] {
	return [
		{
			name: "search_items",
			description: "Search Farcaster casts and bank transactions by text, source, or type.",
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "Text to search for" },
					source: { type: "string", enum: ["farcaster", "teller"], description: "Filter by source" },
					type: { type: "string", enum: ["cast", "transaction"], description: "Filter by type" },
					limit: { type: "number", description: "Max items to return", default: 50 }
				}
			}
		},
		{
			name: "analyze_data",
			description: "Get counts, date ranges, and samples for all data from a source.",
			inputSchema: {
				type: "object",
				properties: {
					source: { type: "string", enum: ["farcaster", "teller"], description: "Filter by source" },
					type: { type: "string", enum: ["cast", "transaction"], description: "Filter by type" }
				}
			}
		},
		{
			name: "get_schema",
			description: "Get database table names and columns. Call this before writing SQL queries.",
			inputSchema: {
				type: "object",
				properties: {}
			}
		},
		{
			name: "query_database",
			description: "Execute custom SQL SELECT queries against the SQLite database.",
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "SQL SELECT query to execute" }
				},
				required: ["query"]
			}
		},
		{
			name: "search_obsidian",
			description: "Search notes by title, content, or tags. Use '*' or empty to list all.",
			inputSchema: {
				type: "object",
				properties: {
					query: { type: "string", description: "Search query, or '*' to list all" },
					searchIn: { type: "string", enum: ["all", "titles", "content", "tags"], description: "Where to search", default: "all" },
					folder: { type: "string", description: "Filter by folder name" },
					limit: { type: "number", description: "Max results", default: 20 }
				}
			}
		},
		{
			name: "read_obsidian",
			description: "Read the full content of a specific Obsidian note.",
			inputSchema: {
				type: "object",
				properties: {
					notePath: { type: "string", description: "Note title or path" }
				},
				required: ["notePath"]
			}
		},
		{
			name: "write_obsidian",
			description: "Create, update, or link Obsidian notes. Mode: create/append/prepend/replace/link.",
			inputSchema: {
				type: "object",
				properties: {
					title: { type: "string", description: "Note title or path" },
					content: { type: "string", description: "Content to write (or target note for link mode)" },
					mode: { type: "string", enum: ["create", "append", "prepend", "replace", "link"], description: "Write mode", default: "create" },
					folder: { type: "string", description: "Folder for new notes" },
					tags: { type: "array", items: { type: "string" }, description: "Tags for new notes" }
				},
				required: ["title", "content"]
			}
		}
	];
}

// Execute tool by name (maps MCP tool name to internal tool name)
async function executeTool(mcpToolName: string, args: unknown): Promise<CallToolResult> {
	const typedArgs = args as Record<string, unknown>;
	
	// Handle get_schema - return database schema for dynamic discovery
	if (mcpToolName === "get_schema") {
		return {
			content: [{ type: "text", text: getDatabaseSchema() }]
		};
	}

	// Handle write_obsidian with different modes
	if (mcpToolName === "write_obsidian") {
		const mode = (typedArgs.mode as string) || "create";
		let internalToolName: string;
		let transformedArgs: Record<string, unknown>;

		if (mode === "create") {
			internalToolName = "obsidian_create_note";
			transformedArgs = {
				title: typedArgs.title,
				content: typedArgs.content,
				folder: typedArgs.folder,
				tags: typedArgs.tags
			};
		} else if (mode === "link") {
			internalToolName = "obsidian_add_backlink";
			transformedArgs = {
				notePath: typedArgs.title,
				targetNote: typedArgs.content,
				context: typedArgs.folder // Reuse folder field for context
			};
		} else {
			// append, prepend, replace
			internalToolName = "obsidian_update_note";
			transformedArgs = {
				notePath: typedArgs.title,
				content: typedArgs.content,
				mode: mode
			};
		}

		const toolDef = tools[internalToolName as keyof typeof tools];
		if (!toolDef || !toolDef.execute) {
			return {
				content: [{ type: "text", text: `Unknown tool: ${internalToolName}` }],
				isError: true
			};
		}

		try {
			const execute = toolDef.execute as (input: unknown, context?: unknown) => Promise<unknown>;
			const result = await execute(transformedArgs, {
				toolCallId: `mcp_${Date.now()}`,
				messages: [],
				abortSignal: new AbortController().signal
			});
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

	// Handle search_obsidian - use list if no query, search if query provided
	if (mcpToolName === "search_obsidian") {
		const query = typedArgs.query as string | undefined;
		const internalToolName = (!query || query === "*") ? "obsidian_list_notes" : "obsidian_search";
		
		const transformedArgs = internalToolName === "obsidian_list_notes" 
			? { limit: typedArgs.limit, folder: typedArgs.folder, search: undefined }
			: { query: typedArgs.query, searchIn: typedArgs.searchIn, folder: typedArgs.folder, limit: typedArgs.limit };

		const toolDef = tools[internalToolName as keyof typeof tools];
		if (!toolDef || !toolDef.execute) {
			return {
				content: [{ type: "text", text: `Unknown tool: ${internalToolName}` }],
				isError: true
			};
		}

		try {
			const execute = toolDef.execute as (input: unknown, context?: unknown) => Promise<unknown>;
			const result = await execute(transformedArgs, {
				toolCallId: `mcp_${Date.now()}`,
				messages: [],
				abortSignal: new AbortController().signal
			});
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

	// Standard tool execution
	const internalToolName = toolNameMap[mcpToolName] || mcpToolName;
	
	const toolDef = tools[internalToolName as keyof typeof tools];
	if (!toolDef || !toolDef.execute) {
		return {
			content: [{ type: "text", text: `Unknown tool: ${mcpToolName}` }],
			isError: true
		};
	}

	try {
		const execute = toolDef.execute as (input: unknown, context?: unknown) => Promise<unknown>;
		const result = await execute(args, {
			toolCallId: `mcp_${Date.now()}`,
			messages: [],
			abortSignal: new AbortController().signal
		});

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

// JSON-RPC request/response types
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

// Handle MCP JSON-RPC requests
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
					result: { tools: getMcpTools() }
				};
			}

			case "tools/call": {
				const toolParams = params as { name: string; arguments?: unknown };
				const result = await executeTool(toolParams.name, toolParams.arguments || {});
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
	// Main MCP endpoint - Streamable HTTP transport
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
	// CORS preflight
	.options("/sse", () => {
		return new Response("", {
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "POST, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type, mcp-session-id"
			}
		});
	})
	// Health check
	.get("/health", () => {
		return {
			status: "ok",
			server: SERVER_NAME,
			version: SERVER_VERSION,
			tools: getMcpTools().map(t => t.name),
			endpoint: "/mcp/sse"
		};
	});

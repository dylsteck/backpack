import { Elysia } from "elysia";

// Simple in-memory cache
interface CacheEntry {
	data: any;
	timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): any | null {
	const entry = cache.get(key);
	if (!entry) return null;
	
	if (Date.now() - entry.timestamp > CACHE_TTL) {
		cache.delete(key);
		return null;
	}
	
	return entry.data;
}

function setCache(key: string, data: any): void {
	cache.set(key, {
		data,
		timestamp: Date.now(),
	});
}

export const mcpRoutes = new Elysia({ prefix: "/api/mcp" })
	.get("/servers", async () => {
		console.log("📡 Fetching MCP servers from registry...");
		const cacheKey = "all-servers";
		const cached = getCached(cacheKey);
		
		if (cached) {
			console.log("✅ Returning cached data with", cached.servers?.length || 0, "servers");
			return cached;
		}
		
		try {
			console.log("🌐 Making request to MCP registry...");
			const response = await fetch(
				"https://registry.modelcontextprotocol.io/v0/servers"
			);
			
			if (!response.ok) {
				console.error("❌ Registry API error:", response.status, response.statusText);
				throw new Error(`Registry API error: ${response.statusText}`);
			}
			
			const data = await response.json();
			console.log("✅ Received data from registry:", {
				hasServers: !!data.servers,
				serverCount: data.servers?.length || 0,
				keys: Object.keys(data)
			});
			
			setCache(cacheKey, data);
			
			return data;
		} catch (error) {
			console.error("❌ Failed to fetch MCP servers:", error);
			return {
				error: "Failed to fetch MCP servers",
				servers: [],
			};
		}
	})
	.get("/servers/:id", async ({ params }) => {
		const { id } = params;
		const cacheKey = `server-${id}`;
		const cached = getCached(cacheKey);
		
		if (cached) {
			return cached;
		}
		
		try {
			// First fetch all servers to find the specific one
			const response = await fetch(
				"https://registry.modelcontextprotocol.io/v0/servers"
			);
			
			if (!response.ok) {
				throw new Error(`Registry API error: ${response.statusText}`);
			}
			
			const data = await response.json();
			const server = data.servers?.find((s: any) => s.id === id);
			
			if (!server) {
				return {
					error: "Server not found",
				};
			}
			
			setCache(cacheKey, server);
			return server;
		} catch (error) {
			console.error(`Failed to fetch MCP server ${id}:`, error);
			return {
				error: "Failed to fetch MCP server",
			};
		}
	});


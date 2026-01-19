import "dotenv/config";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { createContext } from "@cortex/api/context";
import { appRouter } from "@cortex/api/routers/index";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { mcpRoutes } from "./routes/mcp";
import { chatRoutes } from "./routes/chat";
import { tellerRoutes } from "./routes/teller";
import { mcpServerRoutes } from "./routes/mcp-server";
// Note: OpenRouter and Anthropic routes removed - now handled by OpenCode SDK
import { SyncService } from "@cortex/api/services/sync/service";
import { initDatabase, databaseExists, seedDatabase } from "@cortex/db";
import path from "path";
import os from "os";

const port = process.env.PORT ?? 3000;

// Get database path from environment or use default
const databasePath = process.env.DATABASE_PATH || 
	path.join(os.homedir(), "Library", "Application Support", "Cortex", "cortex.db");

// Only initialize database if it exists (user has completed onboarding)
let dbReady = false;
if (databaseExists(databasePath)) {
	console.log(`[Database] Initializing at: ${databasePath}`);
	const { db, isNew } = initDatabase(databasePath);
	
	// Seed database if it's new
	if (isNew) {
		console.log("[Database] New database detected, seeding with default apps...");
		seedDatabase(db);
	}
	
	console.log("[Database] Ready");
	dbReady = true;
} else {
	console.log(`[Database] Waiting for onboarding - database not found at: ${databasePath}`);
}

/** Default CORS origins for development */
const defaultOrigins = ["http://localhost:5173", "http://localhost:3001"];
const corsOrigins = process.env.CORS_ORIGIN
	? process.env.CORS_ORIGIN.split(",").map(o => o.trim()).filter(Boolean)
	: defaultOrigins;

const app = new Elysia()
	.use(
		cors({
			origin: true, // Allow all origins in development - safer approach
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	// Endpoint to initialize database after onboarding
	.post("/api/init-database", async ({ body }) => {
		const { path: dbPath } = body as { path?: string };
		const targetPath = dbPath || databasePath;
		
		console.log(`[Database] Initializing at: ${targetPath}`);
		const { db, isNew } = initDatabase(targetPath);
		
		if (isNew) {
			console.log("[Database] Seeding with default apps...");
			seedDatabase(db);
		}
		
		dbReady = true;
		console.log("[Database] Ready");
		
		return { success: true, path: targetPath };
	})
	// Endpoint to check database status
	.get("/api/database-status", () => {
		return { 
			ready: dbReady,
			path: databasePath,
			exists: databaseExists(databasePath),
		};
	})
	.use(mcpRoutes)
	.use(chatRoutes)
	.use(tellerRoutes)
	.use(mcpServerRoutes)
	.all("/trpc/*", async (context) => {
		// Check if database is ready for tRPC calls
		if (!dbReady) {
			return new Response(JSON.stringify({ error: "Database not initialized. Complete onboarding first." }), {
				status: 503,
				headers: { "Content-Type": "application/json" },
			});
		}
		
		const res = await fetchRequestHandler({
			endpoint: "/trpc",
			router: appRouter,
			req: context.request,
			createContext: () => createContext({ context }),
		});
		
		return res;
	})
	.get("/", () => "OK")
	.listen(port, () => {
		console.log(`Server is running on http://localhost:${port}`);
		console.log(`[MCP Server] Available at http://localhost:${port}/mcp (SSE: /mcp/sse)`);
		
		// Only start sync if database is ready
		if (dbReady) {
			// Start periodic sync job (every 6 hours)
			const syncService = new SyncService();
			const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
			
			// Run initial sync after 2 minutes (to let server fully start and avoid immediate background activity)
			setTimeout(async () => {
				try {
					const results = await syncService.syncAllConnections();
					const successCount = results.filter(r => r.success).length;
					const totalNewItems = results.reduce((sum, r) => sum + r.newItems, 0);
					if (totalNewItems > 0 || successCount < results.length) {
						console.log(`[Sync] Initial sync: ${successCount}/${results.length} apps synced, ${totalNewItems} new items`);
					}
				} catch (error) {
					console.error("[Sync] Error during initial sync:", error);
				}
			}, 120000); // 2 minutes instead of 30 seconds
			
			// Set up periodic sync
			setInterval(async () => {
				try {
					const results = await syncService.syncAllConnections();
					const successCount = results.filter(r => r.success).length;
					const totalNewItems = results.reduce((sum, r) => sum + r.newItems, 0);
					// Only log if there are new items or errors
					if (totalNewItems > 0 || successCount < results.length) {
						console.log(`[Sync] Periodic sync: ${successCount}/${results.length} apps synced, ${totalNewItems} new items`);
					}
				} catch (error) {
					console.error("[Sync] Error during periodic sync:", error);
				}
			}, SYNC_INTERVAL_MS);
			
			console.log(`[Sync] Periodic sync scheduled (every ${SYNC_INTERVAL_MS / 1000 / 60 / 60} hours)`);
		}
	});

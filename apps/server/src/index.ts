import "dotenv/config";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { createContext } from "@cortex/api/context";
import { appRouter } from "@cortex/api/routers/index";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { mcpRoutes } from "./routes/mcp";
import { chatRoutes } from "./routes/chat";
import { tellerRoutes } from "./routes/teller";
import { openrouterRoutes } from "./routes/openrouter";
import { SyncService } from "@cortex/api/services/sync/service";

const port = process.env.PORT ?? 3000;

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
	.use(mcpRoutes)
	.use(chatRoutes)
	.use(tellerRoutes)
	.use(openrouterRoutes)
	.all("/trpc/*", async (context) => {
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
	});

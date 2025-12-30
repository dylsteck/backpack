import { z } from "zod";
import { publicProcedure, router } from "../index";
import { SyncService } from "../services/sync/service";
import { db, connections } from "@cortex/db";
import { eq } from "drizzle-orm";

const syncService = new SyncService();

export const syncRouter = router({
	/**
	 * Trigger sync for a specific app
	 */
	triggerSync: publicProcedure
		.input(
			z.object({
				appId: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const result = await syncService.syncApp(input.appId);
				return result;
			} catch (error: any) {
				console.error(`[syncRouter] Error triggering sync for ${input.appId}:`, error);
				throw new Error(error?.message || "Failed to trigger sync");
			}
		}),

	/**
	 * Trigger sync for all connected apps
	 */
	triggerSyncAll: publicProcedure.mutation(async () => {
		try {
			const results = await syncService.syncAllConnections();
			return { results };
		} catch (error: any) {
			console.error("[syncRouter] Error triggering sync all:", error);
			throw new Error(error?.message || "Failed to trigger sync");
		}
	}),

	/**
	 * Get sync status for all connections
	 */
	getSyncStatus: publicProcedure.query(async () => {
		try {
			const allConnections = await db.select({
				id: connections.id,
				serverId: connections.serverId,
				status: connections.status,
				lastSyncedAt: connections.lastSyncedAt,
			}).from(connections);

			return allConnections.map(conn => ({
				appId: conn.serverId,
				status: conn.status,
				lastSyncedAt: conn.lastSyncedAt,
			}));
		} catch (error: any) {
			console.error("[syncRouter] Error getting sync status:", error);
			throw new Error(error?.message || "Failed to get sync status");
		}
	}),
});


import { Elysia } from "elysia";
import { getDatabase, items, connections, apps } from "@backpack/db";
import { eq, desc, sql } from "drizzle-orm";
import { SyncService } from "../services/sync/service";
import { ItemsService } from "../services/items/service";

export const apiRoutes = new Elysia({ prefix: "/api" })
	.get("/status", async () => {
		try {
			const db = getDatabase();
			const allConnections = await db.select().from(connections);
			const itemCounts = await db
				.select({
					source: items.source,
					type: items.type,
					count: sql<number>`count(*)`,
				})
				.from(items)
				.groupBy(items.source, items.type);
			const allApps = await db.select().from(apps);

			return {
				status: "ok",
				connections: allConnections.map((conn) => ({
					id: conn.serverId,
					name: conn.serverName,
					status: conn.status,
					lastSyncedAt: conn.lastSyncedAt
						? new Date(conn.lastSyncedAt).toISOString()
						: null,
				})),
				items: itemCounts.map((ic) => ({
					source: ic.source,
					type: ic.type,
					count: ic.count,
				})),
				apps: allApps.map((app) => ({
					id: app.id,
					name: app.name,
					connectionType: app.connectionType,
				})),
			};
		} catch (error: any) {
			return { status: "error", error: error.message };
		}
	})
	.get("/timeline", async ({ query }) => {
		try {
			const limit = Number(query.limit) || 25;
			const source = query.source as string | undefined;
			const db = getDatabase();

			const conditions = [];
			if (source) {
				conditions.push(eq(items.source, source));
			}

			let q = db.select().from(items);
			if (conditions.length > 0) {
				q = q.where(conditions[0]!) as typeof q;
			}

			const results = await q.orderBy(desc(items.timestamp)).limit(limit);

			return {
				items: results.map((item) => ({
					id: item.id,
					source: item.source,
					type: item.type,
					timestamp: item.timestamp,
					data: item.data,
				})),
				count: results.length,
			};
		} catch (error: any) {
			return { items: [], count: 0, error: error.message };
		}
	})
	.get("/items/:source", async ({ params, query }) => {
		try {
			const itemsService = new ItemsService();
			const result = await itemsService.getItems({
				source: params.source,
				limit: Number(query.limit) || 50,
				cursor: query.cursor as string | undefined,
			});
			return result;
		} catch (error: any) {
			return { items: [], error: error.message };
		}
	})
	.post("/sync", async ({ query }) => {
		try {
			const syncService = new SyncService();
			const appId = query.appId as string | undefined;

			if (appId) {
				const result = await syncService.syncApp(appId);
				return [result];
			}

			return await syncService.syncAllConnections();
		} catch (error: any) {
			return [{ success: false, appId: "all", newItems: 0, error: error.message }];
		}
	})
	.get("/search", async ({ query }) => {
		try {
			const q = query.q as string;
			if (!q) {
				return { query: "", results: [], count: 0 };
			}

			const limit = Number(query.limit) || 10;
			const db = getDatabase();
			const lowerPattern = `%${q.toLowerCase()}%`;

			const results = await db
				.select()
				.from(items)
				.where(
					sql`LOWER(CAST(${items.data} AS TEXT)) LIKE ${lowerPattern}`
				)
				.orderBy(desc(items.timestamp))
				.limit(limit);

			return {
				query: q,
				results: results.map((item) => ({
					id: item.id,
					source: item.source,
					type: item.type,
					timestamp: item.timestamp,
					data: item.data,
				})),
				count: results.length,
			};
		} catch (error: any) {
			return { query: query.q || "", results: [], count: 0, error: error.message };
		}
	});

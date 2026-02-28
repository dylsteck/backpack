import { getDatabase, items, connections, apps } from "@backpack/db";
import { eq, and, desc, lt, sql } from "drizzle-orm";
import { SyncService } from "@backpack/api/services/sync/service";
import { ensureDatabase, getDatabasePath } from "./db";
import { hybridSearch } from "./search";
import { ObsidianService } from "./obsidian";
import { BrowserService } from "./browser";
import type {
	Item,
	TimelineResult,
	ItemsResult,
	SearchResult,
	Connection,
	SyncResult,
	StatusResult,
	TimelineOptions,
	ItemsOptions,
	SearchOptions,
} from "./types";

export class Backpack {
	private _dbPath: string;

	constructor(opts?: { dbPath?: string }) {
		this._dbPath = getDatabasePath(opts?.dbPath);
		ensureDatabase(opts?.dbPath);
	}

	get db() {
		return getDatabase();
	}

	async timeline(opts?: TimelineOptions): Promise<TimelineResult> {
		const db = this.db;
		const limit = opts?.limit ?? 25;
		const conditions = [];

		if (opts?.source) {
			conditions.push(eq(items.source, opts.source));
		}
		if (opts?.type) {
			conditions.push(eq(items.type, opts.type));
		}
		if (opts?.cursor) {
			const cursorDate = new Date(opts.cursor);
			if (!isNaN(cursorDate.getTime())) {
				conditions.push(lt(items.timestamp, cursorDate));
			}
		}

		let query = db.select().from(items);
		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as typeof query;
		}

		const results = await query.orderBy(desc(items.timestamp)).limit(limit + 1);

		const hasMore = results.length > limit;
		const itemsList = hasMore ? results.slice(0, limit) : results;
		const lastItem = itemsList[itemsList.length - 1];

		return {
			items: itemsList.map((item) => ({
				id: item.id,
				source: item.source,
				type: item.type,
				timestamp: item.timestamp,
				data: item.data as Record<string, any>,
			})),
			nextCursor: hasMore && lastItem ? lastItem.timestamp.toISOString() : null,
			count: itemsList.length,
		};
	}

	async items(opts?: ItemsOptions): Promise<ItemsResult> {
		const db = this.db;
		const limit = opts?.all ? 1000 : (opts?.limit ?? 100);
		let allItems: Item[] = [];
		let cursor = opts?.cursor;
		let hasMore = true;

		while (hasMore) {
			const conditions = [];

			if (opts?.source) {
				conditions.push(eq(items.source, opts.source));
			}
			if (opts?.type) {
				conditions.push(eq(items.type, opts.type));
			}
			if (cursor) {
				const cursorDate = new Date(cursor);
				if (!isNaN(cursorDate.getTime())) {
					conditions.push(lt(items.timestamp, cursorDate));
				}
			}

			let query = db.select().from(items);
			if (conditions.length > 0) {
				query = query.where(and(...conditions)) as typeof query;
			}

			const results = await query.orderBy(desc(items.timestamp)).limit(limit + 1);

			const batchHasMore = results.length > limit;
			const batch = batchHasMore ? results.slice(0, limit) : results;

			allItems = allItems.concat(
				batch.map((item) => ({
					id: item.id,
					source: item.source,
					type: item.type,
					timestamp: item.timestamp,
					data: item.data as Record<string, any>,
				}))
			);

			if (opts?.all && batchHasMore) {
				const lastItem = batch[batch.length - 1];
				cursor = lastItem?.timestamp.toISOString();
			} else {
				hasMore = false;
				if (batchHasMore && !opts?.all) {
					const lastItem = batch[batch.length - 1];
					cursor = lastItem?.timestamp.toISOString();
				} else {
					cursor = undefined;
				}
			}
		}

		// Get total count
		const countConditions = [];
		if (opts?.source) {
			countConditions.push(eq(items.source, opts.source));
		}
		if (opts?.type) {
			countConditions.push(eq(items.type, opts.type));
		}

		let countQuery = db.select({ count: sql<number>`count(*)` }).from(items);
		if (countConditions.length > 0) {
			countQuery = countQuery.where(and(...countConditions)) as typeof countQuery;
		}
		const [{ count: total }] = await countQuery;

		return {
			items: allItems,
			nextCursor: cursor ?? null,
			total,
			count: allItems.length,
		};
	}

	async get(id: string): Promise<Item | null> {
		const db = this.db;
		const [item] = await db.select().from(items).where(eq(items.id, id)).limit(1);

		if (!item) return null;

		return {
			id: item.id,
			source: item.source,
			type: item.type,
			timestamp: item.timestamp,
			data: item.data as Record<string, any>,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt,
		};
	}

	async search(query: string, opts?: SearchOptions): Promise<SearchResult> {
		const normalizedQuery = query.trim();
		if (!normalizedQuery) {
			return { query: "", results: [], count: 0 };
		}

		const limit = opts?.limit ?? 10;
		const dbOnly = opts?.dbOnly ?? false;
		const results = await hybridSearch(normalizedQuery, limit, dbOnly);

		return {
			query: normalizedQuery,
			results,
			count: results.length,
		};
	}

	async connections(): Promise<Connection[]> {
		const db = this.db;
		const allConnections = await db.select().from(connections);
		const allApps = await db.select().from(apps);
		const appMap = new Map(allApps.map((a) => [a.id, a]));

		return allConnections.map((conn) => {
			const app = appMap.get(conn.serverId);
			return {
				id: conn.id,
				appId: conn.serverId,
				appName: app?.name || conn.serverName,
				status: conn.status,
				transportType: conn.transportType,
				lastSyncedAt: conn.lastSyncedAt ? new Date(conn.lastSyncedAt).toISOString() : null,
				createdAt: new Date(conn.createdAt).toISOString(),
			};
		});
	}

	async sync(appId?: string): Promise<SyncResult[]> {
		const syncService = new SyncService();

		if (appId) {
			const result = await syncService.syncApp(appId);
			return [result];
		}

		return await syncService.syncAllConnections();
	}

	async status(): Promise<StatusResult> {
		const db = this.db;

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
			connections: allConnections.map((conn) => ({
				id: conn.serverId,
				name: conn.serverName,
				status: conn.status,
				lastSyncedAt: conn.lastSyncedAt ? new Date(conn.lastSyncedAt).toISOString() : null,
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
	}

	get obsidian() {
		return new ObsidianService();
	}

	get browser() {
		return new BrowserService();
	}
}

import { db, items } from "@cortex/db";
import { eq, and, desc, lt, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";

export interface CreateItemParams {
	source: string;
	type: string;
	timestamp: Date;
	data: Record<string, any>;
}

export interface GetItemsParams {
	source?: string;
	type?: string;
	cursor?: string;
	limit?: number;
}

export class ItemsService {
	async createItem(params: CreateItemParams): Promise<{ id: string }> {
		const id = crypto.randomUUID();
		const now = new Date();

		await db.insert(items).values({
			id,
			source: params.source,
			type: params.type,
			timestamp: params.timestamp,
			data: params.data,
			createdAt: now,
			updatedAt: now,
		});

		return { id };
	}

	async getItems(params: GetItemsParams = {}): Promise<{
		items: Array<{
			id: string;
			source: string;
			type: string;
			timestamp: Date;
			data: Record<string, any>;
		}>;
		nextCursor?: string;
	}> {
		const limit = params.limit || 25;
		let query = db.select().from(items);

		const conditions = [];
		if (params.source) {
			conditions.push(eq(items.source, params.source));
		}
		if (params.type) {
			conditions.push(eq(items.type, params.type));
		}
		if (params.cursor) {
			// Cursor is a timestamp, get items before this timestamp
			const cursorDate = new Date(params.cursor);
			// Validate the date before using it
			if (isNaN(cursorDate.getTime())) {
				console.error(`[ItemsService] Invalid cursor date: ${params.cursor}`);
			} else {
				conditions.push(lt(items.timestamp, cursorDate));
			}
		}

		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as any;
		}

		const results = await query.orderBy(desc(items.timestamp)).limit(limit + 1);

		console.log(`[ItemsService] getItems query: source=${params.source}, type=${params.type}, found=${results.length} items`);

		const hasMore = results.length > limit;
		const itemsList = hasMore ? results.slice(0, limit) : results;

		return {
			items: itemsList.map((item) => ({
				id: item.id,
				source: item.source,
				type: item.type,
				timestamp: item.timestamp,
				data: item.data as Record<string, any>,
			})),
			nextCursor: hasMore && itemsList.length > 0 ? itemsList[itemsList.length - 1].timestamp.toISOString() : undefined,
		};
	}

	async getCount(params: { source?: string; type?: string } = {}): Promise<number> {
		let query = db.select({ count: sql<number>`count(*)` }).from(items);

		const conditions = [];
		if (params.source) {
			conditions.push(eq(items.source, params.source));
		}
		if (params.type) {
			conditions.push(eq(items.type, params.type));
		}

		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as any;
		}

		const result = await query;
		return result[0]?.count || 0;
	}

}


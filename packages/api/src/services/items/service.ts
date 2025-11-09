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

	async syncStripeTransactions(accountId: string, transactions: Array<{
		id: string;
		amount: number;
		currency: string;
		description: string;
		status: string;
		transacted_at: number;
		created: number;
	}>): Promise<number> {
		let created = 0;

		for (const tx of transactions) {
			try {
				const itemId = `stripe_tx_${tx.id}`;
				
				// Check if transaction already exists by checking the item ID directly
				// We use stripe_tx_${tx.id} as the item ID for easy duplicate detection
				const existing = await db
					.select()
					.from(items)
					.where(eq(items.id, itemId))
					.limit(1);

				if (existing.length === 0) {
					const timestamp = new Date(tx.transacted_at * 1000);
					// Use Stripe transaction ID as the item ID for easier duplicate detection
					await db.insert(items).values({
						id: itemId,
						source: "stripe",
						type: "transaction",
						timestamp,
						data: {
							id: tx.id,
							account: tx.account || accountId, // Use account from transaction or fallback to parameter
							account_id: accountId,
							amount: tx.amount,
							currency: tx.currency,
							description: tx.description,
							status: tx.status,
							transacted_at: tx.transacted_at,
							created: tx.created,
						},
						createdAt: new Date(),
						updatedAt: new Date(),
					});
					created++;
					console.log(`[ItemsService] Created transaction item: ${tx.id} (itemId: ${itemId}) at ${timestamp.toISOString()}`);
				} else {
					console.log(`[ItemsService] Transaction ${tx.id} already exists (itemId: ${itemId}), skipping`);
				}
			} catch (error) {
				console.error(`[ItemsService] Error syncing transaction ${tx.id}:`, error);
				console.error(`[ItemsService] Error details:`, error instanceof Error ? error.message : String(error));
				// Continue with next transaction
			}
		}

		return created;
	}
}


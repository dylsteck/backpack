import { publicProcedure, router } from "../index";
import { z } from "zod";
import { getDatabase, connections, items } from "@backpack/db";
import { eq, and, desc } from "drizzle-orm";
import { farcasterRouter } from "./farcaster";
import { tellerRouter } from "./teller";
import { ItemsService } from "../services/items/service";

export type TimelineItem = {
	id: string;
	timestamp: Date;
	source: string;
	type: string;
	data: any;
};

export const timelineRouter = router({
	getTimeline: publicProcedure
		.input(
			z.object({
				sources: z.array(z.string()).optional(),
				source: z.string().optional(), // Single source filter for app detail pages
				cursor: z.string().optional(),
				limit: z.number().optional().default(25),
			})
		)
		.query(async ({ input }) => {
			try {
				const db = getDatabase();
				const allConnections = await db.select().from(connections);
				const timelineItems: TimelineItem[] = [];
				let nextCursor: string | undefined = undefined;

				const itemsService = new ItemsService();
				
				console.log(`[Timeline] Processing ${allConnections.length} connections`);
				console.log(`[Timeline] Connections:`, allConnections.map(c => ({ id: c.serverId, status: c.status })));

				// Support both sources array and single source filter
				const sourceFilter = input.source ? [input.source] : input.sources;

				for (const connection of allConnections) {
					if (sourceFilter && !sourceFilter.includes(connection.serverId)) {
						continue;
					}

					if (connection.serverId === "farcaster" && connection.status === "connected") {
						try {
							// First, try to get items from items table
							const dbItems = await itemsService.getItems({
								source: "farcaster",
								type: "cast",
								limit: input.limit,
								cursor: input.cursor,
							});

							if (dbItems.items.length > 0) {
								// Use items from database
								for (const item of dbItems.items) {
									timelineItems.push({
										id: item.id,
										timestamp: item.timestamp,
										source: item.source,
										type: item.type,
										data: item.data,
									});
								}
								if (dbItems.nextCursor) {
									nextCursor = dbItems.nextCursor;
								}
							} else {
								// Fallback to API if no items in database
								console.log(`[Timeline] No Farcaster items in database, fetching from API...`);
								const fid = connection.connectionMetadata?.fid as string | undefined;
								if (!fid) {
									continue;
								}

								// Use the cached tRPC route instead of direct service call
								const caller = farcasterRouter.createCaller({});
								const response = await caller.getUserCasts({
									fid: parseInt(fid),
									limit: input.limit,
									cursor: input.cursor,
								});

								for (const cast of response.casts) {
									timelineItems.push({
										id: cast.hash,
										timestamp: new Date(cast.timestamp),
										source: "farcaster",
										type: "cast",
										data: cast,
									});
								}

								if (response.next?.cursor) {
									nextCursor = response.next.cursor;
								}
							}
						} catch (error) {
							console.error(`Error fetching Farcaster timeline for connection ${connection.id}:`, error);
						}
					}

					// Handle Obsidian notes
					if (connection.serverId === "obsidian" && connection.status === "connected") {
						try {
							const dbItems = await itemsService.getItems({
								source: "obsidian",
								type: "note",
								limit: input.limit,
								cursor: input.cursor,
							});

							for (const item of dbItems.items) {
								timelineItems.push({
									id: item.id,
									timestamp: item.timestamp,
									source: item.source,
									type: item.type,
									data: item.data,
								});
							}
							if (dbItems.nextCursor) {
								nextCursor = dbItems.nextCursor;
							}
						} catch (error) {
							console.error(`Error fetching Obsidian timeline for connection ${connection.id}:`, error);
						}
					}

					// Handle Teller transactions
					if (connection.serverId === "teller" && connection.status === "connected") {
						try {
							// First, try to get items from items table
							const dbItems = await itemsService.getItems({
								source: "teller",
								type: "transaction",
								limit: input.limit,
								cursor: input.cursor,
							});

							if (dbItems.items.length > 0) {
								// Use items from database
								for (const item of dbItems.items) {
									timelineItems.push({
										id: item.id,
										timestamp: item.timestamp,
										source: item.source,
										type: item.type,
										data: item.data,
									});
								}
								if (dbItems.nextCursor) {
									nextCursor = dbItems.nextCursor;
								}
							} else {
								// Fallback to API if no items in database
								console.log(`[Timeline] No Teller items in database, fetching from API...`);
								const caller = tellerRouter.createCaller({});
								const response = await caller.getTransactions({
									count: input.limit,
								});

								for (const transaction of response.transactions) {
									timelineItems.push({
										id: transaction.id,
										timestamp: new Date(transaction.date),
										source: "teller",
										type: "transaction",
										data: transaction,
									});
								}
							}
						} catch (error) {
							console.error(`Error fetching Teller timeline for connection ${connection.id}:`, error);
						}
					}

				}

				// Also fetch user notes
				if (!sourceFilter || sourceFilter.includes("user")) {
					try {
						const db = getDatabase();
						const userNotes = await db
							.select()
							.from(items as any)
							.where(and(eq((items as any).source, "user"), eq((items as any).type, "note")))
							.orderBy(desc((items as any).timestamp))
							.limit(input.limit);

						for (const note of userNotes) {
							timelineItems.push({
								id: note.id,
								timestamp: note.timestamp,
								source: note.source,
								type: note.type,
								data: note.data,
							});
						}
					} catch (error) {
						console.error("Error fetching user notes:", error);
					}
				}

				timelineItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

				console.log(`[Timeline] Returning ${timelineItems.length} total items (${timelineItems.filter(i => i.source === 'farcaster').length} Farcaster, ${timelineItems.filter(i => i.source === 'teller').length} Teller, ${timelineItems.filter(i => i.source === 'obsidian').length} Obsidian, ${timelineItems.filter(i => i.source === 'user').length} Notes)`);

				return {
					items: timelineItems,
					nextCursor,
				};
			} catch (error) {
				console.error("Error in getTimeline:", error);
				return { items: [], nextCursor: undefined };
			}
		}),

	getItemCount: publicProcedure
		.input(
			z.object({
				source: z.string().optional(),
				type: z.string().optional(),
			})
		)
		.query(async ({ input }) => {
			try {
				const itemsService = new ItemsService();
				const count = await itemsService.getCount({
					source: input.source,
					type: input.type,
				});
				return { count };
			} catch (error) {
				console.error("Error in getItemCount:", error);
				return { count: 0 };
			}
		}),

	// Delete a timeline item
	deleteItem: publicProcedure
		.input(
			z.object({
				id: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const db = getDatabase();
				await db.delete(items).where(eq(items.id, input.id));
				return { success: true };
			} catch (error) {
				console.error("Error deleting item:", error);
				throw new Error("Failed to delete item");
			}
		}),
});


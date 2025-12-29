import { publicProcedure, router } from "../index";
import { z } from "zod";
import { db, connections } from "@cortex/db";
import { eq } from "drizzle-orm";
import { farcasterRouter } from "./farcaster";
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
				const allConnections = await db.select().from(connections);
				const items: TimelineItem[] = [];
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
								items.push({
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
						} catch (error) {
							console.error(`Error fetching Farcaster timeline for connection ${connection.id}:`, error);
						}
					}

				}

				items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

				console.log(`[Timeline] Returning ${items.length} total items (${items.filter(i => i.source === 'farcaster').length} Farcaster)`);

				return {
					items,
					nextCursor,
				};
			} catch (error) {
				console.error("Error in getTimeline:", error);
				return { items: [], nextCursor: undefined };
			}
		}),
});


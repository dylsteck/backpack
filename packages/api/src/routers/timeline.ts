import { publicProcedure, router } from "../index";
import { z } from "zod";
import { db, connections } from "@cortex/db";
import { eq } from "drizzle-orm";
import { FarcasterService } from "../services/farcaster";
import { decryptCredentials } from "../lib/credentials";

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
				cursor: z.string().optional(),
				limit: z.number().optional().default(25),
			})
		)
		.query(async ({ input }) => {
			try {
				const allConnections = await db.select().from(connections);
				const items: TimelineItem[] = [];
				let nextCursor: string | undefined = undefined;

				for (const connection of allConnections) {
					if (input.sources && !input.sources.includes(connection.serverId)) {
						continue;
					}

					if (connection.serverId === "farcaster" && connection.status === "connected") {
						try {
							const fid = connection.connectionMetadata?.fid as string | undefined;
							if (!fid) {
								continue;
							}

								if (!connection.encryptedCredentials) {
									continue;
							}
							const apiKey = decryptCredentials(connection.encryptedCredentials);

							const farcasterService = new FarcasterService(apiKey);
							const response = await farcasterService.getUserCasts({
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


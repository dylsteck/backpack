import { publicProcedure, router } from "../index";
import { z } from "zod";
import { getDatabase, connections } from "@cortex/db";
import { eq } from "drizzle-orm";
import { FarcasterService } from "../services/farcaster";
import { decryptCredentials } from "../lib/credentials";
import type { UserCastsResponse } from "../services/farcaster/types";

interface CachedUserCasts {
	data: UserCastsResponse;
	timestamp: number;
}

// Cache for getUserCasts - 1 hour TTL
const userCastsCache = new Map<string, CachedUserCasts>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

function generateCacheKey(params: {
	fid: number;
	viewer_fid?: number;
	limit?: number;
	cursor?: string;
	include_replies?: boolean;
	parent_url?: string;
	channel_id?: string;
}): string {
	return JSON.stringify({
		fid: params.fid,
		viewer_fid: params.viewer_fid ?? null,
		limit: params.limit ?? 25,
		cursor: params.cursor ?? null,
		include_replies: params.include_replies ?? true,
		parent_url: params.parent_url ?? null,
		channel_id: params.channel_id ?? null,
	});
}

function cleanupExpiredCache(): void {
	const now = Date.now();
	for (const [key, cached] of userCastsCache.entries()) {
		if (now - cached.timestamp > CACHE_TTL) {
			userCastsCache.delete(key);
		}
	}
}

export const farcasterRouter = router({
	getUserCasts: publicProcedure
		.input(
			z.object({
				fid: z.number(),
				viewer_fid: z.number().optional(),
				limit: z.number().optional().default(25),
				cursor: z.string().optional(),
				include_replies: z.boolean().optional().default(true),
				parent_url: z.string().optional(),
				channel_id: z.string().optional(),
			})
		)
		.query(async ({ input }) => {
			// Generate cache key from all parameters
			// Note: Different cursors = different cache keys (expected for pagination)
			const cacheKey = generateCacheKey(input);
			
			// Check cache
			const cached = userCastsCache.get(cacheKey);
			const now = Date.now();
			
			if (cached && now - cached.timestamp < CACHE_TTL) {
				console.log(`[Cache HIT] getUserCasts for fid=${input.fid}, cursor=${input.cursor || 'none'}`);
				return cached.data;
			}
			
			console.log(`[Cache MISS] getUserCasts for fid=${input.fid}, cursor=${input.cursor || 'none'} - fetching from API`);
			
			// Clean up expired entries periodically (every 10th call)
			if (Math.random() < 0.1) {
				cleanupExpiredCache();
			}
			
			// Get API key from connection - find a connected Farcaster connection
			const farcasterConnections = await db
				.select()
				.from(connections)
				.where(eq(connections.serverId, "farcaster"));
			
			const connection = farcasterConnections.find(
				(conn) => conn.status === "connected"
			);
			
			if (!connection) {
				throw new Error("No connected Farcaster connection found");
			}
			
			if (!connection.encryptedCredentials) {
				throw new Error("Farcaster connection missing credentials");
			}
			
			const apiKey = decryptCredentials(connection.encryptedCredentials);
			const farcasterService = new FarcasterService(apiKey);
			
			// Fetch from API
			const data = await farcasterService.getUserCasts({
				fid: input.fid,
				viewer_fid: input.viewer_fid,
				limit: input.limit,
				cursor: input.cursor,
				include_replies: input.include_replies,
				parent_url: input.parent_url,
				channel_id: input.channel_id,
			});
			
			// Store in cache
			userCastsCache.set(cacheKey, {
				data,
				timestamp: now,
			});
			
			console.log(`[Cache SET] getUserCasts for fid=${input.fid}, cursor=${input.cursor || 'none'} - cached for 1 hour`);
			
			return data;
		}),
});


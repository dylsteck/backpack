/**
 * Browser/desktop tRPC client for Backpack API.
 * Use @backpack/api/client - this subpath has no server dependencies.
 */
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "./routers/index";

/**
 * Create a Backpack API client for browser/desktop use.
 * Connects to the Backpack server via tRPC over HTTP.
 *
 * @param baseUrl - Server URL (e.g. "http://localhost:3000")
 * @returns Typed tRPC client
 */
export function createBackpackClient(baseUrl: string) {
	return createTRPCProxyClient<AppRouter>({
		links: [
			httpBatchLink({
				url: `${baseUrl.replace(/\/$/, "")}/trpc`,
			}),
		],
	});
}

export type { AppRouter };

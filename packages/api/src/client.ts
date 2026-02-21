/**
 * Browser/desktop tRPC client for Cortex API.
 * Use @cortex/api/client - this subpath has no server dependencies.
 */
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "./routers/index";

/**
 * Create a Cortex API client for browser/desktop use.
 * Connects to the Cortex server via tRPC over HTTP.
 *
 * @param baseUrl - Server URL (e.g. "http://localhost:3000")
 * @returns Typed tRPC client
 */
export function createCortexClient(baseUrl: string) {
	return createTRPCProxyClient<AppRouter>({
		links: [
			httpBatchLink({
				url: `${baseUrl.replace(/\/$/, "")}/trpc`,
			}),
		],
	});
}

export type { AppRouter };

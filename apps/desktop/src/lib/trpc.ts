import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@cortex/api/routers";

// In Electron, we need to use import.meta.env for Vite env vars
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
	links: [
		httpBatchLink({
			url: `${API_URL}/trpc`,
			fetch: async (url, options) => {
				try {
					const response = await fetch(url, {
						...options,
						credentials: "include",
					});
					if (!response.ok) {
						console.error(`[tRPC] Request failed: ${response.status} ${response.statusText}`);
					}
					return response;
				} catch (error) {
					console.error("[tRPC] Fetch error:", error);
					throw error;
				}
			},
		}),
	],
});


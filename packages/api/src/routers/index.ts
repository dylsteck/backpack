import { publicProcedure, router } from "../index";
import { mcpRouter } from "./mcp";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	mcp: mcpRouter,
});
export type AppRouter = typeof appRouter;

import { publicProcedure, router } from "../index";
import { appsRouter } from "./mcp";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	apps: appsRouter,
});
export type AppRouter = typeof appRouter;

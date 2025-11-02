import { publicProcedure, router } from "../index";
import { appsRouter } from "./mcp";
import { timelineRouter } from "./timeline";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	apps: appsRouter,
	timeline: timelineRouter,
});
export type AppRouter = typeof appRouter;

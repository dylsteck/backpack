import { publicProcedure, router } from "../index";
import { appsRouter } from "./mcp";
import { timelineRouter } from "./timeline";
import { farcasterRouter } from "./farcaster";
import { tellerRouter } from "./teller";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	apps: appsRouter,
	timeline: timelineRouter,
	farcaster: farcasterRouter,
	teller: tellerRouter,
});
export type AppRouter = typeof appRouter;

import { publicProcedure, router } from "../index";
import { appsRouter } from "./mcp";
import { timelineRouter } from "./timeline";
import { farcasterRouter } from "./farcaster";
import { tellerRouter } from "./teller";
import { syncRouter } from "./sync";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	apps: appsRouter,
	timeline: timelineRouter,
	farcaster: farcasterRouter,
	teller: tellerRouter,
	sync: syncRouter,
});
export type AppRouter = typeof appRouter;

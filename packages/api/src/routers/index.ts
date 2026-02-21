import { publicProcedure, router } from "../index";
import { appsRouter } from "./mcp";
import { timelineRouter } from "./timeline";
import { farcasterRouter } from "./farcaster";
import { tellerRouter } from "./teller";
import { syncRouter } from "./sync";
import { chatRouter } from "./chat";
import { obsidianRouter } from "./obsidian";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	apps: appsRouter,
	timeline: timelineRouter,
	farcaster: farcasterRouter,
	teller: tellerRouter,
	sync: syncRouter,
	chat: chatRouter,
	obsidian: obsidianRouter,
});
export type AppRouter = typeof appRouter;

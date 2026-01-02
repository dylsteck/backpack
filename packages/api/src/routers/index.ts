import { publicProcedure, router } from "../index";
import { appsRouter } from "./mcp";
import { timelineRouter } from "./timeline";
import { farcasterRouter } from "./farcaster";
import { tellerRouter } from "./teller";
import { syncRouter } from "./sync";
import { notesRouter } from "./notes";
import { chatRouter } from "./chat";
import { commentsRouter } from "./comments";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	apps: appsRouter,
	timeline: timelineRouter,
	farcaster: farcasterRouter,
	teller: tellerRouter,
	sync: syncRouter,
	notes: notesRouter,
	chat: chatRouter,
	comments: commentsRouter,
});
export type AppRouter = typeof appRouter;

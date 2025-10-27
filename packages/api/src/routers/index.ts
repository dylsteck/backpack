import { protectedProcedure, publicProcedure, router } from "../index";
import { mcpRouter } from "./mcp";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: "This is private",
			user: ctx.session.user,
		};
	}),
	mcp: mcpRouter,
});
export type AppRouter = typeof appRouter;

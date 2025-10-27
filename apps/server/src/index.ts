import "dotenv/config";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { createContext } from "@cortex/api/context";
import { appRouter } from "@cortex/api/routers/index";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "@cortex/auth";
import { mcpRoutes } from "./routes/mcp";
import { chatRoutes } from "./routes/chat";

const port = process.env.PORT ?? 3000;

const app = new Elysia()
	.use(
		cors({
			origin: (process.env.CORS_ORIGIN || "").split(",").map(o => o.trim()),
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	.use(mcpRoutes)
	.use(chatRoutes)
	.all("/api/auth/*", async (context) => {
		const { request, status } = context;
		if (["POST", "GET"].includes(request.method)) {
			return auth.handler(request);
		}
		return status(405);
	})
	.all("/trpc/*", async (context) => {
		const res = await fetchRequestHandler({
			endpoint: "/trpc",
			router: appRouter,
			req: context.request,
			createContext: () => createContext({ context }),
		});
		return res;
	})
	.get("/", () => "OK")
	.listen(port, () => {
		console.log(`Server is running on http://localhost:${port}`);
	});

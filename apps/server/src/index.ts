import "dotenv/config";
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { createContext } from "@cortex/api/context";
import { appRouter } from "@cortex/api/routers/index";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { mcpRoutes } from "./routes/mcp";
import { chatRoutes } from "./routes/chat";

const port = process.env.PORT ?? 3000;

/** Default CORS origins for development */
const defaultOrigins = ["http://localhost:5173", "http://localhost:3001"];
const corsOrigins = process.env.CORS_ORIGIN
	? process.env.CORS_ORIGIN.split(",").map(o => o.trim()).filter(Boolean)
	: defaultOrigins;

const app = new Elysia()
	.use(
		cors({
			origin: true, // Allow all origins in development - safer approach
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	.use(mcpRoutes)
	.use(chatRoutes)
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

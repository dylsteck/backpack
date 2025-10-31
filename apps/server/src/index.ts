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
			origin: (origin) => {
				if (!origin) return false;
				return corsOrigins.includes(origin);
			},
			methods: ["GET", "POST", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	.use(mcpRoutes)
	.use(chatRoutes)
	.all("/trpc/*", async (context) => {
		const origin = context.request.headers.get("origin");
		/**
		 * Allow if origin is in corsOrigins list or is a localhost origin (for development)
		 */
		const isAllowedOrigin = origin && (
			corsOrigins.includes(origin) || 
			origin.startsWith("http://localhost:") || 
			origin.startsWith("http://127.0.0.1:")
		);
		
		if (context.request.method === "OPTIONS") {
			const headers = new Headers();
			if (isAllowedOrigin && origin) {
				headers.set("Access-Control-Allow-Origin", origin);
				headers.set("Access-Control-Allow-Credentials", "true");
				headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
				headers.set("Access-Control-Allow-Headers", "Content-Type", "Authorization");
				headers.set("Access-Control-Max-Age", "86400");
			}
			return new Response(null, {
				status: 204,
				headers,
			});
		}
		
		const res = await fetchRequestHandler({
			endpoint: "/trpc",
			router: appRouter,
			req: context.request,
			createContext: () => createContext({ context }),
		});
		
		const responseHeaders = new Headers(res.headers);
		if (isAllowedOrigin && origin) {
			responseHeaders.set("Access-Control-Allow-Origin", origin);
			responseHeaders.set("Access-Control-Allow-Credentials", "true");
			responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
			responseHeaders.set("Access-Control-Allow-Headers", "Content-Type", "Authorization");
		}
		
		return new Response(res.body, {
			status: res.status,
			statusText: res.statusText,
			headers: responseHeaders,
		});
	})
	.get("/", () => "OK")
	.listen(port, () => {
		console.log(`Server is running on http://localhost:${port}`);
	});

import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
	baseURL: "http://192.168.7.112:3001", // Connect to the web server for auth (use your local IP)
	plugins: [convexClient()],
});

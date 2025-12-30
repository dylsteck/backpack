import { Elysia } from "elysia";
import { db } from "@cortex/db";
import { apps, connections } from "@cortex/db/schema/mcp";
import { eq, sql } from "drizzle-orm";

// OAuth session store (in-memory, for production use Redis or database)
interface OAuthSession {
	sessionId: string;
	serverUrl: string;
	userId: string;
	state: string;
	createdAt: number;
}

const oauthSessions = new Map<string, OAuthSession>();
const OAUTH_SESSION_TTL = 10 * 60 * 1000; // 10 minutes

function generateSessionId(): string {
	return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function generateState(): string {
	return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const mcpRoutes = new Elysia({ prefix: "/api/apps" })
	.get("/servers", async ({ set }) => {
		console.log("📡 Fetching MCP servers from database...");
		
		try {
			const servers = await db.select().from(apps);
			
			console.log(`✅ Found ${servers.length} servers in database`);
			
			// Set HTTP cache headers for 1 day
			set.headers["Cache-Control"] = "public, max-age=86400";
			
			return {
				servers: servers.map((server) => ({
					id: server.id,
					name: server.name,
					description: server.description,
					transport: server.transport,
					oauth: server.oauth,
					iconUrl: server.iconUrl,
					config: server.config,
					connectionType: server.connectionType,
				})),
			};
		} catch (error) {
			console.error("❌ Failed to fetch MCP servers from database:", error);
			set.status = 500;
			return {
				error: "Failed to fetch MCP servers",
				servers: [],
			};
		}
	})
	.get("/connections", async ({ set }) => {
		console.log("📡 Fetching connections from database...");
		
		try {
			const connectionList = await db
				.select()
				.from(connections);
			
			console.log(`✅ Found ${connectionList.length} connections in database`);
			
			return {
				connections: connectionList.map((conn) => ({
					id: conn.id,
					serverId: conn.serverId,
					serverName: conn.serverName,
					vendor: conn.vendor,
					transportType: conn.transportType,
					status: conn.status,
					credentialStorage: conn.credentialStorage,
					createdAt: conn.createdAt,
					updatedAt: conn.updatedAt,
				})),
			};
		} catch (error) {
			console.error("❌ Failed to fetch connections from database:", error);
			set.status = 500;
			return {
				error: "Failed to fetch connections",
				connections: [],
			};
		}
	})
	.get("/servers/:id", async ({ params, set }) => {
		const { id } = params;
		
		try {
			const servers = await db
				.select()
				.from(apps)
				.where(sql`${apps.id} = ${id}` as any);
			const server = servers[0];
			
			if (!server) {
				set.status = 404;
				return {
					error: "Server not found",
				};
			}
			
			// Set HTTP cache headers for 1 day
			set.headers["Cache-Control"] = "public, max-age=86400";
			
			return {
				id: server.id,
				name: server.name,
				description: server.description,
				transport: server.transport,
				oauth: server.oauth,
				iconUrl: server.iconUrl,
				config: server.config,
				connectionType: server.connectionType,
			};
		} catch (error) {
			console.error(`Failed to fetch MCP server ${id}:`, error);
			set.status = 500;
			return {
				error: "Failed to fetch MCP server",
			};
		}
	})
	// OAuth flow endpoints
	.post("/auth/connect", async ({ request }) => {
		try {
			const body = await request.json();
			const { serverUrl, callbackUrl, userId } = body as { serverUrl: string; callbackUrl: string; userId: string };
			
			if (!serverUrl || !callbackUrl || !userId) {
				return new Response(
					JSON.stringify({ error: "Missing required fields" }),
					{ status: 400, headers: { "Content-Type": "application/json" } }
				);
			}
			
			// Generate session ID and state
			const sessionId = generateSessionId();
			const state = generateState();
			
			// Store session
			oauthSessions.set(sessionId, {
				sessionId,
				serverUrl,
				userId,
				state,
				createdAt: Date.now(),
			});
			
			// Try to get OAuth metadata from the server
			try {
				const serverResponse = await fetch(`${serverUrl}/.well-known/mcp`);
				if (serverResponse.ok) {
					const metadata = (await serverResponse.json()) as {
						oauth?: {
							authorizationUrl: string;
							clientId?: string;
							tokenUrl?: string;
							redirectUri?: string;
						};
					};
					// If server has OAuth metadata, initiate OAuth flow
					if (metadata.oauth) {
						const authUrl = new URL(metadata.oauth.authorizationUrl);
						authUrl.searchParams.set("client_id", metadata.oauth.clientId || "");
						authUrl.searchParams.set("redirect_uri", callbackUrl);
						authUrl.searchParams.set("state", state);
						authUrl.searchParams.set("response_type", "code");
						
						return new Response(
							JSON.stringify({
								sessionId,
								authUrl: authUrl.toString(),
								state,
							}),
							{ headers: { "Content-Type": "application/json" } }
						);
					}
				}
			} catch (error) {
				console.warn("Could not fetch server OAuth metadata:", error);
			}
			
			// If no OAuth metadata, return session for manual setup
			return new Response(
				JSON.stringify({
					sessionId,
					requiresOAuth: false,
				}),
				{ headers: { "Content-Type": "application/json" } }
			);
		} catch (error) {
			console.error("OAuth connect error:", error);
			return new Response(
				JSON.stringify({ error: "Failed to initiate OAuth flow" }),
				{ status: 500, headers: { "Content-Type": "application/json" } }
			);
		}
	})
	.get("/auth/callback", async ({ query }) => {
		try {
			const { code, state, sessionId } = query as { code?: string; state?: string; sessionId?: string };
			
			if (!sessionId || !code || !state) {
				return new Response(
					JSON.stringify({ error: "Missing required parameters" }),
					{ status: 400, headers: { "Content-Type": "application/json" } }
				);
			}
			
			const session = oauthSessions.get(sessionId);
			if (!session) {
				return new Response(
					JSON.stringify({ error: "Invalid session" }),
					{ status: 400, headers: { "Content-Type": "application/json" } }
				);
			}
			
			// Verify state
			if (session.state !== state) {
				return new Response(
					JSON.stringify({ error: "Invalid state" }),
					{ status: 400, headers: { "Content-Type": "application/json" } }
				);
			}
			
			// Get OAuth metadata to exchange code for token
			try {
				const serverResponse = await fetch(`${session.serverUrl}/.well-known/mcp`);
				if (serverResponse.ok) {
					const metadata = (await serverResponse.json()) as {
						oauth?: {
							tokenUrl?: string;
							redirectUri?: string;
							clientId?: string;
						};
					};
					if (metadata.oauth?.tokenUrl) {
						// Exchange code for token
						const tokenResponse = await fetch(metadata.oauth.tokenUrl, {
							method: "POST",
							headers: {
								"Content-Type": "application/x-www-form-urlencoded",
							},
							body: new URLSearchParams({
								code,
								grant_type: "authorization_code",
								redirect_uri: metadata.oauth.redirectUri || "",
								client_id: metadata.oauth.clientId || "",
							}),
						});
						
						if (tokenResponse.ok) {
							const tokens = await tokenResponse.json();
							oauthSessions.delete(sessionId);
							
							return new Response(
								JSON.stringify({
									success: true,
									sessionId,
									tokens,
								}),
								{ headers: { "Content-Type": "application/json" } }
							);
						}
					}
				}
			} catch (error) {
				console.error("Token exchange error:", error);
			}
			
			// If exchange fails, return the code for manual handling
			oauthSessions.delete(sessionId);
			return new Response(
				JSON.stringify({
					success: true,
					sessionId,
					code,
					state,
				}),
				{ headers: { "Content-Type": "application/json" } }
			);
		} catch (error) {
			console.error("OAuth callback error:", error);
			return new Response(
				JSON.stringify({ error: "Failed to process OAuth callback" }),
				{ status: 500, headers: { "Content-Type": "application/json" } }
			);
		}
	});


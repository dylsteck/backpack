import { publicProcedure, router } from "../index";
import { z } from "zod";
import { db, connections, apps } from "@cortex/db";
import { eq } from "drizzle-orm";
import { encryptCredentials, decryptCredentials } from "../lib/credentials";

// Import 1Password service - try direct import first, fallback to dynamic
let onePasswordService: typeof import("../../../apps/server/src/lib/onepassword") | null = null;

async function getOnePassword() {
	if (!onePasswordService) {
		try {
			// Try direct import first (works when running in server context)
			onePasswordService = await import("../../../apps/server/src/lib/onepassword");
		} catch (error) {
			console.warn("1Password service not available:", error);
			// Return mock functions if import fails
			return {
				isAvailable: async () => false,
				saveApiKey: async () => null,
				saveOAuthTokens: async () => null,
				getSecret: async () => null,
			};
		}
	}
	return onePasswordService;
}

const transportConfigSchema = z.object({
	command: z.string().optional(),
	args: z.array(z.string()).optional(),
	url: z.string().optional(),
	headers: z.record(z.string()).optional(),
	env: z.record(z.string()).optional(),
});

export const appsRouter = router({
	// Get all available servers from database
	getAvailableServers: publicProcedure.query(async () => {
		try {
			const servers = await db.select().from(apps);
			const connectionList = await db.select().from(connections);
			
			// Create a map of serverId -> connection for quick lookup
			const connectionMap = new Map(
				connectionList.map((conn) => [conn.serverId, conn])
			);
			
			return {
				servers: servers.map((server) => {
					const connection = connectionMap.get(server.id);
					return {
						id: server.id,
						name: server.name,
						description: server.description,
						transport: server.transport,
						oauth: server.oauth,
						iconUrl: server.iconUrl,
						config: server.config,
						connectionType: server.connectionType,
						connection: connection ? {
							id: connection.id,
							status: connection.status,
							credentialStorage: connection.credentialStorage,
							secretUri: connection.secretUri,
							transportType: connection.transportType,
							transportConfig: connection.transportConfig,
						} : null,
					};
				}),
			};
		} catch (error) {
			console.error("Error in getAvailableServers:", error);
			return { servers: [] };
		}
	}),

	// Get all MCP connections
	getUserConnections: publicProcedure.query(async () => {
		const connectionList = await db
			.select()
			.from(connections);

		return connectionList;
	}),

	// Add a new MCP connection
	addConnection: publicProcedure
		.input(
			z.object({
				serverId: z.string(),
				serverName: z.string(),
				vendor: z.string().optional(),
				transportType: z.enum(["stdio", "http", "https", "sse", "streamable-http"]),
				transportConfig: transportConfigSchema,
			})
		)
		.mutation(async ({ input }) => {
			const id = crypto.randomUUID();
			const now = new Date();

			const [connection] = await db
				.insert(connections)
				.values({
					id,
					serverId: input.serverId,
					serverName: input.serverName,
					vendor: input.vendor || null,
					transportType: input.transportType,
					transportConfig: input.transportConfig,
					status: "connected",
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			return connection;
		}),

	// Update an existing MCP connection
	updateConnection: publicProcedure
		.input(
			z.object({
				id: z.string(),
				transportConfig: transportConfigSchema.optional(),
				status: z.enum(["connected", "disconnected", "error"]).optional(),
			})
		)
		.mutation(async ({ input }) => {
			const now = new Date();

			const [connection] = await db
				.update(connections)
				.set({
					transportConfig: input.transportConfig,
					status: input.status,
					updatedAt: now,
				})
				.where(eq(connections.id, input.id))
				.returning();

			return connection;
		}),

	// Remove an MCP connection
	removeConnection: publicProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => {
			await db
				.delete(connections)
				.where(eq(connections.id, input.id));

			return { success: true };
		}),

	// Save API key for an app
	saveApiKey: publicProcedure
		.input(
			z.object({
				appId: z.string(),
				apiKey: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const onePasswordService = await getOnePassword();
				const onePasswordAvailable = await onePasswordService.isAvailable();
				let secretUri: string | null = null;
				let credentialStorage: "onepassword" | "database" = "database";

				if (onePasswordAvailable) {
					// Try to save to 1Password
					secretUri = await onePasswordService.saveApiKey("Cortex", input.appId, input.apiKey);
					if (secretUri) {
						credentialStorage = "onepassword";
					}
				}

				// Get app name from apps table
				const app = await db.select().from(apps).where(eq(apps.id, input.appId)).limit(1);
				const appName = app[0]?.name || input.appId;

				// Create or update connection with credential info
				const existingConnection = await db
					.select()
					.from(connections)
					.where(eq(connections.serverId, input.appId))
					.limit(1);

				const now = new Date();
				const connectionData = {
					serverId: input.appId,
					serverName: appName,
					transportType: "http" as const,
					transportConfig: {} as any,
					status: "connected" as const,
					secretUri: secretUri || null,
					credentialStorage: credentialStorage as "onepassword" | "database",
					encryptedCredentials: null as string | null,
					updatedAt: now,
				};

				// If 1Password failed or unavailable, store encrypted in DB
				if (!secretUri) {
					// Encrypt and store credentials in database
					connectionData.credentialStorage = "database";
					connectionData.encryptedCredentials = encryptCredentials(input.apiKey);
				}

				if (existingConnection.length > 0) {
					// Update existing connection
					const [updated] = await db
						.update(connections)
						.set({
							...connectionData,
							updatedAt: now,
						})
						.where(eq(connections.serverId, input.appId))
						.returning();
					return { success: true, secretUri, credentialStorage, connection: updated };
				} else {
					// Create new connection
					const id = crypto.randomUUID();
					const [created] = await db
						.insert(connections)
						.values({
							id,
							...connectionData,
							createdAt: now,
						})
						.returning();
					return { success: true, secretUri, credentialStorage, connection: created };
				}
			} catch (error: any) {
				console.error("Error in saveApiKey mutation:", error);
				throw new Error(error?.message || "Failed to save API key");
			}
		}),

	// Save OAuth tokens for an app
	saveOAuthTokens: publicProcedure
		.input(
			z.object({
				appId: z.string(),
				tokens: z.object({
					access_token: z.string(),
					refresh_token: z.string().optional(),
					expires_in: z.number().optional(),
					token_type: z.string().optional(),
					scope: z.string().optional(),
				}),
			})
		)
		.mutation(async ({ input }) => {
			const onePasswordService = await getOnePassword();
			const onePasswordAvailable = await onePasswordService.isAvailable();
			let secretUri: string | null = null;
			let credentialStorage: "onepassword" | "database" = "database";

			if (onePasswordAvailable) {
				// Try to save to 1Password
				secretUri = await onePasswordService.saveOAuthTokens("Cortex", input.appId, input.tokens);
				if (secretUri) {
					credentialStorage = "onepassword";
				}
			}

			// Get app name from apps table
			const app = await db.select().from(apps).where(eq(apps.id, input.appId)).limit(1);
			const appName = app[0]?.name || input.appId;

			// Create or update connection with credential info
			const existingConnection = await db
				.select()
				.from(connections)
				.where(eq(connections.serverId, input.appId))
				.limit(1);

			const now = new Date();
			const connectionData = {
				serverId: input.appId,
				serverName: appName,
				transportType: "http" as const,
				transportConfig: {} as any,
				status: "connected" as const,
				secretUri: secretUri || null,
				credentialStorage: credentialStorage as "onepassword" | "database",
				encryptedCredentials: null as string | null,
				updatedAt: now,
			};

			// If 1Password failed or unavailable, store encrypted in DB
			if (!secretUri) {
				// Encrypt and store OAuth tokens in database
				const tokensJson = JSON.stringify(input.tokens);
				connectionData.credentialStorage = "database";
				connectionData.encryptedCredentials = encryptCredentials(tokensJson);
			}

			if (existingConnection.length > 0) {
				const [updated] = await db
					.update(connections)
					.set({
						...connectionData,
						updatedAt: now,
					})
					.where(eq(connections.serverId, input.appId))
					.returning();
				return { success: true, secretUri, credentialStorage, connection: updated };
			} else {
				const id = crypto.randomUUID();
				const [created] = await db
					.insert(connections)
					.values({
						id,
						...connectionData,
						createdAt: now,
					})
					.returning();
				return { success: true, secretUri, credentialStorage, connection: created };
			}
		}),

	// Get credentials for a connection (decrypted)
	getCredentials: publicProcedure
		.input(z.object({ connectionId: z.string() }))
		.query(async ({ input }) => {
			try {
				const connection = await db
					.select()
					.from(connections)
					.where(eq(connections.id, input.connectionId))
					.limit(1);

				if (connection.length === 0) {
					throw new Error("Connection not found");
				}

				const conn = connection[0];

				if (conn.credentialStorage === "onepassword") {
					if (!conn.secretUri) {
						throw new Error("No secret URI found for 1Password storage");
					}
					const onePasswordService = await getOnePassword();
					const secret = await onePasswordService.getSecret(conn.secretUri);
					return { credentials: secret, storage: "onepassword" };
				} else if (conn.credentialStorage === "database") {
					if (!conn.encryptedCredentials) {
						throw new Error("No encrypted credentials found");
					}
					const decrypted = decryptCredentials(conn.encryptedCredentials);
					return { credentials: decrypted, storage: "database" };
				} else {
					throw new Error("Unknown credential storage type");
				}
			} catch (error: any) {
				console.error("Error in getCredentials query:", error);
				throw new Error(error?.message || "Failed to retrieve credentials");
			}
		}),

	// Get secret from 1Password
	getSecret: publicProcedure
		.input(z.object({ secretUri: z.string() }))
		.query(async ({ input }) => {
			try {
				const onePasswordService = await getOnePassword();
				const secret = await onePasswordService.getSecret(input.secretUri);
				return { secret };
			} catch (error: any) {
				console.error("Error in getSecret query:", error);
				throw new Error(error?.message || "Failed to retrieve secret");
			}
		}),
});


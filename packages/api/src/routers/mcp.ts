import { publicProcedure, router } from "../index";
import { z } from "zod";
import { db, connections, apps, items } from "@cortex/db";
import { eq } from "drizzle-orm";
import { encryptCredentials, decryptCredentials } from "../lib/credentials";
import { TellerService } from "../services/teller";
import { ItemsService } from "../services/items/service";

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
			console.log("[getAvailableServers] Fetching apps and connections from database");
			const servers = await db.select().from(apps);
			const connectionList = await db.select().from(connections);
			
			console.log(`[getAvailableServers] Found ${servers.length} apps and ${connectionList.length} connections`);
			
			// Create a map of serverId -> connection for quick lookup
			const connectionMap = new Map(
				connectionList.map((conn) => [conn.serverId, conn])
			);
			
			const result = {
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
							connectionMetadata: connection.connectionMetadata,
						} : null,
					};
				}),
			};
			
			console.log(`[getAvailableServers] Returning ${result.servers.length} servers`);
			return result;
		} catch (error) {
			console.error("[getAvailableServers] Error:", error);
			console.error("[getAvailableServers] Error details:", error instanceof Error ? error.message : String(error));
			// Return empty array instead of throwing to prevent UI crash
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
				connectionMetadata: z.record(z.string(), z.unknown()).optional(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const app = await db.select().from(apps).where(eq(apps.id, input.appId)).limit(1);
				const appName = app[0]?.name || input.appId;

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
					secretUri: null,
					credentialStorage: "database" as const,
					encryptedCredentials: encryptCredentials(input.apiKey),
					connectionMetadata: input.connectionMetadata || null,
					updatedAt: now,
				};

				if (existingConnection.length > 0) {
					const [updated] = await db
						.update(connections)
						.set({
							...connectionData,
							updatedAt: now,
						})
						.where(eq(connections.serverId, input.appId))
						.returning();
					return { success: true, connection: updated };
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
					return { success: true, connection: created };
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
			const app = await db.select().from(apps).where(eq(apps.id, input.appId)).limit(1);
			const appName = app[0]?.name || input.appId;

			const existingConnection = await db
				.select()
				.from(connections)
				.where(eq(connections.serverId, input.appId))
				.limit(1);

			const now = new Date();
			const tokensJson = JSON.stringify(input.tokens);
			const connectionData = {
				serverId: input.appId,
				serverName: appName,
				transportType: "http" as const,
				transportConfig: {} as any,
				status: "connected" as const,
				secretUri: null,
				credentialStorage: "database" as const,
				encryptedCredentials: encryptCredentials(tokensJson),
				updatedAt: now,
			};

			if (existingConnection.length > 0) {
				const [updated] = await db
					.update(connections)
					.set({
						...connectionData,
						updatedAt: now,
					})
					.where(eq(connections.serverId, input.appId))
					.returning();
				return { success: true, connection: updated };
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
				return { success: true, connection: created };
			}
		}),

	// Save Teller access token
	saveTellerToken: publicProcedure
		.input(
			z.object({
				appId: z.string(),
				accessToken: z.string(),
				enrollmentId: z.string().optional(),
				institutionName: z.string().optional(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const app = await db.select().from(apps).where(eq(apps.id, input.appId)).limit(1);
				const appName = app[0]?.name || input.appId;

				const existingConnection = await db
					.select()
					.from(connections)
					.where(eq(connections.serverId, input.appId))
					.limit(1);

				const now = new Date();
				const connectionMetadata = {
					enrollmentId: input.enrollmentId,
					institution: input.institutionName ? { name: input.institutionName } : undefined,
				};

				const connectionData = {
					serverId: input.appId,
					serverName: appName,
					transportType: "https" as const,
					transportConfig: {} as any,
					status: "connected" as const,
					secretUri: null,
					credentialStorage: "database" as const,
					encryptedCredentials: encryptCredentials(input.accessToken),
					connectionMetadata: connectionMetadata as any,
					updatedAt: now,
				};

				let connectionResult;
				if (existingConnection.length > 0) {
					const [updated] = await db
						.update(connections)
						.set({
							...connectionData,
							updatedAt: now,
						})
						.where(eq(connections.serverId, input.appId))
						.returning();
					connectionResult = updated;
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
					connectionResult = created;
				}

				// Backfill Teller transactions to items table
				try {
					console.log("[saveTellerToken] Starting Teller transaction backfill...");
					const tellerService = new TellerService(input.accessToken);
					const itemsService = new ItemsService();
					
					// Get all accounts
					const accounts = await tellerService.getAccounts();
					console.log(`[saveTellerToken] Found ${accounts.length} accounts to backfill`);
					
					let totalTransactions = 0;
					
					// Fetch transactions from all accounts (with pagination)
					for (const account of accounts) {
						let fromId: string | undefined = undefined;
						let hasMore = true;
						let pageCount = 0;
						const maxPages = 50; // Limit to prevent infinite loops
						
						while (hasMore && pageCount < maxPages) {
							const transactions = await tellerService.getTransactions(account.id, {
								count: 500, // Fetch 500 at a time
								from_id: fromId,
							});
							
							if (transactions.length === 0) {
								hasMore = false;
								break;
							}
							
							// Save each transaction to items table
							for (const transaction of transactions) {
								try {
									// Use transaction ID as item ID to prevent duplicates
									const itemId = `teller_${transaction.id}`;
									
									// Try to insert - database will handle duplicate key errors
									try {
										await db.insert(items).values({
											id: itemId,
											source: "teller",
											type: "transaction",
											timestamp: new Date(transaction.date),
											data: transaction as any,
											createdAt: now,
											updatedAt: now,
										});
										totalTransactions++;
									} catch (insertError: any) {
										// Ignore duplicate key errors (PostgreSQL error code 23505)
										if (insertError?.code === "23505" || insertError?.message?.includes("duplicate") || insertError?.message?.includes("unique")) {
											// Item already exists, skip
											continue;
										}
										// Re-throw other errors
										throw insertError;
									}
								} catch (itemError) {
									console.error(`[saveTellerToken] Error saving transaction ${transaction.id}:`, itemError);
									// Continue with next transaction
								}
							}
							
							// Set fromId for next page (use last transaction ID)
							if (transactions.length > 0) {
								fromId = transactions[transactions.length - 1].id;
								pageCount++;
							} else {
								hasMore = false;
							}
							
							// If we got fewer than requested, we're done
							if (transactions.length < 500) {
								hasMore = false;
							}
						}
					}
					
					console.log(`[saveTellerToken] Backfill complete: ${totalTransactions} transactions saved to items table`);
				} catch (backfillError) {
					// Log error but don't fail the connection save
					console.error("[saveTellerToken] Error during backfill:", backfillError);
				}

				return { success: true, connection: connectionResult };
			} catch (error: any) {
				console.error("Error in saveTellerToken mutation:", error);
				throw new Error(error?.message || "Failed to save Teller token");
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

					if (!conn.encryptedCredentials) {
						throw new Error("No encrypted credentials found");
					}

					const decrypted = decryptCredentials(conn.encryptedCredentials);
				return { credentials: decrypted };
			} catch (error: any) {
				console.error("Error in getCredentials query:", error);
				throw new Error(error?.message || "Failed to retrieve credentials");
			}
		}),

	// Connect Chrome browser history
	connectChrome: publicProcedure
		.input(
			z.object({
				appId: z.string(),
				localPath: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const app = await db.select().from(apps).where(eq(apps.id, input.appId)).limit(1);
				const appName = app[0]?.name || input.appId;

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
					secretUri: null,
					credentialStorage: "database" as const,
					encryptedCredentials: null as string | null,
					connectionMetadata: { localPath: input.localPath } as any,
					updatedAt: now,
				};

				if (existingConnection.length > 0) {
					const [updated] = await db
						.update(connections)
						.set({
							...connectionData,
							updatedAt: now,
						})
						.where(eq(connections.serverId, input.appId))
						.returning();
					return { success: true, connection: updated };
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
					return { success: true, connection: created };
				}
			} catch (error: any) {
				console.error("Error in connectChrome mutation:", error);
				throw new Error(error?.message || "Failed to connect Chrome");
			}
		}),

	// Connect Brave browser history
	connectBrave: publicProcedure
		.input(
			z.object({
				appId: z.string(),
				localPath: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const app = await db.select().from(apps).where(eq(apps.id, input.appId)).limit(1);
				const appName = app[0]?.name || input.appId;

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
					secretUri: null,
					credentialStorage: "database" as const,
					encryptedCredentials: null as string | null,
					connectionMetadata: { localPath: input.localPath } as any,
					updatedAt: now,
				};

				if (existingConnection.length > 0) {
					const [updated] = await db
						.update(connections)
						.set({
							...connectionData,
							updatedAt: now,
						})
						.where(eq(connections.serverId, input.appId))
						.returning();
					return { success: true, connection: updated };
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
					return { success: true, connection: created };
				}
			} catch (error: any) {
				console.error("Error in connectBrave mutation:", error);
				throw new Error(error?.message || "Failed to connect Brave");
			}
		}),
});


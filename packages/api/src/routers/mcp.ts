import { publicProcedure, router } from "../index";
import { z } from "zod";
import { getDatabase, connections, apps, items } from "@backpack/db";
import { eq } from "drizzle-orm";
import { encryptCredentials, decryptCredentials } from "../lib/credentials";
import { TellerService } from "../services/teller";

// Track running backfills to prevent duplicates
const runningBackfills = new Set<string>();

// Track backfill cancellation controllers
const backfillControllers = new Map<string, AbortController>();

// Helper to generate backfill key
function getBackfillKey(appId: string, fid?: string): string {
	return fid ? `${appId}:${fid}` : appId;
}

const transportConfigSchema = z.object({
	command: z.string().optional(),
	args: z.array(z.string()).optional(),
	url: z.string().optional(),
	headers: z.record(z.string(), z.string()).optional(),
	env: z.record(z.string(), z.string()).optional(),
});

// Helper to serialize connection objects (convert Date to ISO string for JSON serialization)
function serializeConnection(conn: any) {
	if (!conn) return null;
	return {
		...conn,
		createdAt: conn.createdAt instanceof Date ? conn.createdAt.toISOString() : conn.createdAt,
		updatedAt: conn.updatedAt instanceof Date ? conn.updatedAt.toISOString() : conn.updatedAt,
		lastSyncedAt: conn.lastSyncedAt instanceof Date ? conn.lastSyncedAt.toISOString() : conn.lastSyncedAt,
	};
}

export const appsRouter = router({
	// Get all available servers from database
	getAvailableServers: publicProcedure.query(async () => {
		try {
			console.log("[getAvailableServers] Fetching apps and connections from database");
			const db = getDatabase();
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
		const db = getDatabase();
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
			const db = getDatabase();
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
			const db = getDatabase();
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
			const db = getDatabase();
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
				const db = getDatabase();
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

				// Backfill Farcaster casts to items table (run async, don't block response)
				if (input.appId === "farcaster" && input.connectionMetadata?.fid) {
					const fid = parseInt(input.connectionMetadata.fid as string);
					if (isNaN(fid)) {
						console.error("[saveApiKey] Invalid FID:", input.connectionMetadata.fid);
					} else {
						const backfillKey = getBackfillKey("farcaster", fid.toString());
						
						// Prevent duplicate backfills
						if (runningBackfills.has(backfillKey)) {
							console.log(`[saveApiKey] Backfill already running for ${backfillKey}, skipping...`);
						} else {
							// Mark as running
							runningBackfills.add(backfillKey);
							
							// Create abort controller for cancellation
							const abortController = new AbortController();
							backfillControllers.set(backfillKey, abortController);
							
							// Run backfill asynchronously so it doesn't block the connection response
							(async () => {
								const startTime = Date.now();
								const MAX_BACKFILL_TIME_MS = 10 * 60 * 1000; // 10 minutes max
								const seenCursors = new Set<string>();
								
								try {
									console.log("[saveApiKey] Starting Farcaster casts backfill...");
									const { FarcasterService } = await import("../services/farcaster");
									
									const farcasterService = new FarcasterService(input.apiKey);
									
									let cursor: string | undefined = undefined;
									let hasMore = true;
									let pageCount = 0;
									const maxPages = 100; // Limit to prevent infinite loops
									let totalCasts = 0;
									let newCasts = 0;
									let duplicateCasts = 0;
									
									while (hasMore && pageCount < maxPages) {
										// Check for cancellation
										if (abortController.signal.aborted) {
											console.log(`[saveApiKey] Backfill cancelled by user`);
											break;
										}
										
										// Check timeout
										if (Date.now() - startTime > MAX_BACKFILL_TIME_MS) {
											console.warn(`[saveApiKey] Backfill timeout after ${MAX_BACKFILL_TIME_MS}ms, stopping...`);
											break;
										}
										
										// Prevent cursor loops - if we've seen this cursor before, stop
										if (cursor && seenCursors.has(cursor)) {
											console.warn(`[saveApiKey] Detected cursor loop (seen cursor: ${cursor}), stopping backfill`);
											break;
										}
										if (cursor) {
											seenCursors.add(cursor);
										}
										
										pageCount++;
										console.log(`[saveApiKey] Fetching page ${pageCount} of Farcaster casts...`);
										
										const response = await farcasterService.getUserCasts({
											fid,
											limit: 100, // Fetch 100 at a time
											cursor,
											include_replies: true,
										});
										
										if (!response.casts || response.casts.length === 0) {
											hasMore = false;
											break;
										}
										
										console.log(`[saveApiKey] Saving ${response.casts.length} casts to database...`);
										
										// Save each cast to items table
										for (const cast of response.casts) {
											try {
												// Use cast hash as item ID to prevent duplicates
												const itemId = `farcaster_${cast.hash}`;
												
												// Try to insert - database will handle duplicate key errors
												try {
													await db.insert(items).values({
														id: itemId,
														source: "farcaster",
														type: "cast",
														timestamp: new Date(cast.timestamp),
														data: cast as any,
														createdAt: new Date(),
														updatedAt: new Date(),
													});
													totalCasts++;
													newCasts++;
												} catch (insertError: any) {
													// Ignore duplicate key errors (PostgreSQL error code 23505)
													if (insertError?.code === "23505" || insertError?.message?.includes("duplicate") || insertError?.message?.includes("unique")) {
														// Item already exists, skip
														duplicateCasts++;
														continue;
													}
													// Re-throw other errors
													throw insertError;
												}
											} catch (itemError) {
												console.error(`[saveApiKey] Error saving cast ${cast.hash}:`, itemError);
												// Continue with next cast
											}
										}
										
										// If we're getting mostly duplicates (90%+), we've likely already backfilled
										if (response.casts.length > 0 && duplicateCasts / (newCasts + duplicateCasts) > 0.9 && pageCount > 3) {
											console.log(`[saveApiKey] Getting mostly duplicates (${duplicateCasts}/${duplicateCasts + newCasts}), likely already backfilled. Stopping...`);
											hasMore = false;
											break;
										}
										
										// Set cursor for next page
										if (response.next?.cursor) {
											const nextCursor = response.next.cursor;
											// Safety check: if cursor hasn't changed, stop
											if (nextCursor === cursor) {
												console.warn(`[saveApiKey] Cursor unchanged (${nextCursor}), stopping backfill`);
												hasMore = false;
												break;
											}
											cursor = nextCursor;
											console.log(`[saveApiKey] Page ${pageCount} complete, ${newCasts} new casts saved (${duplicateCasts} duplicates skipped)...`);
										} else {
											hasMore = false;
										}
										
										// If we got fewer than requested, we're done
										if (response.casts.length < 100) {
											hasMore = false;
										}
									}
									
									const duration = ((Date.now() - startTime) / 1000).toFixed(1);
									console.log(`[saveApiKey] ✅ Farcaster backfill complete: ${newCasts} new casts saved (${duplicateCasts} duplicates skipped) in ${duration}s`);
								} catch (backfillError) {
									// Log error but don't fail the connection save
									console.error("[saveApiKey] ❌ Error during Farcaster backfill:", backfillError);
									if (backfillError instanceof Error) {
										console.error("[saveApiKey] Error details:", backfillError.message, backfillError.stack);
									}
								} finally {
									// Always remove from running set and controller
									runningBackfills.delete(backfillKey);
									backfillControllers.delete(backfillKey);
								}
							})();
						}
					}
				}

				return { success: true, connection: serializeConnection(connectionResult) };
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
			const db = getDatabase();
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
				return { success: true, connection: serializeConnection(updated) };
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
				return { success: true, connection: serializeConnection(created) };
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
				const db = getDatabase();
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

				// Backfill Teller transactions to items table (run async, don't block response)
				const tellerBackfillKey = getBackfillKey("teller", input.enrollmentId);
				
				// Prevent duplicate backfills
				if (runningBackfills.has(tellerBackfillKey)) {
					console.log(`[saveTellerToken] Backfill already running for ${tellerBackfillKey}, skipping...`);
				} else {
					// Mark as running
					runningBackfills.add(tellerBackfillKey);
					
					// Run backfill asynchronously so it doesn't block the connection response
					(async () => {
						const startTime = Date.now();
						const MAX_BACKFILL_TIME_MS = 10 * 60 * 1000; // 10 minutes max
						const seenFromIds = new Set<string>();
						
						try {
							console.log("[saveTellerToken] Starting Teller transaction backfill...");
							const tellerService = new TellerService(input.accessToken);
							
							// Get all accounts
							const accounts = await tellerService.getAccounts();
							console.log(`[saveTellerToken] Found ${accounts.length} accounts to backfill`);
							
							let totalTransactions = 0;
							let newTransactions = 0;
							let duplicateTransactions = 0;
							
							// Fetch transactions from all accounts (with pagination)
							for (const account of accounts) {
								let fromId: string | undefined = undefined;
								let hasMore = true;
								let pageCount = 0;
								const maxPages = 50; // Limit to prevent infinite loops
								
								while (hasMore && pageCount < maxPages) {
									// Check timeout
									if (Date.now() - startTime > MAX_BACKFILL_TIME_MS) {
										console.warn(`[saveTellerToken] Backfill timeout after ${MAX_BACKFILL_TIME_MS}ms, stopping...`);
										hasMore = false;
										break;
									}
									
									// Prevent fromId loops - if we've seen this fromId before, stop
									if (fromId && seenFromIds.has(fromId)) {
										console.warn(`[saveTellerToken] Detected fromId loop (seen fromId: ${fromId}), stopping backfill for account ${account.id}`);
										hasMore = false;
										break;
									}
									if (fromId) {
										seenFromIds.add(fromId);
									}
									
									pageCount++;
									console.log(`[saveTellerToken] Fetching page ${pageCount} for account ${account.id}...`);
									
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
													createdAt: new Date(),
													updatedAt: new Date(),
												});
												totalTransactions++;
												newTransactions++;
											} catch (insertError: any) {
												// Ignore duplicate key errors (PostgreSQL error code 23505)
												if (insertError?.code === "23505" || insertError?.message?.includes("duplicate") || insertError?.message?.includes("unique")) {
													// Item already exists, skip
													duplicateTransactions++;
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
									
									// If we're getting mostly duplicates (90%+), we've likely already backfilled
									if (transactions.length > 0 && duplicateTransactions / (newTransactions + duplicateTransactions) > 0.9 && pageCount > 3) {
										console.log(`[saveTellerToken] Getting mostly duplicates (${duplicateTransactions}/${duplicateTransactions + newTransactions}), likely already backfilled. Stopping account ${account.id}...`);
										hasMore = false;
										break;
									}
									
									// Set fromId for next page (use last transaction ID)
									if (transactions.length > 0) {
										const lastTransactionId = transactions[transactions.length - 1]?.id;
										if (!lastTransactionId) {
											hasMore = false;
											break;
										}
										// Safety check: if fromId hasn't changed, stop
										if (lastTransactionId === fromId) {
											console.warn(`[saveTellerToken] fromId unchanged (${fromId}), stopping backfill for account ${account.id}`);
											hasMore = false;
											break;
										}
										fromId = lastTransactionId;
										console.log(`[saveTellerToken] Page ${pageCount} complete for account ${account.id}, ${newTransactions} new transactions saved (${duplicateTransactions} duplicates skipped)...`);
									} else {
										hasMore = false;
									}
									
									// If we got fewer than requested, we're done
									if (transactions.length < 500) {
										hasMore = false;
									}
								}
							}
							
							const duration = ((Date.now() - startTime) / 1000).toFixed(1);
							console.log(`[saveTellerToken] ✅ Backfill complete: ${newTransactions} new transactions saved (${duplicateTransactions} duplicates skipped) in ${duration}s`);
						} catch (backfillError) {
							console.error("[saveTellerToken] ❌ Error during backfill:", backfillError);
							if (backfillError instanceof Error) {
								console.error("[saveTellerToken] Error details:", backfillError.message, backfillError.stack);
							}
						} finally {
							// Always remove from running set
							runningBackfills.delete(tellerBackfillKey);
						}
					})();
				}

				return { success: true, connection: serializeConnection(connectionResult) };
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
				if (!conn) {
					throw new Error("Connection not found");
				}

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
				const db = getDatabase();
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
					return { success: true, connection: serializeConnection(updated) };
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
					return { success: true, connection: serializeConnection(created) };
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
				const db = getDatabase();
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
					return { success: true, connection: serializeConnection(updated) };
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
					return { success: true, connection: serializeConnection(created) };
				}
			} catch (error: any) {
				console.error("Error in connectBrave mutation:", error);
				throw new Error(error?.message || "Failed to connect Brave");
			}
		}),

	// Connect Obsidian vault
	connectObsidian: publicProcedure
		.input(
			z.object({
				appId: z.string(),
				vaultPath: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			try {
				const db = getDatabase();
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
					connectionMetadata: { localPath: input.vaultPath } as any,
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
					return { success: true, connection: serializeConnection(updated) };
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
					return { success: true, connection: serializeConnection(created) };
				}
			} catch (error: any) {
				console.error("Error in connectObsidian mutation:", error);
				throw new Error(error?.message || "Failed to connect Obsidian vault");
			}
		}),

	// Stop a running backfill
	stopBackfill: publicProcedure
		.input(
			z.object({
				appId: z.string(),
				fid: z.string().optional(),
			})
		)
		.mutation(async ({ input }) => {
			const backfillKey = getBackfillKey(input.appId, input.fid);
			const controller = backfillControllers.get(backfillKey);
			
			if (controller && !controller.signal.aborted) {
				controller.abort();
				console.log(`[stopBackfill] Cancelled backfill for ${backfillKey}`);
				return { success: true, message: "Backfill stopped" };
			}
			
			return { success: false, message: "No running backfill found" };
		}),
});


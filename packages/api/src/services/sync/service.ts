import { db, connections, items } from "@cortex/db";
import { eq } from "drizzle-orm";
import { decryptCredentials } from "../../lib/credentials";
import { FarcasterService } from "../farcaster/service";
import { TellerService } from "../teller/service";
import type { FarcasterCastV2 } from "../farcaster/types";
import type { TellerTransaction } from "../teller/types";

export interface SyncResult {
	success: boolean;
	appId: string;
	newItems: number;
	error?: string;
}

export class SyncService {
	private isSyncing = false;

	/**
	 * Check if error is a duplicate key error
	 */
	private isDuplicateKeyError(error: any): boolean {
		if (!error) return false;
		
		// Check error code directly
		if (error.code === "23505") return true;
		
		// Check error message
		const message = error.message || "";
		if (message.includes("duplicate") || message.includes("unique constraint")) return true;
		
		// Check nested error (DrizzleQueryError wraps the original)
		if (error.cause) {
			return this.isDuplicateKeyError(error.cause);
		}
		
		// Check if it's a DrizzleQueryError with nested error
		if (error.originalError) {
			return this.isDuplicateKeyError(error.originalError);
		}
		
		return false;
	}

	/**
	 * Sync Farcaster casts for a connection
	 */
	async syncFarcaster(connection: typeof connections.$inferSelect): Promise<SyncResult> {
		const appId = connection.serverId;
		const lastSyncedAt = (connection as any).lastSyncedAt as Date | null | undefined;
		
		if (!connection.encryptedCredentials) {
			return {
				success: false,
				appId,
				newItems: 0,
				error: "Missing credentials",
			};
		}

		const fid = connection.connectionMetadata?.fid as string | number | undefined;
		if (!fid) {
			return {
				success: false,
				appId,
				newItems: 0,
				error: "Missing FID",
			};
		}

		try {
			const apiKey = decryptCredentials(connection.encryptedCredentials);
			const farcasterService = new FarcasterService(apiKey);
			
			let newCasts = 0;
			let cursor: string | undefined = undefined;
			let hasMore = true;
			let pageCount = 0;
			const maxPages = 50; // Limit pages for incremental sync
			
			// If no last sync, fetch last 30 days
			const syncStartTime = lastSyncedAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			
			while (hasMore && pageCount < maxPages) {
				pageCount++;
				
				const response = await farcasterService.getUserCasts({
					fid: typeof fid === 'string' ? parseInt(fid) : fid,
					limit: 100,
					cursor,
					include_replies: true,
				});

				if (!response.casts || response.casts.length === 0) {
					hasMore = false;
					break;
				}

				// Filter casts newer than last sync
				const newCastsInPage = response.casts.filter((cast: FarcasterCastV2) => {
					const castTime = new Date(cast.timestamp);
					return castTime >= syncStartTime;
				});

				// If we hit casts older than sync time, we're done
				if (newCastsInPage.length === 0 && response.casts.length > 0) {
					// Check if oldest cast is before sync time
					const oldestCast = response.casts[response.casts.length - 1];
					if (new Date(oldestCast.timestamp) < syncStartTime) {
						hasMore = false;
						break;
					}
				}

				// Save new casts
				for (const cast of newCastsInPage) {
					try {
						const itemId = `farcaster_${cast.hash}`;
						
						await db.insert(items).values({
							id: itemId,
							source: "farcaster",
							type: "cast",
							timestamp: new Date(cast.timestamp),
							data: cast as any,
							createdAt: new Date(),
							updatedAt: new Date(),
						});
						newCasts++;
					} catch (itemError: any) {
						// Silently ignore duplicate key errors
						if (this.isDuplicateKeyError(itemError)) {
							// Item already exists, skip it silently
							continue;
						}
						// Log and continue for other errors
						console.error(`[SyncService] Error saving cast ${cast.hash}:`, itemError);
					}
				}

				// Set cursor for next page
				if (response.next?.cursor) {
					cursor = response.next.cursor;
				} else {
					hasMore = false;
				}

				// If we got fewer than requested, we're done
				if (response.casts.length < 100) {
					hasMore = false;
				}
			}

			// Update lastSyncedAt
			await db.update(connections)
				.set({ 
					lastSyncedAt: new Date(),
					updatedAt: new Date(),
				} as any)
				.where(eq(connections.id, connection.id));

			return {
				success: true,
				appId,
				newItems: newCasts,
			};
		} catch (error: any) {
			console.error(`[SyncService] Error syncing Farcaster:`, error);
			return {
				success: false,
				appId,
				newItems: 0,
				error: error?.message || "Unknown error",
			};
		}
	}

	/**
	 * Sync Teller transactions for a connection
	 */
	async syncTeller(connection: typeof connections.$inferSelect): Promise<SyncResult> {
		const appId = connection.serverId;
		const lastSyncedAt = (connection as any).lastSyncedAt as Date | null | undefined;
		
		if (!connection.encryptedCredentials) {
			return {
				success: false,
				appId,
				newItems: 0,
				error: "Missing credentials",
			};
		}

		try {
			const accessToken = decryptCredentials(connection.encryptedCredentials);
			const tellerService = new TellerService(accessToken);
			
			// Get all accounts
			const accounts = await tellerService.getAccounts();
			
			let newTransactions = 0;
			
			// If no last sync, fetch last 30 days
			const syncStartTime = lastSyncedAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			
			// Fetch transactions from all accounts
			for (const account of accounts) {
				let fromId: string | undefined = undefined;
				let hasMore = true;
				let pageCount = 0;
				const maxPages = 20; // Limit pages for incremental sync
				
				while (hasMore && pageCount < maxPages) {
					pageCount++;
					
					const transactions = await tellerService.getTransactions(account.id, {
						count: 500,
						from_id: fromId,
					});

					if (transactions.length === 0) {
						hasMore = false;
						break;
					}

					// Filter transactions newer than last sync
					const newTransactionsInPage = transactions.filter((tx: TellerTransaction) => {
						const txTime = new Date(tx.date);
						return txTime >= syncStartTime;
					});

					// If we hit transactions older than sync time, we're done
					if (newTransactionsInPage.length === 0 && transactions.length > 0) {
						const oldestTx = transactions[transactions.length - 1];
						if (oldestTx && new Date(oldestTx.date) < syncStartTime) {
							hasMore = false;
							break;
						}
					}

					// Save new transactions
					for (const transaction of newTransactionsInPage) {
						try {
							const itemId = `teller_${transaction.id}`;
							
							await db.insert(items).values({
								id: itemId,
								source: "teller",
								type: "transaction",
								timestamp: new Date(transaction.date),
								data: transaction as any,
								createdAt: new Date(),
								updatedAt: new Date(),
							});
							newTransactions++;
						} catch (itemError: any) {
							// Silently ignore duplicate key errors
							if (this.isDuplicateKeyError(itemError)) {
								// Item already exists, skip it silently
								continue;
							}
							// Log and continue for other errors
							console.error(`[SyncService] Error saving transaction ${transaction.id}:`, itemError);
						}
					}

					// Set fromId for next page
					if (transactions.length > 0) {
						const lastTransactionId = transactions[transactions.length - 1]?.id;
						if (!lastTransactionId || lastTransactionId === fromId) {
							hasMore = false;
							break;
						}
						fromId = lastTransactionId;
					} else {
						hasMore = false;
					}

					// If we got fewer than requested, we're done
					if (transactions.length < 500) {
						hasMore = false;
					}
				}
			}

			// Update lastSyncedAt
			await db.update(connections)
				.set({ 
					lastSyncedAt: new Date(),
					updatedAt: new Date(),
				} as any)
				.where(eq(connections.id, connection.id));

			return {
				success: true,
				appId,
				newItems: newTransactions,
			};
		} catch (error: any) {
			console.error(`[SyncService] Error syncing Teller:`, error);
			return {
				success: false,
				appId,
				newItems: 0,
				error: error?.message || "Unknown error",
			};
		}
	}

	/**
	 * Sync a specific app by appId
	 */
	async syncApp(appId: string): Promise<SyncResult> {
		const connection = await db.select()
			.from(connections)
			.where(eq(connections.serverId, appId))
			.then(conns => conns.find(c => c.status === "connected"));

		if (!connection) {
			return {
				success: false,
				appId,
				newItems: 0,
				error: "No connected connection found",
			};
		}

		if (appId === "farcaster") {
			return await this.syncFarcaster(connection);
		} else if (appId === "teller") {
			return await this.syncTeller(connection);
		}

		return {
			success: false,
			appId,
			newItems: 0,
			error: "Unsupported app type",
		};
	}

	/**
	 * Sync all connected apps
	 */
	async syncAllConnections(): Promise<SyncResult[]> {
		// Prevent concurrent syncs
		if (this.isSyncing) {
			console.log("[SyncService] Sync already in progress, skipping...");
			return [];
		}

		this.isSyncing = true;
		try {
			const allConnections = await db.select()
				.from(connections)
				.where(eq(connections.status, "connected"));

			const results: SyncResult[] = [];

			for (const connection of allConnections) {
				try {
					if (connection.serverId === "farcaster") {
						const result = await this.syncFarcaster(connection);
						results.push(result);
					} else if (connection.serverId === "teller") {
						const result = await this.syncTeller(connection);
						results.push(result);
					}
				} catch (error: any) {
					console.error(`[SyncService] Error syncing ${connection.serverId}:`, error);
					results.push({
						success: false,
						appId: connection.serverId,
						newItems: 0,
						error: error?.message || "Unknown error",
					});
				}
			}

			return results;
		} finally {
			this.isSyncing = false;
		}
	}
}


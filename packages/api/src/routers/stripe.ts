import { publicProcedure, router } from "../index";
import { z } from "zod";
import { db, connections, apps } from "@cortex/db";
import { eq } from "drizzle-orm";
import { StripeService } from "../services/stripe/service";
import { ItemsService } from "../services/items/service";
import { encryptCredentials } from "../lib/credentials";

// TODO: Future background refresh functionality
// Consider creating a separate function `syncAllAccountTransactions()` that can be called from:
// - Scheduled cron jobs (e.g., every hour/day)
// - Webhook handlers for account refresh events
// - On-demand background tasks
// This would allow syncing transactions without blocking the UI

export const stripeRouter = router({
	createFinancialConnectionsSession: publicProcedure
		.input(
			z.object({
				email: z.string().email().optional(),
				returnUrl: z.string().url(),
			})
		)
		.mutation(async ({ input }) => {
			const stripeService = new StripeService();

			// Create or get customer
			const customer = await stripeService.createOrGetCustomer(input.email);

			// Create Financial Connections session
			const session = await stripeService.createFinancialConnectionsSession(
				customer.id,
				["transactions", "balances", "ownership"],
				input.returnUrl
			);

			if (!session.client_secret) {
				throw new Error("Failed to create Financial Connections session: no client_secret returned");
			}

			console.log("Created Stripe FC session:", {
				sessionId: session.id,
				hasClientSecret: !!session.client_secret,
				clientSecretPrefix: session.client_secret?.substring(0, 20),
			});

			return {
				client_secret: session.client_secret,
				customer_id: customer.id,
				session_id: session.id,
			};
		}),

	getConnectedAccounts: publicProcedure
		.input(
			z.object({
				customerId: z.string().optional(),
			})
		)
		.query(async ({ input }) => {
			// Get Stripe connection from database
			const stripeConnections = await db
				.select()
				.from(connections)
				.where(eq(connections.serverId, "stripe"));

			const connection = stripeConnections.find((conn) => conn.status === "connected");

			if (!connection || !connection.connectionMetadata) {
				return { accounts: [] };
			}

			const accountIds = (connection.connectionMetadata as any).accountIds as string[] | undefined;
			if (!accountIds || accountIds.length === 0) {
				return { accounts: [] };
			}

			// Fetch account details from Stripe
			const stripeService = new StripeService();
			const accounts = await Promise.all(
				accountIds.map((id) => stripeService.getFinancialConnectionsAccount(id))
			);

			return { accounts };
		}),

	syncAccountTransactions: publicProcedure
		.input(
			z.object({
				accountId: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			const stripeService = new StripeService();
			const itemsService = new ItemsService();

			console.log(`[Stripe] Syncing transactions for account ${input.accountId}`);

			try {
				// First, subscribe/refresh transactions if needed
				// According to Stripe docs, you must refresh to subscribe to transaction data
				// https://docs.stripe.com/financial-connections/transactions#subscribe-to-transaction-data
				const refreshResult = await stripeService.refreshAccountTransactions(input.accountId);
				
				if (refreshResult && refreshResult.status === "pending") {
					// Refresh is in progress, wait a bit for it to complete
					console.log(`[Stripe] Transaction refresh is pending, waiting for completion...`);
					// Poll for completion (max 30 seconds)
					let attempts = 0;
					while (attempts < 30) {
						await new Promise(resolve => setTimeout(resolve, 1000));
						const account = await stripeService.getFinancialConnectionsAccount(input.accountId);
						// Re-fetch account to check refresh status
						const fullAccount = await (stripeService as any).stripe.financialConnections.accounts.retrieve(input.accountId);
						if (fullAccount.transaction_refresh?.status === "succeeded") {
							console.log(`[Stripe] Transaction refresh completed successfully`);
							// After refresh succeeds, wait a bit longer for transactions to be available
							console.log(`[Stripe] Waiting 3 seconds for transactions to be available after refresh...`);
							await new Promise(resolve => setTimeout(resolve, 3000));
							break;
						} else if (fullAccount.transaction_refresh?.status === "failed") {
							console.log(`[Stripe] Transaction refresh failed: ${fullAccount.transaction_refresh.last_error?.message || "Unknown error"}`);
							break;
						}
						attempts++;
					}
				} else if (refreshResult && refreshResult.status === "succeeded") {
					// Refresh already succeeded, but we might want to trigger a new refresh to get more historical data
					console.log(`[Stripe] Account already has successful refresh. Note: Stripe may only return transactions available at connection time.`);
				} else if (!refreshResult) {
					console.log(`[Stripe] Could not refresh transactions, but continuing to try fetching anyway`);
				}

				// Fetch all transactions from Stripe using pagination
				// Stripe uses cursor-based pagination where the last transaction ID becomes the starting_after cursor
				const MAX_TRANSACTIONS = 10000; // Safety limit to prevent runaway loops
				let allTransactions: any[] = [];
				let startingAfter: string | undefined = undefined;
				let hasMore = true;
				let pageCount = 0;

				console.log(`[Stripe] Starting paginated fetch for account ${input.accountId}`);

				while (hasMore && allTransactions.length < MAX_TRANSACTIONS) {
					const result = await stripeService.getAccountTransactions(input.accountId, {
						limit: 100, // Stripe's max per page
						starting_after: startingAfter,
					});

					allTransactions.push(...result.data);
					hasMore = result.has_more;
					startingAfter = result.data.length > 0 ? result.data[result.data.length - 1].id : undefined;
					pageCount++;

					console.log(`[Stripe] Fetched page ${pageCount}, ${result.data.length} transactions (total: ${allTransactions.length}, has_more: ${result.has_more})`);

					// If we hit the safety limit, log a warning
					if (allTransactions.length >= MAX_TRANSACTIONS && hasMore) {
						console.warn(`[Stripe] Reached safety limit of ${MAX_TRANSACTIONS} transactions. More transactions may be available.`);
						break;
					}

					// Log if pagination stopped naturally (has_more = false)
					if (!result.has_more && result.data.length > 0) {
						console.log(`[Stripe] Pagination complete: Stripe returned ${result.data.length} transactions on final page, has_more=false`);
					}
				}

				console.log(`[Stripe] Finished fetching: ${allTransactions.length} total transactions across ${pageCount} page(s)`);
				
				// Log transaction date range for debugging
				if (allTransactions.length > 0) {
					const dates = allTransactions.map(tx => new Date(tx.transacted_at * 1000)).sort((a, b) => a.getTime() - b.getTime());
					const oldest = dates[0];
					const newest = dates[dates.length - 1];
					console.log(`[Stripe] Transaction date range: ${oldest.toISOString()} to ${newest.toISOString()} (${Math.round((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))} days)`);
				}

				// Store all transactions in items table
				const created = await itemsService.syncStripeTransactions(input.accountId, allTransactions);

				console.log(`[Stripe] Created ${created} new transaction items in database (${allTransactions.length - created} were duplicates)`);

				return {
					success: true,
					transactions_synced: created,
					total_fetched: allTransactions.length,
					pages_fetched: pageCount,
					...(allTransactions.length >= MAX_TRANSACTIONS && hasMore ? { warning: `Reached safety limit of ${MAX_TRANSACTIONS} transactions` } : {}),
				};
			} catch (error: any) {
				console.error(`[Stripe] Error syncing transactions for account ${input.accountId}:`, error);
				
				// Check if it's the "no transactions" error
				const errorMessage = error?.message || String(error);
				if (errorMessage.includes("no transactions") || errorMessage.includes("subscribe to transactions")) {
					// This is expected for accounts with no transactions - return success with 0 synced
					console.log(`[Stripe] Account ${input.accountId} has no transactions available`);
					return {
						success: true,
						transactions_synced: 0,
						total_fetched: 0,
						message: "Account has no transactions to retrieve. This is normal for new accounts or accounts without recent activity.",
					};
				}
				
				// Re-throw other errors
				throw error;
			}
		}),

	getAccountTransactions: publicProcedure
		.input(
			z.object({
				accountId: z.string().optional(),
				cursor: z.string().optional(),
				limit: z.number().optional().default(25),
			})
		)
		.query(async ({ input }) => {
			const itemsService = new ItemsService();

			const params: any = {
				source: "stripe",
				type: "transaction",
				limit: input.limit,
				cursor: input.cursor,
			};

			// If accountId is provided, filter by account_id in data
			// Note: This requires querying the JSONB data field
			// For now, we'll get all stripe transactions and filter client-side if needed
			// In production, you'd want a proper JSONB query

			const result = await itemsService.getItems(params);

			// Filter by accountId if provided
			let filteredItems = result.items;
			if (input.accountId) {
				filteredItems = result.items.filter(
					(item) => (item.data as any).account_id === input.accountId
				);
			}

			return {
				items: filteredItems,
				nextCursor: result.nextCursor,
			};
		}),

	// Save connected accounts after OAuth completion
	saveConnectedAccounts: publicProcedure
		.input(
			z.object({
				accountIds: z.array(z.string()),
				customerId: z.string(),
			})
		)
		.mutation(async ({ input }) => {
			const now = new Date();

			// Check if connection exists
			const existingConnections = await db
				.select()
				.from(connections)
				.where(eq(connections.serverId, "stripe"));

			const stripeApp = await db.select().from(apps).where(eq(apps.id, "stripe")).limit(1);

			if (stripeApp.length === 0) {
				throw new Error("Stripe app not found in database");
			}

			// Fetch account details from Stripe to store display names
			const stripeService = new StripeService();
			const accountDetails = await Promise.all(
				input.accountIds.map(async (id) => {
					try {
						const account = await stripeService.getFinancialConnectionsAccount(id);
						return {
							id: account.id,
							display_name: account.display_name,
							institution_name: account.institution_name,
							last4: account.last4,
							category: account.category,
						};
					} catch (error) {
						console.error(`[Stripe] Error fetching account details for ${id}:`, error);
						// Return minimal info if fetch fails
						return {
							id,
							display_name: "",
							institution_name: "",
							last4: "",
							category: "",
						};
					}
				})
			);

			const connectionData = {
				serverId: "stripe",
				serverName: stripeApp[0].name,
				transportType: "http" as const,
				transportConfig: {} as any,
				status: "connected" as const,
				secretUri: null,
				credentialStorage: "database" as const,
				encryptedCredentials: null, // Stripe key comes from env, not stored per connection
				connectionMetadata: {
					accountIds: input.accountIds,
					accountDetails: accountDetails, // Store account details with names
					customerId: input.customerId,
				},
				updatedAt: now,
			};

			if (existingConnections.length > 0) {
				const [updated] = await db
					.update(connections)
					.set({
						...connectionData,
						updatedAt: now,
					})
					.where(eq(connections.serverId, "stripe"))
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
});


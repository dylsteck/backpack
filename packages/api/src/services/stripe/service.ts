import Stripe from "stripe";
import type {
	FinancialConnectionsSession,
	FinancialConnectionsAccount,
	Transaction,
	Balance,
	Ownership,
	StripeCustomer,
} from "./types";

export class StripeService {
	private stripe: Stripe;

	constructor(apiKey?: string) {
		// Stripe secret key should be set in apps/server/.env as STRIPE_SECRET_KEY
		// The server loads dotenv/config, making it available to the API package
		const secretKey = apiKey || process.env.STRIPE_SECRET_KEY;
		if (!secretKey) {
			throw new Error("Stripe secret key is required. Set STRIPE_SECRET_KEY in apps/server/.env");
		}
		this.stripe = new Stripe(secretKey, {
			apiVersion: "2025-02-24.acacia",
		});
	}

	async createFinancialConnectionsSession(
		customerId: string,
		permissions: ("transactions" | "balances" | "ownership" | "payment_method")[],
		returnUrl: string
	): Promise<FinancialConnectionsSession> {
		const session = await this.stripe.financialConnections.sessions.create({
			account_holder: {
				type: "customer",
				customer: customerId,
			},
			permissions,
			return_url: returnUrl,
		});

		if (!session.client_secret) {
			throw new Error("Stripe Financial Connections session did not return a client_secret");
		}

		return {
			id: session.id,
			client_secret: session.client_secret,
			accounts: session.accounts
				? {
						data: session.accounts.data.map((acc) => ({
							id: acc.id,
							object: acc.object as "financial_connections.account",
							category: acc.category || "",
							display_name: acc.display_name || "",
							institution_name: acc.institution_name || "",
							last4: acc.last4 || "",
							created: acc.created,
						})),
					}
				: undefined,
		};
	}

	async getFinancialConnectionsAccount(accountId: string): Promise<FinancialConnectionsAccount> {
		const account = await this.stripe.financialConnections.accounts.retrieve(accountId);

		return {
			id: account.id,
			object: account.object as "financial_connections.account",
			category: account.category || "",
			display_name: account.display_name || "",
			institution_name: account.institution_name || "",
			last4: account.last4 || "",
			created: account.created,
		};
	}

	async getAccountTransactions(
		accountId: string,
		params?: {
			limit?: number;
			starting_after?: string;
		}
	): Promise<{ data: Transaction[]; has_more: boolean }> {
		try {
			const transactions = await this.stripe.financialConnections.transactions.list({
				account: accountId,
				limit: params?.limit || 100,
				starting_after: params?.starting_after,
			});

			// Log pagination details for debugging
			console.log(`[StripeService] getAccountTransactions: fetched ${transactions.data.length} transactions, has_more=${transactions.has_more}, starting_after=${params?.starting_after || "none"}`);

			return {
				data: transactions.data.map((tx) => ({
					id: tx.id,
					object: tx.object as "financial_connections.transaction",
					account: tx.account as string,
					amount: tx.amount,
					currency: tx.currency,
					description: tx.description || "",
					status: tx.status,
					transacted_at: tx.transacted_at,
					created: (tx as any).created || tx.transacted_at,
				})),
				has_more: transactions.has_more,
			};
		} catch (error: any) {
			// Log the full error for debugging
			console.error(`[StripeService] Error fetching transactions for account ${accountId}:`, {
				message: error?.message,
				type: error?.type,
				code: error?.code,
				statusCode: error?.statusCode,
				fullError: error,
			});
			
			// Stripe returns a specific error when there are no transactions
			// This is expected for accounts without transactions
			const errorMessage = error?.message || String(error);
			if (errorMessage.includes("no transactions") || errorMessage.includes("subscribe to transactions")) {
				console.log(`[StripeService] Account ${accountId} has no transactions available - this may require a refresh`);
				// Return empty array instead of throwing, but log the full error
				return {
					data: [],
					has_more: false,
				};
			}
			// Re-throw other errors so we can see what's actually wrong
			throw error;
		}
	}

	async refreshAccountTransactions(accountId: string): Promise<{ status: string } | null> {
		// Refresh transactions for an account - required to subscribe to transaction data
		// According to Stripe docs: https://docs.stripe.com/financial-connections/transactions#subscribe-to-transaction-data
		// You must call accounts.refresh with features: ["transactions"] to subscribe
		try {
			const account = await this.stripe.financialConnections.accounts.retrieve(accountId);
			
			// Check if we need to refresh (if transaction_refresh.status is null or not succeeded)
			const needsRefresh = !account.transaction_refresh || 
				account.transaction_refresh.status !== "succeeded";
			
			if (needsRefresh) {
				console.log(`[StripeService] Refreshing transactions for account ${accountId} (current status: ${account.transaction_refresh?.status || "null"})`);
				
				// Refresh the account with transactions feature
				// According to Stripe API: POST /v1/financial_connections/accounts/{account}/refresh
				const refreshed = await (this.stripe.financialConnections.accounts as any).refresh(accountId, {
					features: ["transactions"],
				});
				
				console.log(`[StripeService] Transaction refresh initiated for account ${accountId}, status: ${refreshed.transaction_refresh?.status || "pending"}`);
				
				return {
					status: refreshed.transaction_refresh?.status || "pending",
				};
			} else {
				console.log(`[StripeService] Account ${accountId} already has successful transaction refresh (status: ${account.transaction_refresh.status})`);
				return {
					status: account.transaction_refresh.status,
				};
			}
		} catch (error: any) {
			console.error(`[StripeService] Error refreshing transactions for account ${accountId}:`, {
				message: error?.message,
				type: error?.type,
				code: error?.code,
				statusCode: error?.statusCode,
			});
			// Return null to indicate refresh failed, but don't throw
			return null;
		}
	}

	async getAccountBalance(accountId: string): Promise<Balance> {
		const balance = await (this.stripe.financialConnections.accounts as any).retrieveBalance(accountId);

		return {
			id: balance.id,
			object: balance.object as "financial_connections.account_balance",
			cash: balance.cash
				? {
						available: balance.cash.available,
					}
				: undefined,
			credit: balance.credit
				? {
						used: balance.credit.used,
					}
				: undefined,
			current: balance.current,
			type: balance.type,
		};
	}

	async getAccountOwnership(accountId: string): Promise<Ownership> {
		const ownership = await (this.stripe.financialConnections.accounts as any).retrieveOwnership(accountId);

		return {
			id: ownership.id,
			object: ownership.object as "financial_connections.account_ownership",
			owners: ownership.owners.map((owner: any) => ({
				email: owner.email || undefined,
				name: owner.name || undefined,
				phone: owner.phone || undefined,
				address: owner.address
					? {
							city: owner.address.city || undefined,
							country: owner.address.country || undefined,
							line1: owner.address.line1 || undefined,
							line2: owner.address.line2 || undefined,
							postal_code: owner.address.postal_code || undefined,
							state: owner.address.state || undefined,
						}
					: undefined,
			})),
		};
	}

	async createOrGetCustomer(email?: string, metadata?: Record<string, string>): Promise<StripeCustomer> {
		// For now, we'll create a customer per email
		// In production, you'd want to check if customer exists first
		if (email) {
			const customers = await this.stripe.customers.list({
				email,
				limit: 1,
			});

			if (customers.data.length > 0 && customers.data[0]) {
				const customer = customers.data[0];
				return {
					id: customer.id,
					email: customer.email || undefined,
					metadata: customer.metadata || {},
				};
			}
		}

		const customer = await this.stripe.customers.create({
			email,
			metadata,
		});

		return {
			id: customer.id,
			email: customer.email || undefined,
			metadata: customer.metadata,
		};
	}
}


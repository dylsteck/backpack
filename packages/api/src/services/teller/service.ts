import type {
	TellerAccount,
	TellerTransaction,
	TellerBalance,
	TellerAccountDetails,
} from "./types";

export class TellerService {
	private readonly baseUrl = "https://api.teller.io";
	private readonly accessToken: string;

	constructor(accessToken: string) {
		this.accessToken = accessToken;
	}

	/**
	 * Get authorization header for Teller API
	 * Teller uses Basic Auth with access token as username (password is empty)
	 */
	private getAuthHeader(): string {
		const credentials = Buffer.from(`${this.accessToken}:`).toString("base64");
		return `Basic ${credentials}`;
	}

	/**
	 * Make authenticated request to Teller API
	 */
	private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;
		const response = await fetch(url, {
			...options,
			headers: {
				"Authorization": this.getAuthHeader(),
				"Content-Type": "application/json",
				...options?.headers,
			},
		});

		if (!response.ok) {
			const error: any = await response.json().catch(() => ({
				error: { code: "unknown", message: response.statusText },
			}));
			throw new Error(`Teller API error: ${error.error?.message || response.statusText}`);
		}

		return response.json() as Promise<T>;
	}

	/**
	 * Get all accounts for this enrollment
	 * GET /accounts
	 */
	async getAccounts(): Promise<TellerAccount[]> {
		return this.request<TellerAccount[]>("/accounts");
	}

	/**
	 * Get details for a specific account
	 * GET /accounts/:id
	 */
	async getAccountDetails(accountId: string): Promise<TellerAccount> {
		return this.request<TellerAccount>(`/accounts/${accountId}`);
	}

	/**
	 * Get balance for a specific account
	 * GET /accounts/:id/balances
	 */
	async getBalance(accountId: string): Promise<TellerBalance> {
		return this.request<TellerBalance>(`/accounts/${accountId}/balances`);
	}

	/**
	 * Get transactions for a specific account
	 * GET /accounts/:id/transactions
	 * @param accountId - The account ID
	 * @param options - Query parameters (count, from_id, etc.)
	 */
	async getTransactions(
		accountId: string,
		options?: {
			count?: number; // Number of transactions to return (default: 100)
			from_id?: string; // Return transactions after this ID (for pagination)
		}
	): Promise<TellerTransaction[]> {
		const queryParams = new URLSearchParams();
		if (options?.count) queryParams.set("count", options.count.toString());
		if (options?.from_id) queryParams.set("from_id", options.from_id);

		const query = queryParams.toString();
		const endpoint = `/accounts/${accountId}/transactions${query ? `?${query}` : ""}`;

		return this.request<TellerTransaction[]>(endpoint);
	}

	/**
	 * Get account and routing numbers (requires verify product)
	 * GET /accounts/:id/details
	 */
	async getAccountNumberDetails(accountId: string): Promise<TellerAccountDetails> {
		return this.request<TellerAccountDetails>(`/accounts/${accountId}/details`);
	}
}


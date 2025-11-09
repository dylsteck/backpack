export interface FinancialConnectionsSession {
	id: string;
	client_secret: string;
	accounts?: {
		data: FinancialConnectionsAccount[];
	};
}

export interface FinancialConnectionsAccount {
	id: string;
	object: "financial_connections.account";
	category: string;
	display_name: string;
	institution_name: string;
	last4: string;
	created: number;
}

export interface Transaction {
	id: string;
	object: "financial_connections.transaction";
	account: string;
	amount: number;
	currency: string;
	description: string;
	status: string;
	transacted_at: number;
	created: number;
}

export interface Balance {
	id: string;
	object: "financial_connections.account_balance";
	cash?: {
		available?: Record<string, number>;
	};
	credit?: {
		used?: Record<string, number>;
	};
	current?: Record<string, number>;
	type: string;
}

export interface Ownership {
	id: string;
	object: "financial_connections.account_ownership";
	owners: Array<{
		email?: string;
		name?: string;
		phone?: string;
		address?: {
			city?: string;
			country?: string;
			line1?: string;
			line2?: string;
			postal_code?: string;
			state?: string;
		};
	}>;
}

export interface StripeCustomer {
	id: string;
	email?: string;
	metadata?: Record<string, string>;
}


// Teller API Types based on https://teller.io/docs/api

export interface TellerAccount {
	id: string;
	enrollment_id: string;
	currency: string;
	institution: {
		id: string;
		name: string;
	};
	name: string;
	type: "depository" | "credit";
	subtype: "checking" | "savings" | "money_market" | "certificate_of_deposit" | "credit_card" | "other";
	status: "open" | "closed";
	last_four: string;
}

export interface TellerBalance {
	account_id: string;
	ledger: string; // Current balance
	available: string; // Available balance
	links: {
		self: string;
		account: string;
	};
}

export interface TellerTransaction {
	id: string;
	account_id: string;
	amount: string; // Positive for credits, negative for debits
	date: string; // ISO 8601 date
	description: string;
	status: "posted" | "pending";
	details: {
		processing_status: string;
		category?: string;
		counterparty?: {
			name: string;
			type: string;
		};
	};
	running_balance?: string;
	type: string;
	links: {
		self: string;
		account: string;
	};
}

export interface TellerAccountDetails {
	account_number: string;
	routing_number?: string;
	links: {
		self: string;
		account: string;
	};
}

export interface TellerEnrollment {
	accessToken: string;
	enrollment: {
		id: string;
		institution: {
			name: string;
		};
	};
	user: {
		id: string;
	};
	signatures?: string[];
}

export interface TellerApiError {
	error: {
		code: string;
		message: string;
	};
}


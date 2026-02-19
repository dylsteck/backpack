/**
 * Teller API types
 */

/**
 * Teller account from API
 */
export interface TellerAccount {
  id: string;
  name: string;
  type: "depository" | "credit" | "loan" | "investment";
  subtype: string;
  currency: string;
  last_four: string;
  status: "open" | "closed" | "frozen";
  institution: {
    name: string;
    id: string;
  };
  enrollment_id: string;
  links: {
    self: string;
    transactions: string;
  };
}

/**
 * Teller transaction from API
 */
export interface TellerTransaction {
  id: string;
  account_id: string;
  amount: string;
  date: string; // YYYY-MM-DD
  description: string;
  category?: string;
  merchant?: {
    name: string;
  };
  status: "pending" | "posted";
  running_balance?: string;
  type?: string;
  details?: {
    category?: string;
    counterparty?: string;
    processing_status?: string;
  };
  links: {
    self: string;
    account: string;
  };
}

/**
 * Teller configuration
 */
export interface TellerConfig {
  environment: "sandbox" | "production";
  accountIds?: string[];
}

/**
 * Teller sync state for incremental syncs
 */
export interface TellerSyncState {
  lastSyncDate: string;
  accountIds: string[];
}

/**
 * Teller API error response
 */
export interface TellerApiError {
  error: {
    code: string;
    message: string;
  };
}

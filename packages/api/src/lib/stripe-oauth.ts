import { StripeService } from "../services/stripe/service";
import type { FinancialConnectionsSession, FinancialConnectionsAccount } from "../services/stripe/types";

export interface InitiateStripeOAuthParams {
	customerId: string;
	returnUrl: string;
	permissions?: ("transactions" | "balances" | "ownership" | "payment_method")[];
}

export interface CompleteStripeOAuthParams {
	sessionId: string;
}

/**
 * Initiate Stripe Financial Connections OAuth flow
 */
export async function initiateStripeOAuth(
	params: InitiateStripeOAuthParams
): Promise<FinancialConnectionsSession> {
	const stripeService = new StripeService();
	const permissions = params.permissions || ["transactions", "balances", "ownership"];

	const session = await stripeService.createFinancialConnectionsSession(
		params.customerId,
		permissions,
		params.returnUrl
	);

	return session;
}

/**
 * Complete Stripe Financial Connections OAuth flow
 * Retrieves the session and extracts connected account IDs
 */
export async function completeStripeOAuth(
	sessionId: string
): Promise<{
	accounts: FinancialConnectionsAccount[];
	customerId: string;
}> {
	const stripeService = new StripeService();

	// Retrieve the session to get connected accounts
	// Note: Stripe doesn't have a direct "retrieve session" endpoint for FC sessions
	// We need to use the session ID from the client secret or store it during creation
	// For now, we'll need to pass the session data or retrieve accounts differently

	// Actually, we can retrieve accounts by listing them for a customer
	// But we need the customer ID. Let's assume it's stored in session metadata
	// For now, this is a placeholder - the actual implementation will depend on
	// how we store the session during initiation

	throw new Error("completeStripeOAuth: Implementation depends on session storage strategy");
}

/**
 * Extract account IDs from a completed Financial Connections session
 */
export function extractAccountIds(session: FinancialConnectionsSession): string[] {
	if (!session.accounts?.data) {
		return [];
	}
	return session.accounts.data.map((acc) => acc.id);
}


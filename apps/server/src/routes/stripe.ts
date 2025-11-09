import { Elysia } from "elysia";
import { StripeService } from "@cortex/api/services/stripe/service";
import { stripeRouter } from "@cortex/api/routers/stripe";
import { createContext } from "@cortex/api/context";

// Session token store for tracking OAuth flow state
interface StripeOAuthSession {
	sessionToken: string;
	status: "pending" | "completed" | "error";
	accountIds: string[] | null;
	customerId: string | null;
	error: string | null;
	createdAt: number;
}

const stripeOAuthSessions = new Map<string, StripeOAuthSession>();
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

function generateSessionToken(): string {
	return `stripe_${Math.random().toString(36).substring(2)}_${Date.now().toString(36)}`;
}

function cleanupExpiredSessions(): void {
	const now = Date.now();
	for (const [token, session] of stripeOAuthSessions.entries()) {
		if (now - session.createdAt > SESSION_TTL) {
			stripeOAuthSessions.delete(token);
		}
	}
}

// Cleanup expired sessions periodically
setInterval(cleanupExpiredSessions, 60 * 1000); // Every minute

export const stripeRoutes = new Elysia({ prefix: "/stripe" })
	.get("/connect", async ({ query, set }) => {
		try {
			const { token } = query as { token?: string };
			
			if (!token) {
				set.status = 400;
				return new Response("Missing session token", { status: 400 });
			}

			// Initialize session if it doesn't exist
			if (!stripeOAuthSessions.has(token)) {
				stripeOAuthSessions.set(token, {
					sessionToken: token,
					status: "pending",
					accountIds: null,
					customerId: null,
					error: null,
					createdAt: Date.now(),
				});
			}

			const stripeService = new StripeService();
			// Stripe requires a return_url for validation, but we handle redirects via deep link
			// So we just use a default HTTPS URL - Stripe doesn't actually redirect here
			const returnUrl = process.env.STRIPE_RETURN_URL || "https://localhost";

			// Create or get customer (no email for now)
			const customer = await stripeService.createOrGetCustomer();

			// Update session with customer ID before creating session
			const oauthSession = stripeOAuthSessions.get(token);
			if (oauthSession) {
				oauthSession.customerId = customer.id;
			}

			// Create Financial Connections session
			const session = await stripeService.createFinancialConnectionsSession(
				customer.id,
				["transactions", "balances", "ownership"],
				returnUrl
			);

			if (!session.client_secret) {
				throw new Error("Failed to create Financial Connections session");
			}

			// Store session ID for later retrieval
			if (oauthSession) {
				(oauthSession as any).sessionId = session.id;
			}

			// Stripe publishable key should be set in apps/server/.env as STRIPE_PUBLISHABLE_KEY
			const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || "";
			const customerId = customer.id;
			const sessionId = session.id;

			// Return HTML page with Stripe.js embedded
			const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Connect Bank Accounts - Stripe</title>
	<script src="https://js.stripe.com/v3"></script>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 20px;
		}
		.container {
			background: white;
			border-radius: 12px;
			box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
			max-width: 500px;
			width: 100%;
			padding: 40px;
			text-align: center;
		}
		.logo {
			width: 60px;
			height: 60px;
			background: #635bff;
			border-radius: 12px;
			display: flex;
			align-items: center;
			justify-content: center;
			margin: 0 auto 20px;
			font-size: 32px;
			font-weight: bold;
			color: white;
		}
		h1 {
			color: #1a1a1a;
			margin-bottom: 10px;
			font-size: 24px;
		}
		p {
			color: #666;
			margin-bottom: 30px;
			line-height: 1.6;
		}
		#stripe-container {
			margin: 30px 0;
			min-height: 200px;
		}
		.loading {
			color: #666;
			font-size: 14px;
		}
		.error {
			background: #fee;
			border: 1px solid #fcc;
			border-radius: 8px;
			padding: 15px;
			margin: 20px 0;
			color: #c33;
		}
		.success {
			background: #efe;
			border: 1px solid #cfc;
			border-radius: 8px;
			padding: 15px;
			margin: 20px 0;
			color: #3c3;
		}
		button {
			background: #635bff;
			color: white;
			border: none;
			border-radius: 8px;
			padding: 12px 24px;
			font-size: 16px;
			cursor: pointer;
			margin: 10px;
			transition: background 0.2s;
		}
		button:hover {
			background: #4f46e5;
		}
		button:disabled {
			background: #ccc;
			cursor: not-allowed;
		}
		.fallback {
			margin-top: 20px;
			padding-top: 20px;
			border-top: 1px solid #eee;
			font-size: 14px;
			color: #999;
		}
		.fallback a {
			color: #635bff;
			text-decoration: none;
		}
		.fallback a:hover {
			text-decoration: underline;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="logo">S</div>
		<h1>Connect Your Bank Accounts</h1>
		<p>Securely connect your bank accounts using Stripe Financial Connections</p>
		
		<div id="stripe-container">
			<div class="loading">Loading Stripe...</div>
		</div>
		
		<div id="error-container"></div>
		<div id="success-container"></div>
		
		<div class="fallback" id="fallback" style="display: none;">
			<p>Redirect didn't work?</p>
			<a href="cortex://callback?success=true&sessionToken=${token}" id="deep-link-fallback">Click here</a> or go back to the app
		</div>
	</div>

	<script>
		const sessionToken = "${token}";
		const clientSecret = "${session.client_secret}";
		const sessionId = "${sessionId}";
		const publishableKey = "${publishableKey}";
		
		if (!publishableKey) {
			document.getElementById('stripe-container').innerHTML = '<div class="error">Stripe publishable key not configured</div>';
			throw new Error('Stripe publishable key missing');
		}

		let stripe;
		
		async function initStripe() {
			try {
				stripe = Stripe(publishableKey);
				
				// Collect Financial Connections accounts
				const result = await stripe.collectFinancialConnectionsAccounts({
					clientSecret: clientSecret,
				});

				console.log('Stripe collectFinancialConnectionsAccounts result:', result);

				if (result.error) {
					console.error('Stripe error:', result.error);
					showError(result.error.message || 'Failed to connect accounts');
					
					// Update session status
					await fetch(\`/stripe/callback\`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							sessionToken: sessionToken,
							success: false,
							error: result.error.message,
						}),
					});
					return;
				}

				// Check for accounts in the result
				let accountIds = [];
				
				// Accounts might be in result.financialConnectionsSession.accounts.data
				if (result.financialConnectionsSession?.accounts?.data && result.financialConnectionsSession.accounts.data.length > 0) {
					accountIds = result.financialConnectionsSession.accounts.data.map(acc => acc.id);
					console.log('Found accounts in result:', accountIds);
				} 
				// Or we might need to retrieve the session from the server
				else {
					console.log('No accounts in result, fetching from server...');
					const sessionIdToFetch = result.financialConnectionsSession?.id || sessionId;
					console.log('Fetching session:', sessionIdToFetch);
					// Fetch the session from our server endpoint which will retrieve it from Stripe
					const sessionResponse = await fetch(\`/stripe/session/\${sessionIdToFetch}\`);
					if (sessionResponse.ok) {
						const sessionData = await sessionResponse.json();
						console.log('Session data from server:', sessionData);
						if (sessionData.accountIds && sessionData.accountIds.length > 0) {
							accountIds = sessionData.accountIds;
							console.log('Found accounts from server:', accountIds);
						} else if (sessionData.accounts && sessionData.accounts.length > 0) {
							accountIds = sessionData.accounts.map(acc => acc.id);
							console.log('Found accounts from server (mapped):', accountIds);
						}
					} else {
						const errorText = await sessionResponse.text();
						console.error('Failed to fetch session:', errorText);
					}
				}

				if (accountIds.length > 0) {
					// Save accounts via callback endpoint
					const callbackResult = await fetch(\`/stripe/callback\`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							sessionToken: sessionToken,
							success: true,
							accountIds: accountIds,
						}),
					});

					if (!callbackResult.ok) {
						const errorText = await callbackResult.text();
						console.error('Callback error:', errorText);
						throw new Error('Failed to save connection: ' + errorText);
					}

					const callbackData = await callbackResult.json();
					const customerId = callbackData.customerId || "${customerId}";
					
					console.log('Successfully saved accounts:', { accountIds, customerId });
					
					// Show success
					showSuccess();
					
					// Redirect to deep link
					const deepLink = \`cortex://callback?success=true&sessionToken=\${sessionToken}&accountIds=\${accountIds.join(',')}&customerId=\${customerId}\`;
					
					// Try deep link redirect
					window.location.href = deepLink;
					
					// Show fallback after a delay
					setTimeout(() => {
						document.getElementById('fallback').style.display = 'block';
						document.getElementById('deep-link-fallback').href = deepLink;
					}, 2000);
				} else {
					console.error('No accounts found in result:', result);
					throw new Error('No accounts were connected. Please try again.');
				}
			} catch (error) {
				console.error('Stripe error:', error);
				showError(error.message || 'An error occurred while connecting your accounts');
				
				// Update session status
				await fetch(\`/stripe/callback\`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						sessionToken: sessionToken,
						success: false,
						error: error.message,
					}),
				});
			}
		}

		function showError(message) {
			document.getElementById('stripe-container').innerHTML = '';
			document.getElementById('error-container').innerHTML = \`<div class="error">\${message}</div>\`;
			document.getElementById('fallback').style.display = 'block';
		}

		function showSuccess() {
			document.getElementById('stripe-container').innerHTML = '';
			document.getElementById('success-container').innerHTML = '<div class="success">Successfully connected! Redirecting to app...</div>';
		}

		// Initialize when page loads
		initStripe();
	</script>
</body>
</html>`;

			set.headers["Content-Type"] = "text/html";
			return html;
		} catch (error: any) {
			console.error("Error in /stripe/connect:", error);
			set.status = 500;
			return new Response(`<html><body><h1>Error</h1><p>${error.message || "Failed to initialize Stripe connection"}</p></body></html>`, {
				headers: { "Content-Type": "text/html" },
			});
		}
	})
	.get("/status/:token", async ({ params, set }) => {
		try {
			const { token } = params as { token: string };
			const session = stripeOAuthSessions.get(token);

			if (!session) {
				set.status = 404;
				return { status: "not_found", error: "Session not found" };
			}

			// Check if expired
			const now = Date.now();
			if (now - session.createdAt > SESSION_TTL) {
				stripeOAuthSessions.delete(token);
				set.status = 410; // Gone
				return { status: "expired", error: "Session expired" };
			}

			return {
				status: session.status,
				accountIds: session.accountIds,
				customerId: session.customerId,
				error: session.error,
			};
		} catch (error: any) {
			console.error("Error in /stripe/status:", error);
			set.status = 500;
			return { status: "error", error: error.message };
		}
	})
	.get("/session/:sessionId", async ({ params, set }) => {
		try {
			const { sessionId } = params as { sessionId: string };
			const stripeService = new StripeService();
			
			// Retrieve the Financial Connections session from Stripe
			const session = await (stripeService as any).stripe.financialConnections.sessions.retrieve(sessionId);
			
			// Extract account IDs
			const accounts = session.accounts?.data || [];
			const accountIds = accounts.map((acc: any) => acc.id);
			
			return {
				accounts: accounts.map((acc: any) => ({
					id: acc.id,
					display_name: acc.display_name,
					institution_name: acc.institution_name,
				})),
				accountIds,
			};
		} catch (error: any) {
			console.error("Error retrieving session:", error);
			set.status = 500;
			return { error: error.message || "Failed to retrieve session" };
		}
	})
	.post("/callback", async ({ body, set }) => {
		try {
			const data = body as {
				sessionToken: string;
				success: boolean;
				accountIds?: string[];
				error?: string;
			};

			const session = stripeOAuthSessions.get(data.sessionToken);
			if (!session) {
				set.status = 404;
				return { error: "Session not found" };
			}

			if (data.success && data.accountIds) {
				// Save connected accounts using tRPC router
				const ctx = createContext({ context: {} as any });
				const caller = stripeRouter.createCaller(ctx);
				await caller.saveConnectedAccounts({
					accountIds: data.accountIds,
					customerId: session.customerId || "",
				});

				// Sync transactions for each account
				for (const accountId of data.accountIds) {
					try {
						await caller.syncAccountTransactions({ accountId });
					} catch (syncError) {
						console.error(`Failed to sync transactions for account ${accountId}:`, syncError);
					}
				}

				// Update session status
				session.status = "completed";
				session.accountIds = data.accountIds;
				
				return { success: true, customerId: session.customerId };
			} else {
				// Update session with error
				session.status = "error";
				session.error = data.error || "Unknown error";
				
				return { success: false, error: session.error };
			}
		} catch (error: any) {
			console.error("Error in /stripe/callback:", error);
			set.status = 500;
			return { error: error.message || "Failed to process callback" };
		}
	});


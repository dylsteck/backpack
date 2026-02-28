import { Elysia } from "elysia";

// Session token store for tracking OAuth flow state
interface TellerOAuthSession {
	sessionToken: string;
	status: "pending" | "completed" | "error";
	accessToken: string | null;
	enrollmentId: string | null;
	institutionName: string | null;
	error: string | null;
	createdAt: number;
}

const tellerOAuthSessions = new Map<string, TellerOAuthSession>();
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

function generateSessionToken(): string {
	return `teller_${Math.random().toString(36).substring(2)}_${Date.now().toString(36)}`;
}

function cleanupExpiredSessions(): void {
	const now = Date.now();
	for (const [token, session] of tellerOAuthSessions.entries()) {
		if (now - session.createdAt > SESSION_TTL) {
			tellerOAuthSessions.delete(token);
		}
	}
}

// Cleanup expired sessions periodically
setInterval(cleanupExpiredSessions, 60 * 1000); // Every minute

export const tellerRoutes = new Elysia({ prefix: "/teller" })
	.get("/connect", async ({ query, set }) => {
		try {
			let { token } = query as { token?: string };
			
			// Generate token if not provided
			if (!token) {
				token = generateSessionToken();
			}

			// Initialize session if it doesn't exist
			if (!tellerOAuthSessions.has(token)) {
				tellerOAuthSessions.set(token, {
					sessionToken: token,
					status: "pending",
					accessToken: null,
					enrollmentId: null,
					institutionName: null,
					error: null,
					createdAt: Date.now(),
				});
			}

			// Get Application ID from environment
			const applicationId = process.env.TELLER_APPLICATION_ID || "";
			const environment = process.env.TELLER_ENVIRONMENT || "sandbox";

			if (!applicationId) {
				throw new Error("Teller Application ID not configured");
			}

			// Return HTML page with Teller Connect SDK embedded
			const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Connect Bank Account - Backpack</title>
	<script src="https://cdn.teller.io/connect/connect.js"></script>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
			background: #fafafa;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 20px;
			color: #111;
		}
		.container {
			background: #fff;
			border: 1px solid rgba(0, 0, 0, 0.08);
			border-radius: 20px;
			max-width: 420px;
			width: 100%;
			padding: 48px 40px;
			text-align: center;
			box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
		}
		.icon {
			width: 48px;
			height: 48px;
			margin: 0 auto 28px;
			color: #111;
		}
		h1 {
			color: #111;
			margin-bottom: 8px;
			font-size: 22px;
			font-weight: 600;
		}
		p {
			color: #888;
			margin-bottom: 32px;
			line-height: 1.6;
			font-size: 14px;
		}
		#teller-container {
			margin: 24px 0;
			min-height: 60px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
		}
		.error {
			background: #fef2f2;
			border: 1px solid #fecaca;
			color: #dc2626;
			padding: 14px 16px;
			border-radius: 12px;
			margin: 16px 0;
			font-size: 13px;
		}
		.success {
			background: #f0fdf4;
			border: 1px solid #bbf7d0;
			color: #16a34a;
			padding: 14px 16px;
			border-radius: 12px;
			margin: 16px 0;
			font-size: 13px;
		}
		#error-container, #success-container {
			display: none;
		}
		#fallback {
			display: none;
			margin-top: 20px;
			padding-top: 20px;
			border-top: 1px solid rgba(0, 0, 0, 0.06);
		}
		#fallback p {
			margin-bottom: 0;
			font-size: 13px;
			color: #999;
		}
		#fallback a {
			color: #111;
			text-decoration: none;
			font-weight: 500;
		}
		#fallback a:hover {
			text-decoration: underline;
		}
		.spinner {
			display: inline-block;
			width: 20px;
			height: 20px;
			border: 2px solid rgba(0, 0, 0, 0.08);
			border-top-color: #111;
			border-radius: 50%;
			animation: spin 0.7s linear infinite;
			margin-bottom: 12px;
		}
		@keyframes spin {
			to { transform: rotate(360deg); }
		}
		.loading-text {
			color: #999;
			font-size: 13px;
		}
	</style>
</head>
<body>
	<div class="container">
		<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
			<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
			<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
		</svg>
		<h1>Connect bank account</h1>
		<p>Securely link your bank through Teller to sync your transactions.</p>

		<div id="teller-container">
			<div class="spinner"></div>
			<div class="loading-text">Connecting...</div>
		</div>
		<div id="error-container"></div>
		<div id="success-container"></div>

		<div id="fallback">
			<p>Not redirected? <a id="deep-link-fallback" href="#">Return to app</a></p>
		</div>
	</div>

	<script>
		const sessionToken = "${token}";
		const applicationId = "${applicationId}";
		const environment = "${environment}";

		async function initTeller() {
			try {
				// Wait for Teller Connect SDK to load
				if (typeof TellerConnect === 'undefined') {
					// SDK should already be loaded from script tag, but wait a bit if needed
					await new Promise(resolve => setTimeout(resolve, 500));
					
					if (typeof TellerConnect === 'undefined') {
						throw new Error('Teller Connect SDK failed to load');
					}
				}

				// Setup Teller Connect
				const tellerConnect = TellerConnect.setup({
					applicationId: applicationId,
					environment: environment,
					products: ["transactions", "balance", "identity", "verify"],
					onSuccess: async (enrollment) => {
						try {
							console.log('Teller enrollment successful:', enrollment);
							
							const accessToken = enrollment.accessToken;
							const enrollmentId = enrollment.enrollment?.id || null;
							const institutionName = enrollment.enrollment?.institution?.name || null;

							// Save enrollment data via callback endpoint
							const callbackResult = await fetch(\`/teller/callback\`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									sessionToken: sessionToken,
									success: true,
									accessToken: accessToken,
									enrollmentId: enrollmentId,
									institutionName: institutionName,
								}),
							});

							if (!callbackResult.ok) {
								const errorText = await callbackResult.text();
								console.error('Callback error:', errorText);
								throw new Error('Failed to save connection: ' + errorText);
							}

							const callbackData = await callbackResult.json();
							console.log('Successfully saved enrollment:', { enrollmentId, institutionName });
							
							// Show success
							showSuccess();
							
							// Redirect to deep link
							const deepLink = \`backpack://callback?success=true&sessionToken=\${sessionToken}&accessToken=\${encodeURIComponent(accessToken)}&enrollmentId=\${enrollmentId || ''}&institutionName=\${encodeURIComponent(institutionName || '')}\`;
							
							// Try deep link redirect
							window.location.href = deepLink;
							
							// Show fallback after a delay
							setTimeout(() => {
								document.getElementById('fallback').style.display = 'block';
								document.getElementById('deep-link-fallback').href = deepLink;
							}, 2000);
						} catch (error) {
							console.error('Teller callback error:', error);
							showError(error.message || 'An error occurred while saving your connection');
							
							// Update session status
							await fetch(\`/teller/callback\`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									sessionToken: sessionToken,
									success: false,
									error: error.message,
								}),
							});
						}
					},
					onExit: () => {
						console.log('Teller Connect closed');
						showError('Connection cancelled. Please try again.');
					},
					onInit: () => {
						console.log('Teller Connect initialized');
					},
				});

				// Open Teller Connect
				tellerConnect.open();
			} catch (error) {
				console.error('Error initializing Teller Connect:', error);
				showError(error.message || 'Failed to initialize Teller Connect');
			}
		}

		function showError(message) {
			document.getElementById('teller-container').innerHTML = '';
			document.getElementById('error-container').innerHTML = \`<div class="error">\${message}</div>\`;
			document.getElementById('error-container').style.display = 'block';
			document.getElementById('fallback').style.display = 'block';
		}

		function showSuccess() {
			document.getElementById('teller-container').innerHTML = '';
			document.getElementById('success-container').innerHTML = '<div class="success">Connected! Redirecting to Backpack...</div>';
			document.getElementById('success-container').style.display = 'block';
		}

		// Initialize when page loads
		initTeller();
	</script>
</body>
</html>`;

			set.headers["Content-Type"] = "text/html";
			return html;
		} catch (error: any) {
			console.error("Error in /teller/connect:", error);
			set.status = 500;
			return new Response(`<html><body><h1>Error</h1><p>${error.message || "Failed to initialize Teller connection"}</p></body></html>`, {
				headers: { "Content-Type": "text/html" },
			});
		}
	})
	.get("/status/:token", async ({ params, set }) => {
		try {
			const { token } = params as { token: string };
			const session = tellerOAuthSessions.get(token);

			if (!session) {
				set.status = 404;
				return { status: "not_found", error: "Session not found" };
			}

			// Check if expired
			const now = Date.now();
			if (now - session.createdAt > SESSION_TTL) {
				tellerOAuthSessions.delete(token);
				set.status = 410; // Gone
				return { status: "expired", error: "Session expired" };
			}

			return {
				status: session.status,
				accessToken: session.accessToken,
				enrollmentId: session.enrollmentId,
				institutionName: session.institutionName,
				error: session.error,
			};
		} catch (error: any) {
			console.error("Error in /teller/status:", error);
			set.status = 500;
			return { status: "error", error: error.message };
		}
	})
	.post("/callback", async ({ body, set }) => {
		try {
			const data = body as {
				sessionToken: string;
				success: boolean;
				accessToken?: string;
				enrollmentId?: string;
				institutionName?: string;
				error?: string;
			};

			const session = tellerOAuthSessions.get(data.sessionToken);
			if (!session) {
				set.status = 404;
				return { error: "Session not found" };
			}

			if (data.success && data.accessToken) {
				// Update session status
				session.status = "completed";
				session.accessToken = data.accessToken;
				session.enrollmentId = data.enrollmentId || null;
				session.institutionName = data.institutionName || null;
				
				return { success: true };
			} else {
				// Update session with error
				session.status = "error";
				session.error = data.error || "Unknown error";
				
				return { success: false, error: session.error };
			}
		} catch (error: any) {
			console.error("Error in /teller/callback:", error);
			set.status = 500;
			return { error: error.message || "Failed to process callback" };
		}
	});


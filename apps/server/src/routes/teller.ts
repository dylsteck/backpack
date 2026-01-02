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
	<title>Connect Bank Account - Cortex</title>
	<script src="https://cdn.teller.io/connect/connect.js"></script>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: 'JetBrains Mono', monospace;
			background: #0a0a0a;
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 20px;
			color: #fafafa;
		}
		.container {
			background: #141414;
			border: 1px solid rgba(212, 165, 116, 0.2);
			border-radius: 16px;
			max-width: 460px;
			width: 100%;
			padding: 48px 40px;
			text-align: center;
		}
		.logo {
			width: 72px;
			height: 72px;
			background: #1a1a1a;
			border: 2px solid rgba(212, 165, 116, 0.3);
			border-radius: 16px;
			display: flex;
			align-items: center;
			justify-content: center;
			margin: 0 auto 24px;
		}
		.logo svg {
			width: 36px;
			height: 36px;
			color: #d4a574;
		}
		h1 {
			color: #d4a574;
			margin-bottom: 12px;
			font-size: 20px;
			font-weight: 500;
			text-transform: uppercase;
			letter-spacing: 0.15em;
		}
		p {
			color: #737373;
			margin-bottom: 32px;
			line-height: 1.7;
			font-size: 13px;
		}
		#teller-container {
			margin: 32px 0;
			min-height: 100px;
		}
		.error {
			background: rgba(239, 68, 68, 0.1);
			border: 1px solid rgba(239, 68, 68, 0.3);
			color: #f87171;
			padding: 16px;
			border-radius: 8px;
			margin: 20px 0;
			font-size: 13px;
		}
		.success {
			background: rgba(34, 197, 94, 0.1);
			border: 1px solid rgba(34, 197, 94, 0.3);
			color: #4ade80;
			padding: 16px;
			border-radius: 8px;
			margin: 20px 0;
			font-size: 13px;
		}
		#error-container, #success-container {
			display: none;
		}
		#fallback {
			display: none;
			margin-top: 24px;
			padding-top: 24px;
			border-top: 1px solid rgba(212, 165, 116, 0.1);
		}
		#fallback p {
			margin-bottom: 0;
		}
		#fallback a {
			color: #d4a574;
			text-decoration: none;
			font-weight: 500;
			transition: opacity 0.2s;
		}
		#fallback a:hover {
			opacity: 0.8;
		}
		.spinner {
			display: inline-block;
			width: 20px;
			height: 20px;
			border: 2px solid rgba(212, 165, 116, 0.2);
			border-top-color: #d4a574;
			border-radius: 50%;
			animation: spin 0.8s linear infinite;
			margin-bottom: 16px;
		}
		@keyframes spin {
			to { transform: rotate(360deg); }
		}
		.loading-text {
			color: #737373;
			font-size: 12px;
			text-transform: uppercase;
			letter-spacing: 0.1em;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="logo">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<rect width="7" height="7" x="3" y="3" rx="1"/>
				<rect width="7" height="7" x="14" y="3" rx="1"/>
				<rect width="7" height="7" x="14" y="14" rx="1"/>
				<rect width="7" height="7" x="3" y="14" rx="1"/>
			</svg>
		</div>
		<h1>Connect Bank Account</h1>
		<p>Securely connect your bank account through Teller. You'll be guided through selecting your bank and authenticating.</p>
		
		<div id="teller-container">
			<div class="spinner"></div>
			<div class="loading-text">Initializing...</div>
		</div>
		<div id="error-container"></div>
		<div id="success-container"></div>
		
		<div id="fallback">
			<p>If you're not redirected automatically, <a id="deep-link-fallback" href="#">click here</a> to return to the app.</p>
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
							const deepLink = \`cortex://callback?success=true&sessionToken=\${sessionToken}&accessToken=\${encodeURIComponent(accessToken)}&enrollmentId=\${enrollmentId || ''}&institutionName=\${encodeURIComponent(institutionName || '')}\`;
							
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
			document.getElementById('success-container').innerHTML = '<div class="success">Successfully connected! Redirecting to app...</div>';
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


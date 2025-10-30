import { useState, useEffect } from "react";
import {
	Button,
	Label,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Badge,
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@cortex/ui/components";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { authClient } from "@/lib/auth-client";
import type { CursorServer, TransportType } from "@/types/mcp";

interface MCPSetupPanelProps {
	server: CursorServer;
	onClose: () => void;
}

export default function MCPSetupPanel({ server, onClose }: MCPSetupPanelProps) {
	const [transportType, setTransportType] = useState<TransportType>("http");
	const [command, setCommand] = useState("");
	const [args, setArgs] = useState("");
	const [url, setUrl] = useState("");
	const [headers, setHeaders] = useState("");
	const [envVars, setEnvVars] = useState("");
	const [isOAuthFlow, setIsOAuthFlow] = useState(false);
	const [oauthSessionId, setOauthSessionId] = useState<string | null>(null);

	const { data: session } = authClient.useSession();
	const utils = trpc.useContext();
	const addConnection = trpc.mcp.addConnection.useMutation({
		onSuccess: () => {
			toast.success("MCP server connected successfully!");
			utils.mcp.getUserConnections.invalidate();
			onClose();
		},
		onError: (error: any) => {
			toast.error(`Failed to connect: ${error.message}`);
		},
	});

	useEffect(() => {
		if (server?.config) {
			const config = server.config;
			
			// Set transport type from server's transport array (use first one)
			if (server.transport && server.transport.length > 0) {
				setTransportType(server.transport[0] as TransportType);
			}
			
			// Pre-populate config fields
			if (config.url) {
				setUrl(config.url);
			}
			if (config.command) {
				setCommand(config.command);
			}
			if (config.args && config.args.length > 0) {
				setArgs(config.args.join(", "));
			}
			if (config.headers) {
				setHeaders(JSON.stringify(config.headers, null, 2));
			}
			if (config.env) {
				setEnvVars(JSON.stringify(config.env, null, 2));
			}
			
			// Initiate OAuth flow if required
			if (server.oauth && config.url) {
				setIsOAuthFlow(true);
			}
		}
	}, [server]);

	const initiateOAuth = async () => {
		if (!server || !url || !session?.user) {
			toast.error("URL and authentication required");
			return;
		}

		try {
			const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
			const callbackUrl = `${serverUrl}/api/mcp/auth/callback`;
			
			const response = await fetch(`${serverUrl}/api/mcp/auth/connect`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					serverUrl: url,
					callbackUrl,
					userId: session.user.id,
				}),
			});

			const data = await response.json();
			
			if (data.authUrl) {
				setOauthSessionId(data.sessionId);
				window.open(data.authUrl, "_blank");
				toast.info("Complete OAuth authorization in the new window");
			} else {
				setIsOAuthFlow(false);
				toast.info("Server does not require OAuth, proceeding with manual setup");
			}
		} catch (error: any) {
			toast.error(`Failed to initiate OAuth: ${error.message}`);
		}
	};

	const handleConnect = () => {
		if (!server) return;

		let transportConfig: any = {};

		if (transportType === "stdio") {
			if (!command) {
				toast.error("Command is required for stdio transport");
				return;
			}
			transportConfig = {
				command,
				args: args ? args.split(",").map((a) => a.trim()).filter(Boolean) : [],
			};
			
			// Add env vars if provided
			if (envVars) {
				try {
					transportConfig.env = JSON.parse(envVars);
				} catch {
					toast.error("Invalid JSON for environment variables");
					return;
				}
			}
		} else {
			if (!url) {
				toast.error("URL is required for this transport type");
				return;
			}
			transportConfig = {
				url,
			};
			
			// Add headers if provided
			if (headers) {
				try {
					transportConfig.headers = JSON.parse(headers);
				} catch {
					toast.error("Invalid JSON for headers");
					return;
				}
			}
			
			// Add env vars if provided (for URL-based transports)
			if (envVars) {
				try {
					transportConfig.env = JSON.parse(envVars);
				} catch {
					toast.error("Invalid JSON for environment variables");
					return;
				}
			}
		}

		addConnection.mutate({
			serverId: server.id,
			serverName: server.name,
			transportType,
			transportConfig,
		});
	};

	return (
		<div className="space-y-6">
			{/* Server Header */}
			<div className="flex items-start justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
				<div className="flex items-start gap-4">
					{server.iconUrl && (
						<img
							src={server.iconUrl}
							alt={server.name}
							className="w-16 h-16 rounded-xl object-contain"
						/>
					)}
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
								{server.name}
							</h2>
							{server.oauth && (
								<Badge variant="secondary" className="text-xs">OAuth Required</Badge>
							)}
						</div>
						{server.description && (
							<p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
								{server.description}
							</p>
						)}
						{server.transport && server.transport.length > 0 && (
							<div className="flex flex-wrap gap-2 pt-2">
								{server.transport.map((t) => (
									<Badge key={t} variant="outline" className="text-xs">{t}</Badge>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Connection Form */}
			<Card className="border-slate-200 dark:border-slate-800 shadow-sm">
				<CardHeader>
					<CardTitle className="text-lg">Connection Settings</CardTitle>
					<CardDescription>
						Configure how to connect to this MCP server
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">

				{server.oauth && transportType !== "stdio" && (
					<div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
						<div className="flex items-start justify-between">
							<div className="space-y-2 flex-1">
								<p className="text-sm font-medium text-blue-900 dark:text-blue-100">
									OAuth Authentication Required
								</p>
								<p className="text-xs text-blue-700 dark:text-blue-300">
									This server requires OAuth authentication to connect.
								</p>
							</div>
							{!oauthSessionId ? (
								<Button onClick={initiateOAuth} variant="outline" size="sm" className="ml-4">
									Start OAuth Flow
								</Button>
							) : (
								<div className="ml-4 w-full max-w-md space-y-2">
									<p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
										OAuth authorization initiated. Complete the flow in the browser window, then paste the authorization token below.
									</p>
									<Input
										placeholder="Paste OAuth token here after authorization"
										onChange={(e) => {
											if (e.target.value) {
												setHeaders(JSON.stringify({ Authorization: `Bearer ${e.target.value}` }, null, 2));
											}
										}}
									/>
								</div>
							)}
						</div>
					</div>
				)}

				<div className="space-y-2">
					<Label htmlFor="transport-type">Transport Type</Label>
					<Select
						value={transportType}
						onValueChange={(value) => setTransportType(value as TransportType)}
					>
						<SelectTrigger id="transport-type">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="http">HTTP</SelectItem>
							<SelectItem value="https">HTTPS</SelectItem>
							<SelectItem value="sse">Server-Sent Events (SSE)</SelectItem>
							<SelectItem value="streamable-http">Streamable HTTP</SelectItem>
							<SelectItem value="stdio">STDIO (Local)</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{transportType === "stdio" ? (
					<>
						<div className="space-y-2">
							<Label htmlFor="command">Command</Label>
							<Input
								id="command"
								placeholder="e.g., node or npx"
								value={command}
								onChange={(e) => setCommand(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="args">Arguments (comma-separated)</Label>
							<Input
								id="args"
								placeholder="e.g., server.js, --port, 3000"
								value={args}
								onChange={(e) => setArgs(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="env-vars">Environment Variables (JSON)</Label>
							<textarea
								id="env-vars"
								placeholder='{"API_KEY": "your-key"}'
								value={envVars}
								onChange={(e) => setEnvVars(e.target.value)}
								className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
								rows={4}
							/>
						</div>
					</>
				) : (
					<>
						<div className="space-y-2">
							<Label htmlFor="url">URL</Label>
							<Input
								id="url"
								placeholder="e.g., https://mcp.example.com/mcp"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="headers">Headers (JSON)</Label>
							<textarea
								id="headers"
								placeholder='{"Authorization": "Bearer token"}'
								value={headers}
								onChange={(e) => setHeaders(e.target.value)}
								className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
								rows={3}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="env-vars">Environment Variables (JSON, optional)</Label>
							<textarea
								id="env-vars"
								placeholder='{"API_KEY": "your-key"}'
								value={envVars}
								onChange={(e) => setEnvVars(e.target.value)}
								className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
								rows={3}
							/>
						</div>
					</>
				)}

					<div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
						<Button
							onClick={handleConnect}
							disabled={addConnection.isPending}
							className="flex-1"
							size="lg"
						>
							{addConnection.isPending ? "Connecting..." : "Connect"}
						</Button>
						<Button variant="outline" onClick={onClose} size="lg">
							Cancel
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}


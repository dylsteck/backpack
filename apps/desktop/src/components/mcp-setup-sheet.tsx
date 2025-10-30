import { useState, useEffect } from "react";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	Button,
	Label,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Badge,
} from "@cortex/ui/components";
import { toast } from "sonner";
import { trpc } from "@/utils/trpc";
import { authClient } from "@/lib/auth-client";
import type { CursorServer, TransportType } from "@cortex/shared/types/mcp";

interface MCPSetupSheetProps {
	isOpen: boolean;
	onClose: () => void;
	server: CursorServer | null;
}

export default function MCPSetupSheet({ isOpen, onClose, server }: MCPSetupSheetProps) {
	console.log("MCPSetupSheet render - isOpen:", isOpen, "server:", server?.name);
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
			handleClose();
		},
		onError: (error: any) => {
			toast.error(`Failed to connect: ${error.message}`);
		},
	});

	useEffect(() => {
		if (isOpen && server?.config) {
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
	}, [isOpen, server]);

	// Reset state when sheet closes
	useEffect(() => {
		if (!isOpen) {
			setTransportType("http");
			setCommand("");
			setArgs("");
			setUrl("");
			setHeaders("");
			setEnvVars("");
			setIsOAuthFlow(false);
			setOauthSessionId(null);
		}
	}, [isOpen]);

	const handleClose = () => {
		setTransportType("http");
		setCommand("");
		setArgs("");
		setUrl("");
		setHeaders("");
		setEnvVars("");
		setIsOAuthFlow(false);
		setOauthSessionId(null);
		onClose();
	};

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

	useEffect(() => {
		if (isOpen && server) {
			console.log("Sheet should be open now - isOpen:", isOpen, "server:", server.name);
		}
	}, [isOpen, server]);

	// Don't render Sheet at all if no server
	if (!server) {
		return null;
	}

	return (
		<Sheet 
			open={isOpen} 
			onOpenChange={(open) => {
				console.log("Sheet onOpenChange called:", open, "current server:", server?.name);
				if (!open) {
					handleClose();
				}
			}}
		>
			<SheetContent className="overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Connect to {server.name}</SheetTitle>
					<SheetDescription>
						{server.description || "Configure the connection settings for this MCP server"}
					</SheetDescription>
				</SheetHeader>

				<div className="mt-6 space-y-6">
					{server.oauth && (
						<Badge variant="secondary">OAuth Required</Badge>
					)}
					{server.transport && server.transport.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{server.transport.map((t) => (
								<Badge key={t} variant="outline">{t}</Badge>
							))}
						</div>
					)}

					{server.oauth && transportType !== "stdio" && (
						<div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
							<p className="text-sm text-blue-900 dark:text-blue-100 mb-2">
								This server requires OAuth authentication
							</p>
							{!oauthSessionId ? (
								<Button onClick={initiateOAuth} variant="outline" size="sm">
									Start OAuth Flow
								</Button>
							) : (
								<div className="space-y-2">
									<p className="text-xs text-blue-700 dark:text-blue-300">
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

					<div className="flex gap-3 pt-4">
						<Button
							onClick={handleConnect}
							disabled={addConnection.isPending}
							className="flex-1"
						>
							{addConnection.isPending ? "Connecting..." : "Connect"}
						</Button>
						<Button variant="outline" onClick={handleClose}>
							Cancel
						</Button>
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}


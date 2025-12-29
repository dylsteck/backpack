import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { AppSetupDialog } from "../AppSetupDialog";
import { cn } from "@/utils/tailwind";

interface AppSettingsProps {
	app: {
		id: string;
		name: string;
		description: string;
		oauth: boolean;
		iconUrl: string;
		config: {
			url?: string;
			command?: string;
			args?: string[];
			env?: Record<string, string>;
			headers?: Record<string, string>;
			oas?: string;
		};
		connectionType?: string;
		connection?: {
			id: string;
			status: "connected" | "disconnected" | "error";
			credentialStorage: string;
			secretUri?: string | null;
			transportType: string;
			transportConfig: any;
			connectionMetadata?: any;
		} | null;
	};
	isConnected: boolean;
}

export function AppSettings({ app, isConnected }: AppSettingsProps) {
	const [showApiKey, setShowApiKey] = React.useState(false);
	const [isSetupOpen, setIsSetupOpen] = React.useState(false);
	const utils = (trpc as any).useUtils();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { refetch: refetchApps } = (trpc as any).apps.getAvailableServers.useQuery(undefined, {
		enabled: false, // Only refetch manually
	});

	const disconnectMutation = (trpc as any).apps.removeConnection.useMutation({
		onSuccess: () => {
			utils.apps.getAvailableServers.invalidate();
			utils.timeline.getTimeline.invalidate();
		},
	});

	const handleDialogClose = React.useCallback((open: boolean) => {
		setIsSetupOpen(open);
		if (!open) {
			// Refetch apps to update connection status
			refetchApps();
			utils.apps.getAvailableServers.invalidate();
			utils.timeline.getTimeline.invalidate();
		}
	}, [refetchApps, utils]);

	const handleDisconnect = async () => {
		if (!app.connection?.id) return;
		
		if (confirm(`Are you sure you want to disconnect ${app.name}?`)) {
			try {
				await disconnectMutation.mutateAsync({ id: app.connection.id });
			} catch (error) {
				console.error("Error disconnecting:", error);
			}
		}
	};


	const maskApiKey = (key: string | null | undefined) => {
		if (!key) return "Not set";
		if (key.length <= 8) return "••••••••";
		return `${key.substring(0, 4)}${"•".repeat(key.length - 8)}${key.substring(key.length - 4)}`;
	};

	const getStatusBadge = () => {
		if (!isConnected) {
			return (
				<Badge variant="outline" className="flex items-center gap-1">
					<XCircle className="h-3 w-3" />
					Disconnected
				</Badge>
			);
		}

		if (app.connection?.status === "error") {
			return (
				<Badge variant="destructive" className="flex items-center gap-1">
					<AlertCircle className="h-3 w-3" />
					Error
				</Badge>
			);
		}

		return (
			<Badge variant="default" className="flex items-center gap-1 bg-green-600 hover:bg-green-700">
				<CheckCircle2 className="h-3 w-3" />
				Connected
			</Badge>
		);
	};

	return (
		<div className="space-y-6">
			{/* Connection Status */}
			<div className="space-y-2">
				<h3 className="text-sm font-semibold">Connection Status</h3>
				<div className="flex items-center gap-2">
					{getStatusBadge()}
				</div>
			</div>

			{/* Connection Details */}
			{isConnected && app.connection && (
				<div className="space-y-4">

					{/* API Key (for apps that use API keys) */}
					{(app.id === "farcaster" || app.connectionType === "api") && (
						<div className="space-y-2">
							<label className="text-sm font-semibold">API Key</label>
							<div className="flex items-center gap-2">
								<div className="flex-1 px-3 py-2 rounded-md border bg-muted font-mono text-sm">
									{showApiKey 
										? (app.connection.connectionMetadata?.apiKey || "Not available")
										: maskApiKey(app.connection.connectionMetadata?.apiKey)
									}
								</div>
								<Button
									variant="outline"
									size="icon"
									onClick={() => setShowApiKey(!showApiKey)}
								>
									{showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								API keys are stored securely and encrypted
							</p>
						</div>
					)}

					{/* OAuth Status */}
					{app.oauth && (
						<div className="space-y-2">
							<label className="text-sm font-semibold">OAuth Status</label>
							<div className="px-3 py-2 rounded-md border bg-muted text-sm">
								{app.connection.connectionMetadata?.accountIds 
									? `Connected with ${app.connection.connectionMetadata.accountIds.length} account(s)`
									: "OAuth connection active"
								}
							</div>
						</div>
					)}

					{/* Connection Metadata (for debugging - hide accountIds as they're shown above) */}
					{app.connection.connectionMetadata && Object.keys(app.connection.connectionMetadata).length > 0 && (
						<div className="space-y-2">
							<label className="text-sm font-semibold">Connection Details</label>
							<div className="px-3 py-2 rounded-md border bg-muted text-sm space-y-1 max-h-48 overflow-y-auto">
								{Object.entries(app.connection.connectionMetadata).map(([key, value]) => {
									if (key === "apiKey") return null; // Already shown above
									return (
										<div key={key} className="flex justify-between gap-2">
											<span className="text-muted-foreground capitalize shrink-0">{key.replace(/_/g, " ")}:</span>
											<span className="font-mono text-xs break-all text-right">{Array.isArray(value) ? JSON.stringify(value) : String(value)}</span>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Transport Type */}
					<div className="space-y-2">
						<label className="text-sm font-semibold">Transport Type</label>
						<div className="px-3 py-2 rounded-md border bg-muted text-sm">
							{app.connection.transportType}
						</div>
					</div>
				</div>
			)}

			{/* Actions */}
			<div className="flex flex-col gap-2 pt-4 border-t">
				<div className="flex gap-2">
					{isConnected ? (
						<>
							<Button
								variant="outline"
								onClick={() => setIsSetupOpen(true)}
							>
								Edit Connection
							</Button>
							<Button
								variant="destructive"
								onClick={handleDisconnect}
								disabled={disconnectMutation.isPending}
							>
								{disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
							</Button>
						</>
					) : (
						<Button
							onClick={() => setIsSetupOpen(true)}
						>
							Connect
						</Button>
					)}
				</div>
			</div>

			<AppSetupDialog
				app={app}
				open={isSetupOpen}
				onOpenChange={handleDialogClose}
			/>
		</div>
	);
}


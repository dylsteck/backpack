import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, XCircle, AlertCircle, Eye, EyeOff, RefreshCw } from "lucide-react";
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
	const [isSyncing, setIsSyncing] = React.useState(false);
	const utils = (trpc as any).useUtils();

	// Fetch account details if not stored (for backward compatibility)
	const { data: connectedAccountsData } = (trpc as any).stripe.getConnectedAccounts.useQuery(
		{},
		{
			enabled: app.id === "stripe" && isConnected && 
				(!app.connection?.connectionMetadata?.accountDetails || 
				 (app.connection.connectionMetadata.accountDetails as any[]).length === 0),
		}
	);

	const disconnectMutation = (trpc as any).apps.removeConnection.useMutation({
		onSuccess: () => {
			utils.apps.getAvailableServers.invalidate();
		},
	});

	const syncTransactionsMutation = (trpc as any).stripe.syncAccountTransactions.useMutation({
		onSuccess: () => {
			utils.timeline.getTimeline.invalidate();
			setIsSyncing(false);
		},
		onError: () => {
			setIsSyncing(false);
		},
	});

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

	const handleSyncTransactions = async () => {
		if (!app.connection?.connectionMetadata?.accountIds) {
			alert("No accounts connected");
			return;
		}

		setIsSyncing(true);
		const accountIds = app.connection.connectionMetadata.accountIds as string[];
		let totalSynced = 0;
		
		try {
			for (const accountId of accountIds) {
				const result = await syncTransactionsMutation.mutateAsync({ accountId });
				totalSynced += result.transactions_synced || 0;
			}
			
			if (totalSynced > 0) {
				alert(`Successfully synced ${totalSynced} transaction(s) from ${accountIds.length} account(s)`);
			} else {
				alert(`No new transactions found. This is normal if:\n- Your accounts have no recent transactions\n- Transactions haven't been synced yet by Stripe\n- You're using test mode with test accounts`);
			}
			
			// Invalidate timeline to refresh
			utils.timeline.getTimeline.invalidate();
			// Also trigger refetch if available
			if ((window as any).refetchStripeTimeline) {
				(window as any).refetchStripeTimeline();
			}
		} catch (error: any) {
			console.error("Error syncing transactions:", error);
			const errorMsg = error?.data?.message || error?.message || "Unknown error";
			alert(`Failed to sync transactions: ${errorMsg}`);
		} finally {
			setIsSyncing(false);
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
					{/* Connected Accounts (for Stripe) */}
					{app.id === "stripe" && (
						<div className="space-y-2">
							<label className="text-sm font-semibold">Connected Accounts</label>
							{app.connection.connectionMetadata?.accountIds && (app.connection.connectionMetadata.accountIds as string[]).length > 0 ? (
								<>
									<div className="px-3 py-2 rounded-md border bg-muted text-sm">
										{(app.connection.connectionMetadata.accountIds as string[]).length} account(s) connected
									</div>
									{(app.connection.connectionMetadata.accountIds as string[]).map((accountId: string, idx: number) => {
										// Try to get account details from connectionMetadata first
										let accountDetails = (app.connection.connectionMetadata?.accountDetails as any[])?.find(
											(acc: any) => acc.id === accountId
										);
										
										// Fallback to fetched account details if not stored (for backward compatibility)
										if (!accountDetails && connectedAccountsData?.accounts) {
											accountDetails = connectedAccountsData.accounts.find(
												(acc: any) => acc.id === accountId
											);
										}
										
										// Build display name: display_name or institution_name + last4, fallback to accountId
										let displayName = accountId;
										if (accountDetails) {
											if (accountDetails.display_name) {
												displayName = accountDetails.display_name;
											} else if (accountDetails.institution_name) {
												const parts = [accountDetails.institution_name];
												if (accountDetails.last4) {
													parts.push(`••••${accountDetails.last4}`);
												}
												displayName = parts.join(" ");
											}
										}
										
										return (
											<div key={idx} className="px-3 py-2 rounded-md border bg-muted/50 text-sm">
												<div className="font-medium">{displayName}</div>
												{accountDetails && (accountDetails.institution_name || accountDetails.last4) && (
													<div className="text-xs text-muted-foreground mt-1">
														{accountDetails.institution_name && <span>{accountDetails.institution_name}</span>}
														{accountDetails.institution_name && accountDetails.last4 && <span> • </span>}
														{accountDetails.last4 && <span className="font-mono">••••{accountDetails.last4}</span>}
													</div>
												)}
												{!accountDetails && (
													<div className="text-xs text-muted-foreground font-mono mt-1 break-all">
														{accountId}
													</div>
												)}
											</div>
										);
									})}
								</>
							) : (
								<div className="px-3 py-2 rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground">
									No accounts connected. Please reconnect Stripe to add accounts.
								</div>
							)}
						</div>
					)}

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
									if (key === "accountIds" && app.id === "stripe") return null; // Already shown above
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
				{isConnected && app.id === "stripe" && (
					<Button
						variant="outline"
						onClick={handleSyncTransactions}
						disabled={isSyncing || !app.connection?.connectionMetadata?.accountIds || (app.connection.connectionMetadata.accountIds as string[]).length === 0}
						className="w-full"
					>
						<RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
						{isSyncing ? "Syncing Transactions..." : "Sync Transactions"}
					</Button>
				)}
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
				onOpenChange={setIsSetupOpen}
			/>
		</div>
	);
}


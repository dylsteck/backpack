import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import MCPServerCard from "@/components/mcp-server-card";
import MCPSetupPanel from "@/components/mcp-setup-panel";
import { trpc } from "@/utils/trpc";
import { Badge, Button } from "@cortex/ui/components";
import { Skeleton } from "@cortex/ui/components";
import { ArrowLeft } from "lucide-react";
import type { CursorServer } from "@cortex/shared/types/mcp";

export const Route = createFileRoute("/connections")({
	component: ConnectionsPage,
});

function ConnectionsPage() {
	const { data: session, isPending: sessionPending } = authClient.useSession();
	const [selectedServer, setSelectedServer] = useState<CursorServer | null>(null);

	const { data: serversData, isLoading } = trpc.mcp.getAvailableServers.useQuery();

	const { data: userConnections } = trpc.mcp.getUserConnections.useQuery(undefined, {
		enabled: !!session?.user,
	});

	const servers: CursorServer[] = (serversData as { servers?: CursorServer[] })?.servers || [];

	const handleServerClick = (server: CursorServer) => {
		setSelectedServer(server);
	};

	if (sessionPending) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-96 w-full" />
			</div>
		);
	}

	if (!session?.user) {
		return <Navigate to="/login" />;
	}

	return (
		<div className="space-y-6 max-w-7xl mx-auto">
			<div className="flex items-center justify-between">
				<div className="space-y-1">
					<h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
						MCP Connections
					</h1>
					<p className="text-sm text-slate-600 dark:text-slate-400">
						Browse and connect to Model Context Protocol servers
					</p>
				</div>
				{userConnections && userConnections.length > 0 && (
					<Badge variant="secondary" className="text-sm font-medium px-3 py-1.5">
						{userConnections.length} connected
					</Badge>
				)}
			</div>

			{selectedServer ? (
				<div className="space-y-4">
					<Button
						variant="ghost"
						onClick={() => setSelectedServer(null)}
						className="gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
					>
						<ArrowLeft className="h-4 w-4" />
						Back to servers
					</Button>
					<MCPSetupPanel
						server={selectedServer}
						onClose={() => setSelectedServer(null)}
					/>
				</div>
			) : (
				<>
					{isLoading ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							{Array.from({ length: 8 }).map((_, i) => (
								<Skeleton key={i} className="h-48 w-full rounded-xl" />
							))}
						</div>
					) : servers.length === 0 ? (
						<div className="flex items-center justify-center min-h-[40vh]">
							<div className="text-center space-y-2">
								<p className="text-lg font-medium text-slate-900 dark:text-slate-100">
									No servers found
								</p>
								<p className="text-sm text-slate-600 dark:text-slate-400">
									Try adjusting your search or filters
								</p>
							</div>
						</div>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							{servers.map((server) => (
								<MCPServerCard
									key={server.id}
									server={server}
									onClick={() => handleServerClick(server)}
								/>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}


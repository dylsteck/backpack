import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useState, useMemo } from "react";
import MCPServerCard from "@/components/mcp-server-card";
import MCPFilters from "@/components/mcp-filters";
import MCPSetupSheet from "@/components/mcp-setup-sheet";
import { trpc } from "@/utils/trpc";
import Loader from "@/components/loader";
import { Badge } from "@cortex/shared/components";

export const Route = createFileRoute("/connections")({
	component: ConnectionsPage,
});

interface MCPServer {
	id: string;
	name: string;
	description?: string;
	vendor?: string;
	categories?: string[];
}

function ConnectionsPage() {
	const { data: session, isPending: sessionPending } = authClient.useSession();
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
	const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
	const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
	const [isSetupSheetOpen, setIsSetupSheetOpen] = useState(false);

	const { data: serversData, isLoading: serversLoading, error } = trpc.mcp.getAvailableServers.useQuery();
	const { data: userConnections } = trpc.mcp.getUserConnections.useQuery(undefined, {
		enabled: !!session?.user,
	});

	// Debug: log the data
	console.log("Servers data:", serversData);
	console.log("Error:", error);

	// Extract server data from the nested structure
	const servers: MCPServer[] = (serversData?.servers || []).map((item: any) => ({
		id: item.server?.name || "",
		name: item.server?.name || "",
		description: item.server?.description || "",
		vendor: item.server?.name?.split("/")[0] || "",
		categories: item.server?.categories || [],
	}));

	// Extract unique vendors and categories
	const { availableVendors, availableCategories } = useMemo(() => {
		const vendors = new Set<string>();
		const categories = new Set<string>();

		servers.forEach((server) => {
			if (server.vendor) vendors.add(server.vendor);
			if (server.categories) {
				server.categories.forEach((cat: string) => categories.add(cat));
			}
		});

		return {
			availableVendors: Array.from(vendors).sort(),
			availableCategories: Array.from(categories).sort(),
		};
	}, [servers]);

	// Filter servers based on search and filters
	const filteredServers = useMemo(() => {
		return servers.filter((server) => {
			// Search filter
			const matchesSearch =
				searchQuery === "" ||
				server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				server.description?.toLowerCase().includes(searchQuery.toLowerCase());

			// Vendor filter
			const matchesVendor =
				selectedVendors.length === 0 ||
				(server.vendor && selectedVendors.includes(server.vendor));

			// Category filter
			const matchesCategory =
				selectedCategories.length === 0 ||
				(server.categories &&
					server.categories.some((cat: string) => selectedCategories.includes(cat)));

			return matchesSearch && matchesVendor && matchesCategory;
		});
	}, [servers, searchQuery, selectedVendors, selectedCategories]);

	const handleServerClick = (server: MCPServer) => {
		setSelectedServer(server);
		setIsSetupSheetOpen(true);
	};

	if (sessionPending || serversLoading) {
		return <Loader />;
	}

	if (!session?.user) {
		return <Navigate to="/login" />;
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<h1 className="text-4xl font-bold mb-2">MCP Connections</h1>
					<p className="text-slate-600 dark:text-slate-400">
						Browse and connect to Model Context Protocol servers
					</p>
				</div>
				{userConnections && userConnections.length > 0 && (
					<Badge variant="secondary" className="text-sm px-4 py-2">
						{userConnections.length} connected
					</Badge>
				)}
			</div>

			<div className="mb-6">
				<MCPFilters
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					selectedVendors={selectedVendors}
					onVendorsChange={setSelectedVendors}
					selectedCategories={selectedCategories}
					onCategoriesChange={setSelectedCategories}
					availableVendors={availableVendors}
					availableCategories={availableCategories}
				/>
			</div>

			{filteredServers.length === 0 ? (
				<div className="flex items-center justify-center min-h-[40vh]">
					<div className="text-center">
						<p className="text-xl text-slate-400 dark:text-slate-500">
							No MCP servers found
						</p>
						<p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
							Try adjusting your search or filters
						</p>
					</div>
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{filteredServers.map((server) => (
						<MCPServerCard
							key={server.id}
							server={server}
							onClick={() => handleServerClick(server)}
						/>
					))}
				</div>
			)}

			<MCPSetupSheet
				isOpen={isSetupSheetOpen}
				onClose={() => setIsSetupSheetOpen(false)}
				server={selectedServer}
			/>
		</div>
	);
}


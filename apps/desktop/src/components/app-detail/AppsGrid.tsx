import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { Connection, StatusResult } from "@backpack/sdk";
import { backpack } from "@/lib/backpack-client";
import {
	Card,
	CardContent,
	CardDescription,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AppSummary {
	id: string;
	name: string;
	description: string;
	iconUrl: string;
	connectionType: string;
	oauth: boolean;
}

interface AppRow {
	app: AppSummary;
	connected: boolean;
	itemCount: number;
}

function buildRows(
	apps: AppSummary[],
	connections: Connection[],
	status: StatusResult | undefined,
): AppRow[] {
	const connectedIds = new Set(
		connections
			.filter((c) => c.status === "connected" || c.status === "active")
			.map((c) => c.appId),
	);
	const countsBySource = new Map<string, number>();
	for (const row of status?.items ?? []) {
		countsBySource.set(
			row.source,
			(countsBySource.get(row.source) ?? 0) + row.count,
		);
	}
	return apps.map((app) => ({
		app,
		connected: connectedIds.has(app.id),
		itemCount: countsBySource.get(app.id) ?? 0,
	}));
}

export function AppsGrid() {
	const apps = useQuery({
		queryKey: ["apps"],
		queryFn: () => backpack.apps(),
	});
	const connections = useQuery({
		queryKey: ["connections"],
		queryFn: () => backpack.connections(),
	});
	const status = useQuery({
		queryKey: ["status"],
		queryFn: () => backpack.status(),
	});

	const rows = useMemo<AppRow[]>(
		() =>
			apps.data
				? buildRows(apps.data, connections.data ?? [], status.data)
				: [],
		[apps.data, connections.data, status.data],
	);

	const isLoading = apps.isLoading;
	const error = apps.error ?? connections.error ?? status.error;

	return (
		<div className="flex h-full flex-col">
			<header className="flex h-12 items-center border-b px-6 text-sm font-medium">
				Apps
			</header>
			<div className="flex-1 overflow-y-auto p-6">
				{isLoading && (
					<p className="text-sm text-muted-foreground">Loading…</p>
				)}
				{error && (
					<p className="text-sm text-destructive">
						{(error as Error).message}
					</p>
				)}
				{!isLoading && !error && rows.length === 0 && (
					<p className="text-sm text-muted-foreground">
						No apps available yet.
					</p>
				)}
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{rows.map(({ app, connected, itemCount }) => (
						<Link
							key={app.id}
							to="/apps/$appId"
							params={{ appId: app.id }}
							className="block"
						>
							<Card className="h-full transition-colors hover:bg-accent">
								<CardContent className="flex h-full flex-col gap-2 p-4">
									<div className="flex items-start justify-between gap-2">
										<CardTitle className="text-sm">{app.name}</CardTitle>
										<span
											className={cn(
												"flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
												connected
													? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
													: "border-border text-muted-foreground",
											)}
										>
											<span
												className={cn(
													"h-1.5 w-1.5 rounded-full",
													connected ? "bg-emerald-500" : "bg-muted-foreground/50",
												)}
											/>
											{connected ? "Connected" : "Not connected"}
										</span>
									</div>
									<CardDescription className="line-clamp-2">
										{app.description}
									</CardDescription>
									<div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
										<span>{app.connectionType}</span>
										<span className="tabular-nums">
											{itemCount.toLocaleString()}{" "}
											{itemCount === 1 ? "item" : "items"}
										</span>
									</div>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			</div>
		</div>
	);
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { Connection, Item } from "@backpack/sdk";
import { backpack } from "@/lib/backpack-client";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardTitle,
} from "@/components/ui/card";
import { useDetailSidebar } from "@/contexts/DetailSidebarContext";
import { DateSeparator } from "@/components/timeline/DateSeparator";
import { TimelineEntry } from "@/components/timeline/entries";
import { formatDateKey, formatRelative } from "@/components/timeline/format";
import { cn } from "@/lib/utils";

type TabId = "home" | "settings";

interface DayGroup {
	dateKey: string;
	items: Item[];
}

function groupByDay(items: Item[]): DayGroup[] {
	const groups: DayGroup[] = [];
	let current: DayGroup | null = null;
	for (const item of items) {
		const key = formatDateKey(item.timestamp);
		if (!current || current.dateKey !== key) {
			current = { dateKey: key, items: [] };
			groups.push(current);
		}
		current.items.push(item);
	}
	return groups;
}

function TabButton({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"relative h-9 rounded-lg px-3 text-[13px] font-medium transition-all duration-200 ease-out",
				active
					? "text-foreground"
					: "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
			)}
		>
			{label}
			{active && (
				<span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
			)}
		</button>
	);
}

function StatusPill({ connected }: { connected: boolean }) {
	return (
		<span
			className={cn(
				"flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
				connected
					? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
					: "bg-muted text-muted-foreground",
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
	);
}

function HomeTab({ appId }: { appId: string }) {
	const { show } = useDetailSidebar();
	const timeline = useQuery({
		queryKey: ["timeline", "app", appId],
		queryFn: () => backpack.timeline({ source: appId, limit: 50 }),
	});

	const groups = useMemo(
		() => groupByDay(timeline.data?.items ?? []),
		[timeline.data],
	);

	if (timeline.isLoading) {
		return <p className="text-sm text-muted-foreground">Loading…</p>;
	}
	if (timeline.error) {
		return (
			<p className="text-sm text-destructive">
				{(timeline.error as Error).message}
			</p>
		);
	}
	if (groups.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				No items for this app yet.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			{groups.map((group) => (
				<section key={group.dateKey} className="flex flex-col gap-2">
					<DateSeparator dateKey={group.dateKey} />
					<ul className="flex flex-col gap-1">
						{group.items.map((item) => (
							<li key={item.id}>
								<TimelineEntry item={item} onClick={() => show(item)} />
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

function SettingsTab({
	appId,
	app,
}: {
	appId: string;
	app: {
		id: string;
		name: string;
		description: string;
		connectionType: string;
		oauth: boolean;
	} | null;
}) {
	const connections = useQuery({
		queryKey: ["connections"],
		queryFn: () => backpack.connections(),
	});
	const dbPath = useQuery({
		queryKey: ["dbPath"],
		queryFn: () => backpack.dbPath(),
	});

	const appConnections = useMemo<Connection[]>(
		() => (connections.data ?? []).filter((c) => c.appId === appId),
		[connections.data, appId],
	);

	return (
		<div className="flex flex-col gap-6">
			{app && (
				<Card>
					<CardContent className="flex flex-col gap-2 p-4">
						<CardTitle className="text-sm">About</CardTitle>
						<CardDescription>{app.description}</CardDescription>
						<dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
							<dt className="text-muted-foreground">Connection type</dt>
							<dd className="text-foreground">{app.connectionType}</dd>
							<dt className="text-muted-foreground">OAuth required</dt>
							<dd className="text-foreground">{app.oauth ? "Yes" : "No"}</dd>
						</dl>
					</CardContent>
				</Card>
			)}

			<section className="flex flex-col gap-3">
				<h2 className="text-sm font-semibold">Connections</h2>
				{connections.isLoading && (
					<p className="text-sm text-muted-foreground">Loading…</p>
				)}
				{connections.error && (
					<p className="text-sm text-destructive">
						{(connections.error as Error).message}
					</p>
				)}
				{!connections.isLoading && appConnections.length === 0 && (
					<p className="text-sm text-muted-foreground">
						No connections configured.
					</p>
				)}
				<ul className="flex flex-col gap-3">
					{appConnections.map((conn) => {
						const connected =
							conn.status === "connected" || conn.status === "active";
						return (
							<li key={conn.id}>
								<Card>
									<CardContent className="flex flex-col gap-2 p-4">
										<div className="flex items-start justify-between gap-2">
											<CardTitle className="text-sm">{conn.appName}</CardTitle>
											<StatusPill connected={connected} />
										</div>
										<dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
											<dt className="text-muted-foreground">Transport</dt>
											<dd className="text-foreground">{conn.transportType}</dd>
											<dt className="text-muted-foreground">Status</dt>
											<dd className="text-foreground">{conn.status}</dd>
											<dt className="text-muted-foreground">Last synced</dt>
											<dd className="text-foreground">
												{conn.lastSyncedAt
													? formatRelative(conn.lastSyncedAt)
													: "Never"}
											</dd>
											<dt className="text-muted-foreground">Created</dt>
											<dd className="text-foreground">
												{formatRelative(conn.createdAt)}
											</dd>
										</dl>
									</CardContent>
								</Card>
							</li>
						);
					})}
				</ul>
			</section>

			<section className="flex flex-col gap-2">
				<h2 className="text-sm font-semibold">Database</h2>
				<Card>
					<CardContent className="p-4">
						<p className="text-xs text-muted-foreground">Path</p>
						<p className="mt-1 truncate font-mono text-xs">
							{dbPath.data ?? "—"}
						</p>
					</CardContent>
				</Card>
			</section>
		</div>
	);
}

export function AppDetail() {
	const { appId } = useParams({ from: "/apps/$appId" });
	const [tab, setTab] = useState<TabId>("home");

	const apps = useQuery({
		queryKey: ["apps"],
		queryFn: () => backpack.apps(),
	});
	const connections = useQuery({
		queryKey: ["connections"],
		queryFn: () => backpack.connections(),
	});

	const app = useMemo(
		() => apps.data?.find((a) => a.id === appId) ?? null,
		[apps.data, appId],
	);
	const connected = useMemo(() => {
		const list = connections.data ?? [];
		return list.some(
			(c) =>
				c.appId === appId &&
				(c.status === "connected" || c.status === "active"),
		);
	}, [connections.data, appId]);

	const notFound = !apps.isLoading && !apps.error && !app;

	return (
		<div className="flex h-full flex-col">
			<header className="sticky top-0 z-20 flex h-10 items-center gap-3 bg-background/80 px-8 text-sm font-medium shadow-[0_1px_0_0_hsl(var(--border)/0.45)] backdrop-blur-2xl">
				<Button asChild variant="ghost" size="icon">
					<Link to="/apps">
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<span className="truncate">{app?.name ?? appId}</span>
				{app && <StatusPill connected={connected} />}
			</header>

			{app && (
				<div className="sticky top-12 z-20 flex h-9 items-center gap-1 bg-background/80 px-8 shadow-[0_1px_0_0_hsl(var(--border)/0.3)] backdrop-blur-2xl">
					<TabButton
						label="Home"
						active={tab === "home"}
						onClick={() => setTab("home")}
					/>
					<TabButton
						label="Settings"
						active={tab === "settings"}
						onClick={() => setTab("settings")}
					/>
				</div>
			)}

			<div className="flex-1 overflow-y-auto p-8">
				{apps.isLoading && (
					<p className="text-sm text-muted-foreground">Loading…</p>
				)}
				{apps.error && (
					<p className="text-sm text-destructive">
						{(apps.error as Error).message}
					</p>
				)}
				{notFound && (
					<p className="text-sm text-muted-foreground">
						App “{appId}” not found.
					</p>
				)}
				{app && tab === "home" && <HomeTab appId={appId} />}
				{app && tab === "settings" && (
					<SettingsTab appId={appId} app={app} />
				)}
			</div>
		</div>
	);
}

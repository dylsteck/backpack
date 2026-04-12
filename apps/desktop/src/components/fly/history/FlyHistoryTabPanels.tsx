import type { UseQueryResult } from "@tanstack/react-query";
import type { FlyAnalytics, FlySearchRow, FlyVisitRow } from "@backpack/sdk";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisitedPanel } from "./VisitedPanel";
import { SearchesPanel } from "./SearchesPanel";
import { AnalyticsPanel } from "./AnalyticsPanel";

type TabId = "visited" | "analytics" | "searches";

type Props = {
	tab: TabId;
	onTabChange: (t: TabId) => void;
	visitsQuery: UseQueryResult<FlyVisitRow[], Error>;
	searchesQuery: UseQueryResult<FlySearchRow[], Error>;
	analyticsQuery: UseQueryResult<FlyAnalytics, Error>;
};

export function FlyHistoryTabPanels({
	tab,
	onTabChange,
	visitsQuery,
	searchesQuery,
	analyticsQuery,
}: Props) {
	return (
		<div className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
			<Tabs
				value={tab}
				onValueChange={(v) => onTabChange(v as TabId)}
				className="flex flex-col gap-4"
			>
				<TabsList className="w-fit">
					<TabsTrigger value="visited">Visited</TabsTrigger>
					<TabsTrigger value="analytics">Analytics</TabsTrigger>
					<TabsTrigger value="searches">Searches</TabsTrigger>
				</TabsList>
				<TabsContent value="visited" className="mt-0">
					{visitsQuery.isLoading ? (
						<p className="text-sm text-muted-foreground">Loading…</p>
					) : visitsQuery.error ? (
						<p className="text-sm text-destructive">Could not load visits.</p>
					) : (
						<VisitedPanel visits={visitsQuery.data ?? []} />
					)}
				</TabsContent>
				<TabsContent value="analytics" className="mt-0">
					{analyticsQuery.isLoading ? (
						<p className="text-sm text-muted-foreground">Loading…</p>
					) : analyticsQuery.error ? (
						<p className="text-sm text-destructive">Could not load analytics.</p>
					) : analyticsQuery.data ? (
						<AnalyticsPanel data={analyticsQuery.data} />
					) : null}
				</TabsContent>
				<TabsContent value="searches" className="mt-0">
					{searchesQuery.isLoading ? (
						<p className="text-sm text-muted-foreground">Loading…</p>
					) : searchesQuery.error ? (
						<p className="text-sm text-destructive">Could not load searches.</p>
					) : (
						<SearchesPanel rows={searchesQuery.data ?? []} />
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

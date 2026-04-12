import type { UseQueryResult } from "@tanstack/react-query";
import type { FlyAnalytics, FlyVisitRow } from "@backpack/sdk";
import { VisitedPanel } from "./VisitedPanel";
import { AnalyticsPanel } from "./AnalyticsPanel";
import type { FlyHistoryTabId } from "./fly-history-types";

type Props = {
	tab: FlyHistoryTabId;
	visitsQuery: UseQueryResult<FlyVisitRow[], Error>;
	analyticsQuery: UseQueryResult<FlyAnalytics, Error>;
};

export function FlyHistoryTabPanels({ tab, visitsQuery, analyticsQuery }: Props) {
	return (
		<div className="min-h-0 flex-1 overflow-auto bg-background px-3 py-6 md:px-8 md:py-8">
			{tab === "visited" ? (
				visitsQuery.isLoading ? (
					<p className="font-mono text-sm text-muted-foreground">Loading…</p>
				) : visitsQuery.error ? (
					<p className="text-sm text-destructive">Could not load visits.</p>
				) : (
					<VisitedPanel visits={visitsQuery.data ?? []} />
				)
			) : null}
			{tab === "analytics" ? (
				analyticsQuery.isLoading ? (
					<p className="font-mono text-sm text-muted-foreground">Loading…</p>
				) : analyticsQuery.error ? (
					<p className="text-sm text-destructive">Could not load analytics.</p>
				) : analyticsQuery.data ? (
					<AnalyticsPanel data={analyticsQuery.data} />
				) : null
			) : null}
		</div>
	);
}

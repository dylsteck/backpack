import { useState } from "react";
import { FlyHistoryChrome } from "./FlyHistoryChrome";
import { FlyHistoryTabPanels } from "./FlyHistoryTabPanels";
import { useFlyHistoryQueries } from "./useFlyHistoryQueries";
import type { FlyHistoryTabId } from "./fly-history-types";

export function FlyHistoryView() {
	const [filter, setFilter] = useState("");
	const [tab, setTab] = useState<FlyHistoryTabId>("visited");
	const { visitsQuery, analyticsQuery, deleteMut } = useFlyHistoryQueries(filter);

	const onDeleteAll = () => {
		if (
			typeof window !== "undefined" &&
			window.confirm("Delete all Fly browsing history? Tab snapshots stay saved locally.")
		) {
			deleteMut.mutate();
		}
	};

	return (
		<div className="flex flex-1 flex-col overflow-hidden bg-background">
			<FlyHistoryChrome
				tab={tab}
				onTabChange={setTab}
				filter={filter}
				onFilterChange={setFilter}
				deletePending={deleteMut.isPending}
				onDeleteAll={onDeleteAll}
			/>
			<FlyHistoryTabPanels tab={tab} visitsQuery={visitsQuery} analyticsQuery={analyticsQuery} />
		</div>
	);
}

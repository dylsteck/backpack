import { useState } from "react";
import { FlyHistoryChrome } from "./FlyHistoryChrome";
import { FlyHistoryTabPanels } from "./FlyHistoryTabPanels";
import { useFlyHistoryQueries } from "./useFlyHistoryQueries";

export function FlyHistoryView() {
	const [filter, setFilter] = useState("");
	const [tab, setTab] = useState<"visited" | "analytics" | "searches">("visited");
	const { visitsQuery, searchesQuery, analyticsQuery, deleteMut } = useFlyHistoryQueries(filter);

	const onDeleteAll = () => {
		if (
			typeof window !== "undefined" &&
			window.confirm("Delete all Fly browsing history? Tab snapshots stay saved locally.")
		) {
			deleteMut.mutate();
		}
	};

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<FlyHistoryChrome
				filter={filter}
				onFilterChange={setFilter}
				deletePending={deleteMut.isPending}
				onDeleteAll={onDeleteAll}
			/>
			<FlyHistoryTabPanels
				tab={tab}
				onTabChange={setTab}
				visitsQuery={visitsQuery}
				searchesQuery={searchesQuery}
				analyticsQuery={analyticsQuery}
			/>
		</div>
	);
}

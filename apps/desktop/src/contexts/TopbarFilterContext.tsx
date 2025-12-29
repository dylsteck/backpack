import React from "react";
import type { SourceType } from "@/components/filters/SourceFilterDropdown";
import type { ConnectionType, ConnectionStatus } from "@/components/filters/ConnectionFilterDropdown";

export type FilterConfig = 
	| { type: "source"; props: { selectedSources: SourceType[]; onSourceChange: (sources: SourceType[]) => void; sourceCounts?: Record<SourceType, number> } }
	| { type: "connection"; props: { selectedTypes: ConnectionType[]; selectedStatus: ConnectionStatus; onTypeChange: (types: ConnectionType[]) => void; onStatusChange: (status: ConnectionStatus) => void } }
	| null;

interface TopbarFilterContextValue {
	filterConfig: FilterConfig;
	setFilterConfig: (config: FilterConfig) => void;
}

const TopbarFilterContext = React.createContext<TopbarFilterContextValue | null>(null);

export function TopbarFilterProvider({ children }: { children: React.ReactNode }) {
	const [filterConfig, setFilterConfig] = React.useState<FilterConfig>(null);

	const value = React.useMemo(
		() => ({ filterConfig, setFilterConfig }),
		[filterConfig]
	);

	return (
		<TopbarFilterContext.Provider value={value}>
			{children}
		</TopbarFilterContext.Provider>
	);
}

export function useTopbarFilter() {
	const context = React.useContext(TopbarFilterContext);
	if (!context) {
		throw new Error("useTopbarFilter must be used within TopbarFilterProvider");
	}
	return context;
}


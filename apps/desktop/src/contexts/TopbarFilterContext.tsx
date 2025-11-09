import React from "react";

interface TopbarFilterContextValue {
	filterComponent: React.ReactNode | null;
	setFilterComponent: (component: React.ReactNode | null) => void;
}

const TopbarFilterContext = React.createContext<TopbarFilterContextValue | null>(null);

export function TopbarFilterProvider({ children }: { children: React.ReactNode }) {
	const [filterComponent, setFilterComponent] = React.useState<React.ReactNode | null>(null);

	return (
		<TopbarFilterContext.Provider value={{ filterComponent, setFilterComponent }}>
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


import {
	createContext,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from "react";

export type SourceFilter = "all" | string;

interface FilterState {
	source: SourceFilter;
	query: string;
}

interface FilterContextValue extends FilterState {
	setSource: (value: SourceFilter) => void;
	setQuery: (value: string) => void;
	reset: () => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
	const [source, setSource] = useState<SourceFilter>("all");
	const [query, setQuery] = useState("");

	const value = useMemo<FilterContextValue>(
		() => ({
			source,
			query,
			setSource,
			setQuery,
			reset: () => {
				setSource("all");
				setQuery("");
			},
		}),
		[source, query],
	);

	return (
		<FilterContext.Provider value={value}>{children}</FilterContext.Provider>
	);
}

export function useFilters(): FilterContextValue {
	const ctx = useContext(FilterContext);
	if (!ctx) throw new Error("useFilters must be used inside FilterProvider");
	return ctx;
}

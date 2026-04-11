import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import type { Item } from "@backpack/sdk";

interface DetailSidebarState {
	open: boolean;
	item: Item | null;
}

interface DetailSidebarContextValue extends DetailSidebarState {
	show: (item: Item) => void;
	hide: () => void;
}

const DetailSidebarContext = createContext<DetailSidebarContextValue | null>(
	null,
);

export function DetailSidebarProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<DetailSidebarState>({
		open: false,
		item: null,
	});

	const show = useCallback(
		(item: Item) => setState({ open: true, item }),
		[],
	);
	const hide = useCallback(
		() => setState((prev) => ({ open: false, item: prev.item })),
		[],
	);

	const value = useMemo<DetailSidebarContextValue>(
		() => ({ ...state, show, hide }),
		[state, show, hide],
	);

	return (
		<DetailSidebarContext.Provider value={value}>
			{children}
		</DetailSidebarContext.Provider>
	);
}

export function useDetailSidebar(): DetailSidebarContextValue {
	const ctx = useContext(DetailSidebarContext);
	if (!ctx)
		throw new Error(
			"useDetailSidebar must be used inside DetailSidebarProvider",
		);
	return ctx;
}

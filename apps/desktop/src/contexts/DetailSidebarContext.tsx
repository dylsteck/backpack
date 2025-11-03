import React from "react";
import type { BrowserHistoryEntryData, BrowserHistoryGroup } from "@/components/timeline/BrowserHistoryEntry";
import type { FarcasterCastV2 } from "@cortex/api/services/farcaster/types";

type DetailSidebarContextType = {
	historySidebarOpen: boolean;
	setHistorySidebarOpen: (open: boolean) => void;
	selectedHistoryItem: BrowserHistoryEntryData | BrowserHistoryGroup | null;
	setSelectedHistoryItem: (item: BrowserHistoryEntryData | BrowserHistoryGroup | null) => void;
	castSidebarOpen: boolean;
	setCastSidebarOpen: (open: boolean) => void;
	selectedCast: FarcasterCastV2 | null;
	setSelectedCast: (cast: FarcasterCastV2 | null) => void;
};

const DetailSidebarContext = React.createContext<DetailSidebarContextType | null>(null);

export function useDetailSidebar() {
	const context = React.useContext(DetailSidebarContext);
	if (!context) {
		throw new Error("useDetailSidebar must be used within DetailSidebarProvider");
	}
	return context;
}

export function DetailSidebarProvider({ children }: { children: React.ReactNode }) {
	const [historySidebarOpen, setHistorySidebarOpen] = React.useState(false);
	const [selectedHistoryItem, setSelectedHistoryItem] = React.useState<
		BrowserHistoryEntryData | BrowserHistoryGroup | null
	>(null);
	const [castSidebarOpen, setCastSidebarOpen] = React.useState(false);
	const [selectedCast, setSelectedCast] = React.useState<FarcasterCastV2 | null>(null);

	const value = React.useMemo(
		() => ({
			historySidebarOpen,
			setHistorySidebarOpen,
			selectedHistoryItem,
			setSelectedHistoryItem,
			castSidebarOpen,
			setCastSidebarOpen,
			selectedCast,
			setSelectedCast,
		}),
		[historySidebarOpen, selectedHistoryItem, castSidebarOpen, selectedCast]
	);

	return <DetailSidebarContext.Provider value={value}>{children}</DetailSidebarContext.Provider>;
}


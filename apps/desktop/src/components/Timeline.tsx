import React from "react";
import { TimelineEntry } from "./timeline/TimelineEntry";
import { CastEntry } from "./timeline/CastEntry";
import { BrowserHistoryEntry } from "./timeline/BrowserHistoryEntry";
import { TransactionEntry } from "./timeline/TransactionEntry";
import { TimelineDemo } from "./timeline/TimelineDemo";
import { DateSeparator } from "./timeline/DateSeparator";
import { groupBrowserHistory } from "./timeline/browserHistoryUtils";
import { groupTransactions, type TransactionEntryData, type TransactionGroup } from "./timeline/transactionUtils";
import { trpc } from "@/lib/trpc";
import type { FarcasterCastV2 } from "@cortex/api/services/farcaster/types";
import type { BrowserHistoryEntryData, BrowserHistoryGroup } from "./timeline/BrowserHistoryEntry";
import { CastExpandedView } from "./timeline/CastExpandedView";
import { BrowserHistoryExpandedView } from "./timeline/BrowserHistoryExpandedView";
import { TransactionExpandedView } from "./timeline/TransactionExpandedView";
import type { SourceType } from "./filters/SourceFilterDropdown";
import { formatTime, formatDate, groupItemsByDate, formatFullDate } from "@/helpers/timeline-formatting";
import { useTopbarFilter } from "@/contexts/TopbarFilterContext";
import type { AppServer } from "@/hooks/useAppsFilter";

// Types for timeline API responses
type TimelineItem = {
	id: string;
	timestamp: Date | string;
	source: string;
	type: string;
	data: Record<string, unknown>;
};

type TimelinePage = {
	items: TimelineItem[];
	nextCursor?: string;
};

type TimelineResponse = {
	pages: TimelinePage[];
};

type ServerResponse = {
	servers: AppServer[];
};

type BrowserHistoryResult = {
	success: boolean;
	data?: BrowserHistoryEntryData[];
};

export function Timeline() {
	const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = (trpc as unknown as {
		timeline: {
			getTimeline: {
				useInfiniteQuery: (
					input: { limit: number },
					options: {
						getNextPageParam: (lastPage: TimelinePage) => string | undefined;
						staleTime: number;
						gcTime: number;
					}
				) => {
					data?: TimelineResponse;
					isLoading: boolean;
					error: Error | null;
					fetchNextPage: () => void;
					hasNextPage: boolean;
					isFetchingNextPage: boolean;
				};
			};
		};
	}).timeline.getTimeline.useInfiniteQuery(
		{ limit: 25 },
		{
			getNextPageParam: (lastPage: TimelinePage) => lastPage?.nextCursor ?? undefined,
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
		}
	);

	const [chromeHistory, setChromeHistory] = React.useState<BrowserHistoryEntryData[]>([]);
	const [braveHistory, setBraveHistory] = React.useState<BrowserHistoryEntryData[]>([]);
	const [expandedItemId, setExpandedItemId] = React.useState<string | null>(null);
	const [selectedSources, setSelectedSources] = React.useState<SourceType[]>(["all"]);
	const { setFilterConfig } = useTopbarFilter();

	const { data: appsData } = (trpc as unknown as {
		apps: {
			getAvailableServers: {
				useQuery: (
					input: undefined,
					options: { staleTime: number; gcTime: number }
				) => {
					data?: ServerResponse;
				};
			};
		};
	}).apps.getAvailableServers.useQuery(undefined, {
		staleTime: 5 * 60 * 1000, // 5 minutes - apps list doesn't change frequently
		gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
	});
	
	// Memoize icon URLs and connections to prevent unnecessary re-renders
	const iconUrls = React.useMemo(() => {
		if (!appsData?.servers) return {};
		const servers = appsData.servers;
		return {
			farcaster: servers.find((app: AppServer) => app.id === "farcaster")?.iconUrl,
			chrome: servers.find((app: AppServer) => app.id === "chrome")?.iconUrl,
			brave: servers.find((app: AppServer) => app.id === "brave")?.iconUrl,
			stripe: servers.find((app: AppServer) => app.id === "stripe")?.iconUrl,
		};
	}, [appsData]);

	type ConnectionWithMetadata = {
		status: string;
		connectionMetadata?: {
			localPath?: string;
		};
	};

	const connections = React.useMemo(() => {
		if (!appsData?.servers) return {};
		const servers = appsData.servers;
		return {
			chrome: servers.find((app: AppServer) => app.id === "chrome")?.connection as ConnectionWithMetadata | undefined,
			brave: servers.find((app: AppServer) => app.id === "brave")?.connection as ConnectionWithMetadata | undefined,
		};
	}, [appsData]);

	const chromeConnection = connections.chrome;
	const braveConnection = connections.brave;

	const items = React.useMemo(() => {
		if (!data?.pages) return [];
		return data.pages.flatMap((page: TimelinePage) => page.items || []);
	}, [data]);

	React.useEffect(() => {
		if (chromeConnection?.status === "connected") {
			const localPath = chromeConnection.connectionMetadata?.localPath;
			if (localPath) {
				// Check immediately if API is available
				if (window.chromeHistory && typeof window.chromeHistory.readHistory === "function") {
					window.chromeHistory
						.readHistory(localPath)
						.then((result: BrowserHistoryResult) => {
							if (result.success && result.data) {
								setChromeHistory(result.data);
							}
						})
						.catch((err: Error) => {
							console.error("Error reading Chrome history:", err);
						});
				} else {
					// Poll less frequently (every 2 seconds instead of 1 second)
					// Reduced max attempts since we're checking less frequently
					let attemptCount = 0;
					const maxAttempts = 15; // Reduced from 30 since we check every 2s instead of 1s
					const POLL_INTERVAL = 2000; // 2 seconds instead of 1 second
					
					const checkInterval = setInterval(() => {
						attemptCount++;
						if (window.chromeHistory && typeof window.chromeHistory.readHistory === "function") {
							clearInterval(checkInterval);
							window.chromeHistory
								.readHistory(localPath)
								.then((result: BrowserHistoryResult) => {
									if (result.success && result.data) {
										setChromeHistory(result.data);
									}
								})
								.catch((err: Error) => {
									console.error("Error reading Chrome history:", err);
								});
						} else if (attemptCount >= maxAttempts) {
							clearInterval(checkInterval);
							console.warn("[Timeline] Chrome history API not available after maximum attempts");
						}
					}, POLL_INTERVAL);

					return () => {
						clearInterval(checkInterval);
					};
				}
			}
		}
	}, [chromeConnection]);

	React.useEffect(() => {
		if (braveConnection?.status === "connected") {
			const localPath = braveConnection.connectionMetadata?.localPath;
			if (localPath) {
				// Check immediately if API is available
				if (window.braveHistory && typeof window.braveHistory.readHistory === "function") {
					window.braveHistory
						.readHistory(localPath)
						.then((result: BrowserHistoryResult) => {
							if (result.success && result.data) {
								setBraveHistory(result.data);
							}
						})
						.catch((err: Error) => {
							console.error("Error reading Brave history:", err);
						});
				} else {
					// Poll less frequently (every 2 seconds instead of 1 second)
					// Reduced max attempts since we're checking less frequently
					let attemptCount = 0;
					const maxAttempts = 15; // Reduced from 30 since we check every 2s instead of 1s
					const POLL_INTERVAL = 2000; // 2 seconds instead of 1 second
					
					const checkInterval = setInterval(() => {
						attemptCount++;
						if (window.braveHistory && typeof window.braveHistory.readHistory === "function") {
							clearInterval(checkInterval);
							window.braveHistory
								.readHistory(localPath)
								.then((result: BrowserHistoryResult) => {
									if (result.success && result.data) {
										setBraveHistory(result.data);
									}
								})
								.catch((err: Error) => {
									console.error("Error reading Brave history:", err);
								});
						} else if (attemptCount >= maxAttempts) {
							clearInterval(checkInterval);
							console.warn("[Timeline] Brave history API not available after maximum attempts");
						}
					}, POLL_INTERVAL);

					return () => {
						clearInterval(checkInterval);
					};
				}
			}
		}
	}, [braveConnection]);

	// Memoize browser history grouping separately
	const groupedChromeHistory = React.useMemo(() => {
		return groupBrowserHistory(chromeHistory);
	}, [chromeHistory]);

	const groupedBraveHistory = React.useMemo(() => {
		return groupBrowserHistory(braveHistory);
	}, [braveHistory]);

	// Memoize browser history items conversion
	type BrowserHistoryTimelineItem = {
		id: string;
		timestamp: Date;
		source: SourceType;
		type: string;
		data: BrowserHistoryEntryData | BrowserHistoryGroup;
	};

	const chromeHistoryItems = React.useMemo((): BrowserHistoryTimelineItem[] => {
		return groupedChromeHistory.map((entry) => {
			const timestamp = "entries" in entry ? entry.timestamp : new Date(entry.timestamp);
			return {
				id: "entries" in entry ? entry.id : `chrome-${entry.url}-${entry.timestamp}`,
				timestamp,
				source: "chrome" as SourceType,
				type: "browser-history",
				data: entry,
			};
		});
	}, [groupedChromeHistory]);

	const braveHistoryItems = React.useMemo((): BrowserHistoryTimelineItem[] => {
		return groupedBraveHistory.map((entry) => {
			const timestamp = "entries" in entry ? entry.timestamp : new Date(entry.timestamp);
			return {
				id: "entries" in entry ? entry.id : `brave-${entry.url}-${entry.timestamp}`,
				timestamp,
				source: "brave" as SourceType,
				type: "browser-history",
				data: entry,
			};
		});
	}, [groupedBraveHistory]);

	// Memoize server items normalization
	type NormalizedTimelineItem = TimelineItem & {
		timestamp: Date;
	};

	const serverItems = React.useMemo(() => {
		return items.map((item: TimelineItem): NormalizedTimelineItem => ({
			...item,
			timestamp: item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp),
		}));
	}, [items]);

	// Memoize transaction processing separately
	const transactionItems = React.useMemo(() => {
		return serverItems.filter((item: NormalizedTimelineItem) => item.type === "transaction");
	}, [serverItems]);

	const otherServerItems = React.useMemo(() => {
		return serverItems.filter((item: NormalizedTimelineItem) => item.type !== "transaction");
	}, [serverItems]);

	// Memoize transaction entries conversion
	const transactionEntries = React.useMemo((): TransactionEntryData[] => {
		return transactionItems.map((item: NormalizedTimelineItem) => {
			try {
				const data = item.data as Record<string, unknown>;
				return {
					id: item.id,
					account_id: (data?.account_id as string) || (data?.account as string) || "",
					amount: data?.amount as number,
					currency: data?.currency as string,
					description: data?.description as string,
					status: data?.status as string,
					transacted_at: data?.transacted_at as number,
					created: data?.created as number,
					timestamp: item.timestamp,
				};
			} catch (error) {
				console.error(`[Timeline] Error mapping transaction item:`, error, item);
				return null;
			}
		}).filter((entry: TransactionEntryData | null): entry is TransactionEntryData => entry !== null);
	}, [transactionItems]);

	// Memoize transaction grouping
	const groupedTransactions = React.useMemo(() => {
		return groupTransactions(transactionEntries);
	}, [transactionEntries]);

	// Memoize transaction timeline items conversion
	type TransactionTimelineItem = {
		id: string;
		timestamp: Date;
		source: SourceType;
		type: string;
		data: TransactionEntryData | TransactionGroup;
	};

	const transactionTimelineItems = React.useMemo((): TransactionTimelineItem[] => {
		return groupedTransactions.map((entry: TransactionEntryData | TransactionGroup) => {
			const timestamp = "entries" in entry ? entry.timestamp : entry.timestamp;
			return {
				id: "entries" in entry ? entry.id : entry.id,
				timestamp,
				source: "stripe" as SourceType,
				type: "transaction",
				data: entry,
			};
		});
	}, [groupedTransactions]);

	// Unified timeline item type
	type UnifiedTimelineItem = {
		id: string;
		timestamp: Date;
		source: SourceType;
		type: string;
		data: unknown;
	};

	// Final combination and sorting - memoized
	const allItems = React.useMemo((): UnifiedTimelineItem[] => {
		const combined: UnifiedTimelineItem[] = [
			...otherServerItems.map(item => ({
				id: item.id,
				timestamp: item.timestamp,
				source: item.source as SourceType,
				type: item.type,
				data: item.data,
			})),
			...transactionTimelineItems,
			...chromeHistoryItems,
			...braveHistoryItems,
		];
		return combined.sort((a, b) => {
			return b.timestamp.getTime() - a.timestamp.getTime();
		});
	}, [otherServerItems, transactionTimelineItems, chromeHistoryItems, braveHistoryItems]);

	// Filter items based on selected sources
	const filteredItems = React.useMemo(() => {
		if (selectedSources.includes("all")) {
			return allItems;
		}
		return allItems.filter((item) => {
			return selectedSources.includes(item.source);
		});
	}, [allItems, selectedSources]);

	// Calculate source counts for filter display
	const sourceCounts = React.useMemo(() => {
		const counts: Record<SourceType, number> = {
			all: allItems.length,
			farcaster: allItems.filter((item) => item.source === "farcaster").length,
			stripe: allItems.filter((item) => item.source === "stripe").length,
			chrome: allItems.filter((item) => item.source === "chrome").length,
			brave: allItems.filter((item) => item.source === "brave").length,
		};
		return counts;
	}, [allItems]);

	// Set filter component in topbar
	React.useEffect(() => {
		setFilterConfig({
			type: "source",
			props: {
				selectedSources,
				onSourceChange: setSelectedSources,
				sourceCounts,
			},
		});
		return () => setFilterConfig(null);
	}, [selectedSources, sourceCounts, setFilterConfig]);

	// Set up infinite scroll with IntersectionObserver
	const scrollContainerRef = React.useRef<HTMLDivElement>(null);
	const loadMoreRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const first = entries[0];
				if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
				}
			},
			{
				root: scrollContainerRef.current,
				rootMargin: "200px",
			}
		);

		const currentLoadMore = loadMoreRef.current;
		if (currentLoadMore) {
			observer.observe(currentLoadMore);
		}

		return () => {
			if (currentLoadMore) {
				observer.unobserve(currentLoadMore);
			}
		};
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	// Memoize toggle handler factory to prevent creating new functions on every render
	// MUST be called before any conditional returns to follow Rules of Hooks
	const createToggleHandler = React.useCallback((itemId: string) => {
		return () => {
			setExpandedItemId((currentId) => currentId === itemId ? null : itemId);
		};
	}, []);

	// Memoize close handler
	// MUST be called before any conditional returns to follow Rules of Hooks
	const handleCloseExpanded = React.useCallback(() => {
		setExpandedItemId(null);
	}, []);

	if (isLoading) {
		return (
			<div className="flex-1 flex flex-col">
				<div className="flex items-center justify-center bg-background/95 backdrop-blur-sm py-1 sticky top-0 z-30">
					<div className="max-w-3xl mx-auto w-full flex items-center justify-center px-6">
						<div className="flex items-center gap-3">
							<span className="text-sm font-medium text-foreground">Loading...</span>
						</div>
					</div>
				</div>
				<div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
					<div className="max-w-3xl mx-auto py-3 px-3 space-y-6">
						<div className="text-sm text-muted-foreground">Loading timeline...</div>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex-1 flex flex-col">
				<div className="flex items-center justify-center bg-background/95 backdrop-blur-sm py-1 sticky top-0 z-30">
					<div className="max-w-3xl mx-auto w-full flex items-center justify-center px-6">
					</div>
				</div>
				<div className="flex-1 overflow-y-auto flex items-center justify-center">
					<div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
				</div>
			</div>
		);
	}

	const groupedItems = groupItemsByDate(filteredItems);

	return (
		<div className="flex-1 flex flex-col">
			<div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
				<div className="max-w-3xl mx-auto pb-3 px-3 space-y-6 relative">
					{/* Continuous vertical line spanning entire timeline */}
					{filteredItems.length > 0 && allItems.length > 0 && (
						<div className="absolute left-[calc(0.75rem+9.5px)] top-[calc(0.25rem+0.375rem+0.25rem+9.5px)] bottom-0 w-0.5 bg-gray-300 z-0" />
					)}
					{filteredItems.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12">
							<p className="text-muted-foreground">No items match the selected filters.</p>
						</div>
					) : allItems.length === 0 ? (
						<TimelineDemo />
					) : (
						groupedItems.map(([dateKey, dateItems]) => {
							const dateStr = formatFullDate(new Date(dateKey));
							return (
								<div key={dateKey}>
									<DateSeparator date={dateStr} />
									<div className="space-y-6 mt-4">
										{dateItems.map((item: UnifiedTimelineItem) => {
											const time = formatTime(item.timestamp);
											const date = formatDate(item.timestamp);
											const isExpanded = expandedItemId === item.id;
											const handleToggleExpand = createToggleHandler(item.id);

											if (item.type === "cast") {
												const cast = item.data as FarcasterCastV2;
												return (
													<TimelineEntry 
														key={item.id} 
														time={time} 
														date={date} 
														showDot 
														iconUrl={iconUrls.farcaster}
														isExpanded={isExpanded}
														expandedContent={
															<CastExpandedView 
																cast={cast} 
																onClose={handleCloseExpanded}
															/>
														}
													>
														<div
															onClick={handleToggleExpand}
															className="cursor-pointer"
														>
															<CastEntry cast={cast} />
														</div>
													</TimelineEntry>
												);
											}

											if (item.type === "browser-history") {
												const iconUrl = item.source === "brave" ? iconUrls.brave : iconUrls.chrome;
												const historyEntry = item.data as BrowserHistoryEntryData | BrowserHistoryGroup;
												return (
													<TimelineEntry
														key={item.id}
														time={time}
														date={date}
														showDot
														iconUrl={iconUrl}
														isExpanded={isExpanded}
														expandedContent={
															<BrowserHistoryExpandedView 
																entry={historyEntry}
																onClose={handleCloseExpanded}
															/>
														}
													>
														<BrowserHistoryEntry
															entry={historyEntry}
															onClick={handleToggleExpand}
														/>
													</TimelineEntry>
												);
											}

											if (item.type === "transaction") {
												const transactionEntry = item.data as TransactionEntryData | TransactionGroup;
												return (
													<TimelineEntry
														key={item.id}
														time={time}
														date={date}
														showDot
														iconUrl={iconUrls.stripe}
														isExpanded={isExpanded}
														expandedContent={
															<TransactionExpandedView 
																entry={transactionEntry}
																onClose={handleCloseExpanded}
															/>
														}
													>
														<TransactionEntry
															entry={transactionEntry}
															onClick={handleToggleExpand}
														/>
													</TimelineEntry>
												);
											}

											return (
												<TimelineEntry key={item.id} time={time} date={date} showDot>
													<div className="text-sm">{JSON.stringify(item.data)}</div>
												</TimelineEntry>
											);
										})}
									</div>
								</div>
							);
						})
					)}
					{isFetchingNextPage && (
						<div className="text-sm text-muted-foreground text-center py-4">Loading more...</div>
					)}
					{hasNextPage && (
						<div ref={loadMoreRef} className="h-4" />
					)}
				</div>
			</div>
		</div>
	);
}

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
import { SourceFilterDropdown, type SourceType } from "./filters/SourceFilterDropdown";
import { formatTime, formatDate, groupItemsByDate, formatFullDate } from "@/helpers/timeline-formatting";
import { useTopbarFilter } from "@/contexts/TopbarFilterContext";

export function Timeline() {
	const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = (trpc as any).timeline.getTimeline.useInfiniteQuery(
		{ limit: 25 },
		{
			getNextPageParam: (lastPage: any) => lastPage?.nextCursor ?? undefined,
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
		}
	);

	const [chromeHistory, setChromeHistory] = React.useState<BrowserHistoryEntryData[]>([]);
	const [braveHistory, setBraveHistory] = React.useState<BrowserHistoryEntryData[]>([]);
	const [expandedItemId, setExpandedItemId] = React.useState<string | null>(null);
	const [selectedSources, setSelectedSources] = React.useState<SourceType[]>(["all"]);
	const { setFilterComponent } = useTopbarFilter();

	const { data: appsData } = (trpc as any).apps.getAvailableServers.useQuery();
	
	// Memoize icon URLs and connections to prevent unnecessary re-renders
	const iconUrls = React.useMemo(() => {
		if (!appsData?.servers) return {};
		const servers = appsData.servers;
		return {
			farcaster: servers.find((app: any) => app.id === "farcaster")?.iconUrl,
			chrome: servers.find((app: any) => app.id === "chrome")?.iconUrl,
			brave: servers.find((app: any) => app.id === "brave")?.iconUrl,
			stripe: servers.find((app: any) => app.id === "stripe")?.iconUrl,
		};
	}, [appsData]);

	const connections = React.useMemo(() => {
		if (!appsData?.servers) return {};
		const servers = appsData.servers;
		return {
			chrome: servers.find((app: any) => app.id === "chrome")?.connection,
			brave: servers.find((app: any) => app.id === "brave")?.connection,
		};
	}, [appsData]);

	const chromeConnection = connections.chrome;
	const braveConnection = connections.brave;

	const items = React.useMemo(() => {
		if (!data?.pages) return [];
		return data.pages.flatMap((page: any) => page.items || []);
	}, [data]);

	React.useEffect(() => {
		if (chromeConnection?.status === "connected") {
			const localPath = chromeConnection.connectionMetadata?.localPath;
			if (localPath) {
				if (window.chromeHistory && typeof window.chromeHistory.readHistory === "function") {
					window.chromeHistory
						.readHistory(localPath)
						.then((result: any) => {
							if (result.success && result.data) {
								setChromeHistory(result.data);
							}
						})
						.catch((err: any) => {
							console.error("Error reading Chrome history:", err);
						});
				} else {
					let attemptCount = 0;
					const maxAttempts = 30;
					const checkInterval = setInterval(() => {
						attemptCount++;
						if (window.chromeHistory && typeof window.chromeHistory.readHistory === "function") {
							clearInterval(checkInterval);
							window.chromeHistory
								.readHistory(localPath)
								.then((result: any) => {
									if (result.success && result.data) {
										setChromeHistory(result.data);
									}
								})
								.catch((err: any) => {
									console.error("Error reading Chrome history:", err);
								});
						} else if (attemptCount >= maxAttempts) {
							clearInterval(checkInterval);
						}
					}, 1000);

					return () => clearInterval(checkInterval);
				}
			}
		}
	}, [chromeConnection]);

	React.useEffect(() => {
		if (braveConnection?.status === "connected") {
			const localPath = braveConnection.connectionMetadata?.localPath;
			if (localPath) {
				if (window.braveHistory && typeof window.braveHistory.readHistory === "function") {
					window.braveHistory
						.readHistory(localPath)
						.then((result: any) => {
							if (result.success && result.data) {
								setBraveHistory(result.data);
							}
						})
						.catch((err: any) => {
							console.error("Error reading Brave history:", err);
						});
				} else {
					let attemptCount = 0;
					const maxAttempts = 30;
					const checkInterval = setInterval(() => {
						attemptCount++;
						if (window.braveHistory && typeof window.braveHistory.readHistory === "function") {
							clearInterval(checkInterval);
							window.braveHistory
								.readHistory(localPath)
								.then((result: any) => {
									if (result.success && result.data) {
										setBraveHistory(result.data);
									}
								})
								.catch((err: any) => {
									console.error("Error reading Brave history:", err);
								});
						} else if (attemptCount >= maxAttempts) {
							clearInterval(checkInterval);
						}
					}, 1000);

					return () => clearInterval(checkInterval);
				}
			}
		}
	}, [braveConnection]);

	const allItems = React.useMemo(() => {
		const groupedChromeHistory = groupBrowserHistory(chromeHistory);
		const groupedBraveHistory = groupBrowserHistory(braveHistory);

		const chromeHistoryItems = groupedChromeHistory.map((entry) => {
			const timestamp = "entries" in entry ? entry.timestamp : new Date(entry.timestamp);
			return {
				id: "entries" in entry ? entry.id : `chrome-${entry.url}-${entry.timestamp}`,
				timestamp,
				source: "chrome",
				type: "browser-history",
				data: entry,
			};
		});

		const braveHistoryItems = groupedBraveHistory.map((entry) => {
			const timestamp = "entries" in entry ? entry.timestamp : new Date(entry.timestamp);
			return {
				id: "entries" in entry ? entry.id : `brave-${entry.url}-${entry.timestamp}`,
				timestamp,
				source: "brave",
				type: "browser-history",
				data: entry,
			};
		});

		const serverItems = items.map((item: any) => ({
			...item,
			timestamp: item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp),
		}));

		// Process transaction items and group them
		const transactionItems = serverItems.filter((item: any) => item.type === "transaction");
		const otherServerItems = serverItems.filter((item: any) => item.type !== "transaction");

		// Convert transaction items to TransactionEntryData format
		const transactionEntries: TransactionEntryData[] = transactionItems.map((item: any) => {
			try {
				return {
					id: item.id,
					account_id: item.data?.account_id || item.data?.account,
					amount: item.data?.amount,
					currency: item.data?.currency,
					description: item.data?.description,
					status: item.data?.status,
					transacted_at: item.data?.transacted_at,
					created: item.data?.created,
					timestamp: item.timestamp,
				};
			} catch (error) {
				console.error(`[Timeline] Error mapping transaction item:`, error, item);
				return null;
			}
		}).filter((entry: TransactionEntryData | null): entry is TransactionEntryData => entry !== null);

		const groupedTransactions = groupTransactions(transactionEntries);
		const transactionTimelineItems = groupedTransactions.map((entry: TransactionEntryData | TransactionGroup) => {
			const timestamp = "entries" in entry ? entry.timestamp : entry.timestamp;
			return {
				id: "entries" in entry ? entry.id : entry.id,
				timestamp,
				source: "stripe",
				type: "transaction",
				data: entry,
			};
		});

		return [...otherServerItems, ...transactionTimelineItems, ...chromeHistoryItems, ...braveHistoryItems].sort((a, b) => {
			const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
			const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
			return bTime - aTime;
		});
	}, [items, chromeHistory, braveHistory]);

	// Filter items based on selected sources
	const filteredItems = React.useMemo(() => {
		if (selectedSources.includes("all")) {
			return allItems;
		}
		return allItems.filter((item: any) => {
			const source = item.source as SourceType;
			return selectedSources.includes(source);
		});
	}, [allItems, selectedSources]);

	// Calculate source counts for filter display
	const sourceCounts = React.useMemo(() => {
		const counts: Record<SourceType, number> = {
			all: allItems.length,
			farcaster: allItems.filter((item: any) => item.source === "farcaster").length,
			stripe: allItems.filter((item: any) => item.source === "stripe").length,
			chrome: allItems.filter((item: any) => item.source === "chrome").length,
			brave: allItems.filter((item: any) => item.source === "brave").length,
		};
		return counts;
	}, [allItems]);

	// Set filter component in topbar
	React.useEffect(() => {
		setFilterComponent(
			<SourceFilterDropdown
				selectedSources={selectedSources}
				onSourceChange={setSelectedSources}
				sourceCounts={sourceCounts}
			/>
		);
		return () => setFilterComponent(null);
	}, [selectedSources, sourceCounts, setFilterComponent]);

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
				<div className="max-w-3xl mx-auto py-3 px-3 space-y-6 relative">
					{/* Continuous vertical line spanning entire timeline */}
					{filteredItems.length > 0 && allItems.length > 0 && (
						<div className="absolute left-[calc(0.75rem+9.5px)] top-[calc(0.75rem+0.25rem+9.5px)] bottom-0 w-0.5 bg-gray-300 -z-0" />
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
								<React.Fragment key={dateKey}>
									{dateItems.map((item: any, index: number) => {
										const time = formatTime(item.timestamp);
										const date = formatDate(item.timestamp);
										const showDot = true;
										const isExpanded = expandedItemId === item.id;

										const handleToggleExpand = () => {
											setExpandedItemId(isExpanded ? null : item.id);
										};

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
															onClose={() => setExpandedItemId(null)}
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
															onClose={() => setExpandedItemId(null)}
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
															onClose={() => setExpandedItemId(null)}
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
									{groupedItems.length > 1 && <DateSeparator date={dateStr} />}
								</React.Fragment>
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

import React from "react";
import { trpc } from "@/lib/trpc";
import { TimelineEntry } from "../timeline/TimelineEntry";
import { CastEntry } from "../timeline/CastEntry";
import { BrowserHistoryEntry } from "../timeline/BrowserHistoryEntry";
import { TransactionEntry } from "../timeline/TransactionEntry";
import { DateSeparator } from "../timeline/DateSeparator";
import { groupBrowserHistory } from "../timeline/browserHistoryUtils";
import { groupTransactions, type TransactionEntryData } from "../timeline/transactionUtils";
import { CastExpandedView } from "../timeline/CastExpandedView";
import { BrowserHistoryExpandedView } from "../timeline/BrowserHistoryExpandedView";
import { TransactionExpandedView } from "../timeline/TransactionExpandedView";
import type { FarcasterCastV2 } from "@cortex/api/services/farcaster/types";
import type { BrowserHistoryEntryData, BrowserHistoryGroup } from "../timeline/BrowserHistoryEntry";

function formatTime(timestamp: Date): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(timestamp: Date): string {
	const date = new Date(timestamp);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	if (date.toDateString() === today.toDateString()) {
		return "Today";
	} else if (date.toDateString() === yesterday.toDateString()) {
		return "Yesterday";
	} else {
		return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
	}
}

function groupItemsByDate(items: Array<{ timestamp: Date }>) {
	const grouped = new Map<string, Array<{ timestamp: Date }>>();
	
	for (const item of items) {
		const dateKey = formatDate(item.timestamp);
		if (!grouped.has(dateKey)) {
			grouped.set(dateKey, []);
		}
		grouped.get(dateKey)!.push(item);
	}

	return Array.from(grouped.entries()).sort(
		(a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
	);
}

interface AppTimelineProps {
	appId: string;
	iconUrl?: string;
}

export function AppTimeline({ appId, iconUrl }: AppTimelineProps) {
	const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = (trpc as any).timeline.getTimeline.useInfiniteQuery(
		{ source: appId, limit: 25 },
		{
			getNextPageParam: (lastPage: any) => lastPage?.nextCursor ?? undefined,
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
		}
	);

	// Expose refetch for parent components
	React.useEffect(() => {
		(window as any).refetchStripeTimeline = refetch;
	}, [refetch]);

	const [chromeHistory, setChromeHistory] = React.useState<BrowserHistoryEntryData[]>([]);
	const [braveHistory, setBraveHistory] = React.useState<BrowserHistoryEntryData[]>([]);
	const [expandedItemId, setExpandedItemId] = React.useState<string | null>(null);

	const { data: appsData } = (trpc as any).apps.getAvailableServers.useQuery();
	const chromeIconUrl = appsData?.servers?.find((app: any) => app.id === "chrome")?.iconUrl;
	const chromeConnection = appsData?.servers?.find((app: any) => app.id === "chrome")?.connection;
	const braveIconUrl = appsData?.servers?.find((app: any) => app.id === "brave")?.iconUrl;
	const braveConnection = appsData?.servers?.find((app: any) => app.id === "brave")?.connection;

	const items = React.useMemo(() => {
		if (!data?.pages) return [];
		return data.pages.flatMap((page: any) => page.items || []);
	}, [data]);

	React.useEffect(() => {
		if (chromeConnection?.status === "connected" && appId === "chrome") {
			const localPath = chromeConnection.connectionMetadata?.localPath;
			if (localPath && window.chromeHistory?.readHistory) {
				window.chromeHistory.readHistory(localPath).then(setChromeHistory).catch(console.error);
			}
		}
	}, [chromeConnection, appId]);

	React.useEffect(() => {
		if (braveConnection?.status === "connected" && appId === "brave") {
			const localPath = braveConnection.connectionMetadata?.localPath;
			if (localPath && window.braveHistory?.readHistory) {
				window.braveHistory.readHistory(localPath).then(setBraveHistory).catch(console.error);
			}
		}
	}, [braveConnection, appId]);

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
		const transactionEntries: TransactionEntryData[] = transactionItems
			.filter((item: any) => item && item.data) // Filter out null/undefined items and items without data
			.map((item: any) => {
				try {
					// Validate required fields
					if (typeof item.data?.amount !== "number" || !item.data?.currency) {
						console.warn("[AppTimeline] Invalid transaction item missing required fields:", item);
						return null;
					}

					const timestamp = item.timestamp instanceof Date 
						? item.timestamp 
						: new Date(item.timestamp);

					return {
						id: item.id,
						account_id: item.data?.account_id || item.data?.account || "",
						amount: item.data?.amount,
						currency: item.data?.currency || "usd",
						description: item.data?.description || "",
						status: item.data?.status || "posted",
						transacted_at: item.data?.transacted_at || item.data?.created || Math.floor(timestamp.getTime() / 1000),
						created: item.data?.created || item.data?.transacted_at || Math.floor(timestamp.getTime() / 1000),
						timestamp,
					};
				} catch (error) {
					console.error(`[AppTimeline] Error mapping transaction item:`, error, item);
					return null;
				}
			})
			.filter((entry): entry is TransactionEntryData => entry !== null);

		const groupedTransactions = groupTransactions(transactionEntries);
		const transactionTimelineItems = groupedTransactions
			.filter((entry) => entry !== null && entry !== undefined) // Filter out any null/undefined entries
			.map((entry) => {
			const timestamp = "entries" in entry ? entry.timestamp : entry.timestamp;
			return {
				id: "entries" in entry ? entry.id : entry.id,
				timestamp,
				source: "stripe",
				type: "transaction",
				data: entry,
			};
		});

		const browserHistoryItems = appId === "chrome" ? chromeHistoryItems : appId === "brave" ? braveHistoryItems : [];

		return [...otherServerItems, ...transactionTimelineItems, ...browserHistoryItems].sort((a, b) => {
			const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
			const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
			return bTime - aTime;
		});
	}, [items, chromeHistory, braveHistory, appId]);

	// Set up infinite scroll
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
			<div className="flex-1 flex flex-col items-center justify-center py-12">
				<div className="text-muted-foreground">Loading timeline...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center py-12">
				<div className="text-destructive">Error loading timeline: {error.message}</div>
			</div>
		);
	}

	if (allItems.length === 0) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center py-12">
				<div className="text-center space-y-4 max-w-md">
					<p className="text-muted-foreground text-lg">No timeline items yet</p>
					<p className="text-sm text-muted-foreground">
						{appId === "stripe" 
							? "No transactions found. Go to Settings and click 'Sync Transactions' to fetch your transaction history."
							: "Activity from this app will appear here"
						}
					</p>
					{appId === "stripe" && (
						<p className="text-xs text-muted-foreground mt-2">
							Make sure your Stripe account is connected and has transaction data.
						</p>
					)}
				</div>
			</div>
		);
	}

	const groupedByDate = groupItemsByDate(allItems);
	const appIconUrl = iconUrl;

	return (
		<div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
			<div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
				{groupedByDate.map(([dateLabel, dateItems]) => (
					<div key={dateLabel}>
						<DateSeparator date={dateLabel} />
						<div className="space-y-6 mt-4">
							{dateItems.map((item: any) => {
								const time = formatTime(item.timestamp);
								const isExpanded = expandedItemId === item.id;

								if (item.type === "cast") {
									const cast = item.data as FarcasterCastV2;
									return (
										<TimelineEntry
											key={item.id}
											time={time}
											iconUrl={appIconUrl || item.iconUrl}
											showLine={true}
											isExpanded={isExpanded}
											expandedContent={
												isExpanded ? <CastExpandedView cast={cast} /> : null
											}
										>
											<CastEntry
												cast={cast}
												onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
											/>
										</TimelineEntry>
									);
								}

								if (item.type === "browser-history") {
									const historyData = item.data as BrowserHistoryEntryData | BrowserHistoryGroup;
									return (
										<TimelineEntry
											key={item.id}
											time={time}
											iconUrl={appIconUrl || (item.source === "chrome" ? chromeIconUrl : braveIconUrl)}
											showLine={true}
											isExpanded={isExpanded}
											expandedContent={
												isExpanded ? <BrowserHistoryExpandedView data={historyData} /> : null
											}
										>
											<BrowserHistoryEntry
												data={historyData}
												onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
											/>
										</TimelineEntry>
									);
								}

								if (item.type === "transaction") {
									const transactionData = item.data;
									// Guard against undefined/null transaction data
									if (!transactionData) {
										console.warn("[AppTimeline] Transaction item has no data:", item);
										return null;
									}
									return (
										<TimelineEntry
											key={item.id}
											time={time}
											iconUrl={appIconUrl}
											showLine={true}
											isExpanded={isExpanded}
											expandedContent={
												isExpanded ? <TransactionExpandedView data={transactionData} /> : null
											}
										>
											<TransactionEntry
												entry={transactionData}
												onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
											/>
										</TimelineEntry>
									);
								}

								return null;
							})}
						</div>
					</div>
				))}
				{hasNextPage && (
					<div ref={loadMoreRef} className="flex justify-center py-4">
						{isFetchingNextPage && <div className="text-muted-foreground">Loading more...</div>}
					</div>
				)}
			</div>
		</div>
	);
}


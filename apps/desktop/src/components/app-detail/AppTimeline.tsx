import React from "react";
import { trpc } from "@/lib/trpc";
import { TimelineEntry } from "../timeline/TimelineEntry";
import { CastEntry } from "../timeline/CastEntry";
import { BrowserHistoryEntry } from "../timeline/BrowserHistoryEntry";
import { DateSeparator } from "../timeline/DateSeparator";
import { groupBrowserHistory } from "../timeline/browserHistoryUtils";
import { CastExpandedView } from "../timeline/CastExpandedView";
import { BrowserHistoryExpandedView } from "../timeline/BrowserHistoryExpandedView";
import type { FarcasterCastV2 } from "@cortex/api/services/farcaster/types";
import type { BrowserHistoryEntryData, BrowserHistoryGroup } from "../timeline/BrowserHistoryEntry";
import { formatTime, groupItemsByDate, formatFullDate } from "@/helpers/timeline-formatting";

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


	const [chromeHistory, setChromeHistory] = React.useState<BrowserHistoryEntryData[]>([]);
	const [braveHistory, setBraveHistory] = React.useState<BrowserHistoryEntryData[]>([]);
	const [expandedItemId, setExpandedItemId] = React.useState<string | null>(null);

	const { data: appsData } = (trpc as any).apps.getAvailableServers.useQuery(undefined, {
		staleTime: 5 * 60 * 1000, // 5 minutes - apps list doesn't change frequently
		gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
	});
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

		const browserHistoryItems = appId === "chrome" ? chromeHistoryItems : appId === "brave" ? braveHistoryItems : [];

		return [...serverItems, ...browserHistoryItems].sort((a, b) => {
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
						Activity from this app will appear here
					</p>
				</div>
			</div>
		);
	}

	const groupedByDate = groupItemsByDate(allItems);
	const appIconUrl = iconUrl;

	// Memoize toggle handler factory to prevent creating new functions on every render
	const createToggleHandler = React.useCallback((itemId: string) => {
		return () => {
			setExpandedItemId((currentId) => currentId === itemId ? null : itemId);
		};
	}, []);

	return (
		<div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
			<div className="max-w-2xl mx-auto px-4 py-6 space-y-6 relative">
				{/* Continuous vertical line spanning entire timeline */}
				{allItems.length > 0 && (
					<div className="absolute left-[calc(1rem+9.5px)] top-[calc(1.5rem+0.25rem+9.5px)] bottom-0 w-0.5 bg-gray-300 -z-0" />
				)}
				{groupedByDate.map(([dateKey, dateItems]) => {
					const dateLabel = formatFullDate(new Date(dateKey));
					return (
					<div key={dateKey}>
						<DateSeparator date={dateLabel} />
						<div className="space-y-6 mt-4">
							{dateItems.map((item: any) => {
								const time = formatTime(item.timestamp);
								const isExpanded = expandedItemId === item.id;
								const handleToggleExpand = createToggleHandler(item.id);

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
												onClick={handleToggleExpand}
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
												onClick={handleToggleExpand}
											/>
										</TimelineEntry>
									);
								}

								return null;
							})}
						</div>
					</div>
					);
				})}
				{hasNextPage && (
					<div ref={loadMoreRef} className="flex justify-center py-4">
						{isFetchingNextPage && <div className="text-muted-foreground">Loading more...</div>}
					</div>
				)}
			</div>
		</div>
	);
}


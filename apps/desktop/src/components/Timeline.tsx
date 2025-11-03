import React from "react";
import { TimelineEntry } from "./timeline/TimelineEntry";
import { CastEntry } from "./timeline/CastEntry";
import { BrowserHistoryEntry } from "./timeline/BrowserHistoryEntry";
import { TimelineDemo } from "./timeline/TimelineDemo";
import { DateSeparator } from "./timeline/DateSeparator";
import { groupBrowserHistory } from "./timeline/browserHistoryUtils";
import { trpc } from "@/lib/trpc";
import type { FarcasterCastV2 } from "@cortex/api/services/farcaster/types";
import type { BrowserHistoryEntryData, BrowserHistoryGroup } from "./timeline/BrowserHistoryEntry";
import { useDetailSidebar } from "@/contexts/DetailSidebarContext";

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
		return "";
	}
	if (date.toDateString() === yesterday.toDateString()) {
		return "";
	}
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupItemsByDate(items: Array<{ timestamp: Date }>) {
	const groups: Map<string, typeof items> = new Map();

	for (const item of items) {
		const dateKey = new Date(item.timestamp).toDateString();
		if (!groups.has(dateKey)) {
			groups.set(dateKey, []);
		}
		groups.get(dateKey)!.push(item);
	}

	return Array.from(groups.entries()).sort((a, b) => {
		return new Date(b[0]).getTime() - new Date(a[0]).getTime();
	});
}

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
	const { setSelectedHistoryItem, setHistorySidebarOpen, setSelectedCast, setCastSidebarOpen } = useDetailSidebar();

	const { data: appsData } = (trpc as any).apps.getAvailableServers.useQuery();
	const farcasterIconUrl = appsData?.servers?.find((app: any) => app.id === "farcaster")?.iconUrl;
	const chromeIconUrl = appsData?.servers?.find((app: any) => app.id === "chrome")?.iconUrl;
	const chromeConnection = appsData?.servers?.find((app: any) => app.id === "chrome")?.connection;
	const braveIconUrl = appsData?.servers?.find((app: any) => app.id === "brave")?.iconUrl;
	const braveConnection = appsData?.servers?.find((app: any) => app.id === "brave")?.connection;

	React.useEffect(() => {
		console.log("Apps data loaded:", {
			appsData: !!appsData,
			servers: appsData?.servers?.length,
			chromeApp: appsData?.servers?.find((app: any) => app.id === "chrome"),
			chromeConnection,
			status: chromeConnection?.status,
			localPath: chromeConnection?.connectionMetadata?.localPath,
			hasChromeHistoryContext: !!window.chromeHistory,
			hasReadHistory: typeof window.chromeHistory?.readHistory === "function",
		});
	}, [appsData, chromeConnection]);

	const items = React.useMemo(() => {
		if (!data?.pages) return [];
		return data.pages.flatMap((page: any) => page.items || []);
	}, [data]);

	React.useEffect(() => {
		if (chromeConnection?.status === "connected") {
			const localPath = chromeConnection.connectionMetadata?.localPath;
			if (localPath) {
				if (window.chromeHistory && typeof window.chromeHistory.readHistory === "function") {
					console.log("Reading Chrome history from:", localPath);
					window.chromeHistory
						.readHistory(localPath)
						.then((result: any) => {
							console.log("Chrome history result:", result);
							if (result.success && result.data) {
								console.log(`Loaded ${result.data.length} Chrome history entries`);
								setChromeHistory(result.data);
							} else {
								console.error("Failed to read Chrome history:", result.error);
							}
						})
						.catch((err: any) => {
							console.error("Error reading Chrome history:", err);
						});
				} else {
					console.log("Chrome history context not available yet, polling...");
					let attemptCount = 0;
					const maxAttempts = 30;
					const checkInterval = setInterval(() => {
						attemptCount++;
						if (window.chromeHistory && typeof window.chromeHistory.readHistory === "function") {
							console.log("Chrome history context available, reading history...");
							clearInterval(checkInterval);
							window.chromeHistory
								.readHistory(localPath)
								.then((result: any) => {
									if (result.success && result.data) {
										console.log(`Loaded ${result.data.length} Chrome history entries`);
										setChromeHistory(result.data);
									}
								})
								.catch((err: any) => {
									console.error("Error reading Chrome history:", err);
								});
						} else if (attemptCount >= maxAttempts) {
							console.warn("Chrome history context not available after 30 seconds");
							clearInterval(checkInterval);
						}
					}, 1000);

					return () => clearInterval(checkInterval);
				}
			} else {
				console.warn("Chrome connection missing localPath");
			}
		}
	}, [chromeConnection]);

	React.useEffect(() => {
		if (braveConnection?.status === "connected") {
			const localPath = braveConnection.connectionMetadata?.localPath;
			if (localPath) {
				if (window.braveHistory && typeof window.braveHistory.readHistory === "function") {
					console.log("Reading Brave history from:", localPath);
					window.braveHistory
						.readHistory(localPath)
						.then((result: any) => {
							console.log("Brave history result:", result);
							if (result.success && result.data) {
								console.log(`Loaded ${result.data.length} Brave history entries`);
								setBraveHistory(result.data);
							} else {
								console.error("Failed to read Brave history:", result.error);
							}
						})
						.catch((err: any) => {
							console.error("Error reading Brave history:", err);
						});
				} else {
					console.log("Brave history context not available yet, polling...");
					let attemptCount = 0;
					const maxAttempts = 30;
					const checkInterval = setInterval(() => {
						attemptCount++;
						if (window.braveHistory && typeof window.braveHistory.readHistory === "function") {
							console.log("Brave history context available, reading history...");
							clearInterval(checkInterval);
							window.braveHistory
								.readHistory(localPath)
								.then((result: any) => {
									if (result.success && result.data) {
										console.log(`Loaded ${result.data.length} Brave history entries`);
										setBraveHistory(result.data);
									}
								})
								.catch((err: any) => {
									console.error("Error reading Brave history:", err);
								});
						} else if (attemptCount >= maxAttempts) {
							console.warn("Brave history context not available after 30 seconds");
							clearInterval(checkInterval);
						}
					}, 1000);

					return () => clearInterval(checkInterval);
				}
			} else {
				console.warn("Brave connection missing localPath");
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

		return [...serverItems, ...chromeHistoryItems, ...braveHistoryItems].sort((a, b) => {
			const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
			const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
			return bTime - aTime;
		});
	}, [items, chromeHistory, braveHistory]);

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

	const groupedItems = groupItemsByDate(allItems);

	return (
		<div className="flex-1 flex flex-col">
			<div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
				<div className="max-w-3xl mx-auto py-3 px-3 space-y-6">
					{allItems.length === 0 ? (
						<TimelineDemo />
					) : (
						groupedItems.map(([dateKey, dateItems]) => {
							const dateStr = new Date(dateKey).toLocaleDateString("en-US", {
								weekday: "long",
								year: "numeric",
								month: "long",
								day: "numeric",
							});
							return (
								<React.Fragment key={dateKey}>
									{dateItems.map((item: any) => {
										const time = formatTime(item.timestamp);
										const date = formatDate(item.timestamp);
										const showDot = true;

										if (item.type === "cast") {
											return (
												<TimelineEntry key={item.id} time={time} date={date} showDot iconUrl={farcasterIconUrl}>
													<div
														onClick={() => {
															setSelectedCast(item.data as FarcasterCastV2);
															setCastSidebarOpen(true);
														}}
														className="cursor-pointer"
													>
														<CastEntry cast={item.data as FarcasterCastV2} />
													</div>
												</TimelineEntry>
											);
										}

										if (item.type === "browser-history") {
											const iconUrl = item.source === "brave" ? braveIconUrl : chromeIconUrl;
											return (
												<TimelineEntry
													key={item.id}
													time={time}
													date={date}
													showDot
													iconUrl={iconUrl}
												>
													<BrowserHistoryEntry
														entry={item.data}
														onClick={() => {
															setSelectedHistoryItem(item.data);
															setHistorySidebarOpen(true);
														}}
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

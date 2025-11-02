import React from "react";
import { TimelineEntry } from "./timeline/TimelineEntry";
import { CastEntry } from "./timeline/CastEntry";
import { TimelineDemo } from "./timeline/TimelineDemo";
import { DateSeparator } from "./timeline/DateSeparator";
import { trpc } from "@/lib/trpc";
import type { FarcasterCastV2 } from "@cortex/api/services/farcaster/types";

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
		}
	);

	// Fetch Farcaster app icon URL
	const { data: appsData } = (trpc as any).apps.getAvailableServers.useQuery();
	const farcasterIconUrl = appsData?.servers?.find((app: any) => app.id === "farcaster")?.iconUrl;

	// Flatten all pages into a single items array
	const items = React.useMemo(() => {
		if (!data?.pages) return [];
		return data.pages.flatMap((page: any) => page.items || []);
	}, [data]);

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
				<div className="flex-1 overflow-y-auto">
					<div className="max-w-3xl mx-auto py-3 px-3 space-y-6">
						<div className="text-sm text-destructive">Error loading timeline: {error.message}</div>
					</div>
				</div>
			</div>
		);
	}

	const groupedItems = groupItemsByDate(items);

	return (
		<div className="flex-1 flex flex-col">
			{/* <div className="flex items-center justify-center bg-background/95 backdrop-blur-sm py-1 sticky top-0 z-30">
				<div className="max-w-3xl mx-auto w-full flex items-center justify-center px-6">
					<div className="flex items-center gap-3">
						<span className="text-sm font-medium text-foreground">
							{new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}
						</span>
						<div className="px-3 py-1 bg-muted rounded-md text-sm font-medium">{items.length}</div>
					</div>
				</div>
			</div> */}
			<div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
				<div className="max-w-3xl mx-auto py-3 px-3 space-y-6">
					{items.length === 0 ? (
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
													<CastEntry cast={item.data as FarcasterCastV2} />
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

import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { Item } from "@backpack/sdk";
import { backpack } from "@/lib/backpack-client";
import { useFilters } from "@/contexts/FilterContext";
import { useDetailSidebar } from "@/contexts/DetailSidebarContext";
import { SourceFilter } from "@/components/filters/SourceFilter";
import { DateSeparator } from "./DateSeparator";
import { TimelineEntry } from "./entries";
import { formatDateKey } from "./format";

interface DayGroup {
	dateKey: string;
	items: Item[];
}

function groupByDay(items: Item[]): DayGroup[] {
	const groups: DayGroup[] = [];
	let current: DayGroup | null = null;
	for (const item of items) {
		const key = formatDateKey(item.timestamp);
		if (!current || current.dateKey !== key) {
			current = { dateKey: key, items: [] };
			groups.push(current);
		}
		current.items.push(item);
	}
	return groups;
}


export function TimelineView() {
	const { source } = useFilters();
	const { show } = useDetailSidebar();

	const status = useQuery({
		queryKey: ["status"],
		queryFn: () => backpack.status(),
	});

	const timeline = useInfiniteQuery({
		queryKey: ["timeline", source],
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam }) =>
			backpack.timeline({
				limit: 50,
				source: source === "all" ? undefined : source,
				cursor: pageParam,
			}),
		getNextPageParam: (last) => last.nextCursor ?? undefined,
	});

	const allItems = useMemo(
		() => timeline.data?.pages.flatMap((p) => p.items) ?? [],
		[timeline.data],
	);
	const groups = useMemo(() => groupByDay(allItems), [allItems]);

	const sourceOptions = useMemo(() => {
		const byName = new Map<string, number>();
		for (const row of status.data?.items ?? []) {
			byName.set(row.source, (byName.get(row.source) ?? 0) + row.count);
		}
		return Array.from(byName, ([value, count]) => ({
			value,
			label: value,
			count,
		}));
	}, [status.data]);

	const { hasNextPage, isFetchingNextPage, fetchNextPage } = timeline;
	const sentinelRef = useCallback(
		(node: HTMLDivElement | null) => {
			if (!node || !hasNextPage || isFetchingNextPage) return;
			const observer = new IntersectionObserver(
				(entries) => {
					if (entries[0]?.isIntersecting) fetchNextPage();
				},
				{ rootMargin: "200px" },
			);
			observer.observe(node);
			return () => observer.disconnect();
		},
		[hasNextPage, isFetchingNextPage, fetchNextPage],
	);

	return (
		<div className="flex h-full flex-col">
			<header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-3 bg-background/80 px-8 shadow-[0_1px_0_0_hsl(var(--border)/0.45)] backdrop-blur-2xl">
				<h1 className="text-[15px] font-semibold tracking-[-0.02em]">Timeline</h1>
				<SourceFilter options={sourceOptions} />
			</header>
			<div className="flex-1 overflow-y-auto px-8 py-5">
				{timeline.isLoading && (
					<p className="text-sm text-muted-foreground">Loading…</p>
				)}
				{timeline.error && (
					<p className="text-sm text-destructive">
						{(timeline.error as Error).message}
					</p>
				)}
				{!timeline.isLoading && allItems.length === 0 && (
					<p className="text-sm text-muted-foreground">
						No items yet. Connect a source to get started.
					</p>
				)}
				<div className="flex flex-col gap-6">
					{groups.map((group) => (
						<section key={group.dateKey} className="flex flex-col gap-2">
							<DateSeparator dateKey={group.dateKey} />
							<ul className="flex flex-col gap-1">
								{group.items.map((item) => (
									<li key={item.id}>
										<TimelineEntry item={item} onClick={() => show(item)} />
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
				<div ref={sentinelRef} className="h-8" />
				{timeline.isFetchingNextPage && (
					<p className="py-2 text-center text-xs text-muted-foreground">
						Loading more…
					</p>
				)}
			</div>
		</div>
	);
}

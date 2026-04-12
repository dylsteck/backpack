import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import type { SearchResultItem } from "@backpack/sdk";
import { backpack } from "@/lib/backpack-client";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardTitle,
} from "@/components/ui/card";
import { useDetailSidebar } from "@/contexts/DetailSidebarContext";

interface ResultGroup {
	source: string;
	results: SearchResultItem[];
}

function groupBySource(results: SearchResultItem[]): ResultGroup[] {
	const map = new Map<string, SearchResultItem[]>();
	for (const result of results) {
		const existing = map.get(result.source);
		if (existing) {
			existing.push(result);
		} else {
			map.set(result.source, [result]);
		}
	}
	return Array.from(map, ([source, results]) => ({ source, results }));
}

export function SearchView() {
	const [query, setQuery] = useState("");
	const { show } = useDetailSidebar();

	const trimmed = query.trim();
	const enabled = trimmed.length > 2;

	const { data, isFetching } = useQuery({
		queryKey: ["search", trimmed],
		queryFn: () => backpack.search(trimmed, { limit: 50 }),
		enabled,
		refetchOnMount: false,
	});

	const groups = useMemo<ResultGroup[]>(
		() => (data ? groupBySource(data.results) : []),
		[data],
	);

	const handleOpen = async (result: SearchResultItem): Promise<void> => {
		try {
			const item = await backpack.get(result.id);
			if (item) show(item);
		} catch (err) {
			console.error("Failed to load item", err);
		}
	};

	return (
		<div className="flex h-full flex-col">
			<header className="sticky top-0 z-20 flex h-10 items-center gap-3 bg-background/80 px-8 shadow-[0_1px_0_0_hsl(var(--border)/0.45)] backdrop-blur-2xl">
				<SearchIcon className="h-4 w-4 text-muted-foreground" />
				<Input
					autoFocus
					placeholder="Search everything…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="h-8 border-none bg-transparent text-[13px] shadow-none focus-visible:ring-0"
				/>
			</header>
			<div className="flex-1 overflow-y-auto p-8">
				{!enabled && (
					<p className="text-sm text-muted-foreground">
						Type at least 3 characters to search.
					</p>
				)}
				{enabled && isFetching && !data && (
					<p className="text-sm text-muted-foreground">Searching…</p>
				)}
				{enabled && data && data.results.length === 0 && (
					<p className="text-sm text-muted-foreground">
						No results for “{trimmed}”.
					</p>
				)}
				<div className="flex flex-col gap-6">
					{groups.map((group) => (
						<section key={group.source} className="flex flex-col gap-2">
							<h2 className="text-[11px] font-medium text-muted-foreground/60">
								{group.source}
							</h2>
							<ul className="flex flex-col gap-2">
								{group.results.map((result) => (
									<li key={result.id}>
										<button
											type="button"
											onClick={() => {
												void handleOpen(result);
											}}
											className="block w-full text-left"
										>
											<Card className="transition-all duration-200 hover:shadow-sm">
												<CardContent className="p-5">
													<CardTitle>{result.title ?? result.type}</CardTitle>
													{result.snippet && (
														<CardDescription className="mt-1 line-clamp-2">
															{result.snippet}
														</CardDescription>
													)}
													<p className="mt-2 text-xs text-muted-foreground">
														{result.type} · score{" "}
														{result.score.toFixed(2)}
													</p>
												</CardContent>
											</Card>
										</button>
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
			</div>
		</div>
	);
}

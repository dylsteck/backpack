import React from "react";

export interface BrowserHistoryEntryData {
	url: string;
	title: string;
	timestamp: string;
	visitCount: number;
	lastVisitTime: number;
}

export interface BrowserHistoryGroup {
	id: string;
	entries: BrowserHistoryEntryData[];
	timestamp: Date;
}

export function BrowserHistoryEntry({
	entry,
	onClick,
}: {
	entry: BrowserHistoryEntryData | BrowserHistoryGroup;
	onClick?: () => void;
}) {
	if ("entries" in entry) {
		const group = entry as BrowserHistoryGroup;
		return (
			<div
				onClick={onClick}
				className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-colors space-y-2"
			>
				<div className="flex items-center gap-2">
					<div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center">
						<span className="text-xs font-medium text-blue-600 dark:text-blue-400">
							{group.entries.length}
						</span>
					</div>
					<div className="flex-1 min-w-0">
						<div className="text-sm font-medium">
							{group.entries.length} pages visited
						</div>
						<div className="text-xs text-muted-foreground truncate">
							{group.entries[0]?.title || group.entries[0]?.url}
						</div>
					</div>
				</div>
				{group.entries.length > 1 && (
					<div className="flex flex-wrap gap-1 mt-2">
						{group.entries.slice(0, 3).map((e, idx) => (
							<div
								key={idx}
								className="text-xs px-2 py-1 bg-muted rounded truncate max-w-[200px]"
								title={e.title || e.url}
							>
								{e.title || new URL(e.url).hostname}
							</div>
						))}
						{group.entries.length > 3 && (
							<div className="text-xs px-2 py-1 bg-muted rounded">
								+{group.entries.length - 3} more
							</div>
						)}
					</div>
				)}
			</div>
		);
	}

	const singleEntry = entry as BrowserHistoryEntryData;
	const domain = React.useMemo(() => {
		try {
			return new URL(singleEntry.url).hostname;
		} catch {
			return singleEntry.url;
		}
	}, [singleEntry.url]);

	return (
		<div
			onClick={onClick}
			className="cursor-pointer hover:bg-muted/50 rounded-lg p-3 transition-colors"
		>
			<div className="flex items-start gap-3">
				<div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
					<span className="text-xs">🌐</span>
				</div>
				<div className="flex-1 min-w-0">
					<div className="text-sm font-medium line-clamp-2">
						{singleEntry.title || singleEntry.url}
					</div>
					<div className="text-xs text-muted-foreground truncate mt-1">
						{domain}
					</div>
					{singleEntry.visitCount > 1 && (
						<div className="text-xs text-muted-foreground mt-1">
							Visited {singleEntry.visitCount} times
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

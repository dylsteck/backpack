import React from "react";
import type { BrowserHistoryEntryData, BrowserHistoryGroup } from "./BrowserHistoryEntry";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BrowserHistoryExpandedView({
	entry,
	onClose,
}: {
	entry: BrowserHistoryEntryData | BrowserHistoryGroup;
	onClose: () => void;
}) {
	if ("entries" in entry) {
		const group = entry as BrowserHistoryGroup;
		return (
			<div className="mt-3 pt-3 border-t border-border/50 space-y-3">
				<div className="flex items-center justify-between">
					<div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
						{group.entries.length} pages visited
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-6 w-6 rounded-full"
					>
						<X className="h-3 w-3" />
					</Button>
				</div>
				
				<div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-hide">
					{group.entries.map((e, idx) => {
						const domain = React.useMemo(() => {
							try {
								return new URL(e.url).hostname;
							} catch {
								return e.url;
							}
						}, [e.url]);

						return (
							<div key={idx} className="space-y-1">
								<a
									href={e.url}
									target="_blank"
									rel="noopener noreferrer"
									className="text-xs font-medium hover:underline line-clamp-1 text-blue-600 dark:text-blue-400"
								>
									{e.title || e.url}
								</a>
								<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
									<span className="truncate max-w-[150px]">{domain}</span>
									<span>•</span>
									<span>{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
									{e.visitCount > 1 && (
										<>
											<span>•</span>
											<span>{e.visitCount} visits</span>
										</>
									)}
								</div>
								{idx < group.entries.length - 1 && <Separator className="opacity-50" />}
							</div>
						);
					})}
				</div>
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
		<div className="mt-3 pt-3 border-t border-border/50 space-y-3">
			<div className="flex items-center justify-between">
				<div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
					Visit Details
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="h-6 w-6 rounded-full"
				>
					<X className="h-3 w-3" />
				</Button>
			</div>
			
			<div className="space-y-2">
				<div>
					<div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">URL</div>
					<a
						href={singleEntry.url}
						target="_blank"
						rel="noopener noreferrer"
						className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all leading-relaxed line-clamp-2"
					>
						{singleEntry.url}
					</a>
				</div>
				
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
					<div className="flex items-center gap-1">
						<span className="font-medium">Domain:</span>
						<span>{domain}</span>
					</div>
					<span>•</span>
					<div className="flex items-center gap-1">
						<span className="font-medium">Visits:</span>
						<span>{singleEntry.visitCount}</span>
					</div>
					<span>•</span>
					<div className="flex items-center gap-1">
						<span className="font-medium">Time:</span>
						<span>{new Date(singleEntry.timestamp).toLocaleString()}</span>
					</div>
				</div>
			</div>
		</div>
	);
}


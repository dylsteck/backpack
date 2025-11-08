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
					<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
						{group.entries.length} pages visited
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-6 w-6 -mr-2"
					>
						<X className="h-3 w-3" />
					</Button>
				</div>
				
				<div className="space-y-3 max-h-64 overflow-y-auto pr-2">
					{group.entries.map((e, idx) => {
						const domain = React.useMemo(() => {
							try {
								return new URL(e.url).hostname;
							} catch {
								return e.url;
							}
						}, [e.url]);

						return (
							<div key={idx} className="space-y-1.5">
								<a
									href={e.url}
									target="_blank"
									rel="noopener noreferrer"
									className="text-sm font-medium hover:underline line-clamp-2 text-blue-600 dark:text-blue-400"
								>
									{e.title || e.url}
								</a>
								<div className="text-xs text-muted-foreground truncate">
									{domain}
								</div>
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<span>{new Date(e.timestamp).toLocaleTimeString()}</span>
									{e.visitCount > 1 && (
										<>
											<span>•</span>
											<span>Visited {e.visitCount} times</span>
										</>
									)}
								</div>
								{idx < group.entries.length - 1 && <Separator className="mt-2" />}
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
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="h-6 w-6 -ml-2"
				>
					<X className="h-3 w-3" />
				</Button>
			</div>
			
			<div className="space-y-2.5">
				<div>
					<div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">URL</div>
					<a
						href={singleEntry.url}
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all leading-relaxed"
					>
						{singleEntry.url}
					</a>
				</div>
				
				<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<span>Domain: {domain}</span>
					<span>•</span>
					<span>Visited {singleEntry.visitCount} {singleEntry.visitCount === 1 ? "time" : "times"}</span>
					<span>•</span>
					<span>{new Date(singleEntry.timestamp).toLocaleString()}</span>
				</div>
			</div>
		</div>
	);
}


import React from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { BrowserHistoryEntryData, BrowserHistoryGroup } from "./BrowserHistoryEntry";

export function BrowserHistoryDetailSidebar({
	open,
	onOpenChange,
	data,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	data: BrowserHistoryEntryData | BrowserHistoryGroup | null;
}) {
	if (!data) return null;

	if ("entries" in data) {
		const group = data as BrowserHistoryGroup;
	return (
		<Sidebar
			side="right"
			variant="sidebar"
			collapsible="offcanvas"
			className="z-50"
		>
				<SidebarHeader className="p-4 border-b">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-lg font-semibold">Browser History Session</h2>
							<p className="text-sm text-muted-foreground">
								{group.entries.length} pages visited around{" "}
								{new Date(group.timestamp).toLocaleString()}
							</p>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => onOpenChange(false)}
							className="h-8 w-8"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</SidebarHeader>
				<SidebarContent className="p-4 overflow-y-auto">
					<div className="space-y-4">
						{group.entries.map((entry, idx) => (
							<div key={idx} className="space-y-2">
								<div className="flex items-start justify-between gap-2">
									<div className="flex-1 min-w-0">
										<a
											href={entry.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-sm font-medium hover:underline line-clamp-2"
										>
											{entry.title || entry.url}
										</a>
										<div className="text-xs text-muted-foreground mt-1 truncate">
											{entry.url}
										</div>
									</div>
								</div>
								<div className="flex items-center gap-4 text-xs text-muted-foreground">
									<span>
										{new Date(entry.timestamp).toLocaleTimeString()}
									</span>
									{entry.visitCount > 1 && (
										<span>Visited {entry.visitCount} times</span>
									)}
								</div>
								{idx < group.entries.length - 1 && <Separator />}
							</div>
						))}
					</div>
				</SidebarContent>
			</Sidebar>
		);
	}

	const entry = data as BrowserHistoryEntryData;
	const domain = React.useMemo(() => {
		try {
			return new URL(entry.url).hostname;
		} catch {
			return entry.url;
		}
	}, [entry.url]);

	return (
		<Sidebar
			side="right"
			variant="sidebar"
			collapsible="offcanvas"
			className="z-50"
		>
			<SidebarHeader className="p-4 border-b">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold">Browser History</h2>
						<p className="text-sm text-muted-foreground">
							Visited on {new Date(entry.timestamp).toLocaleString()}
						</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => onOpenChange(false)}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</SidebarHeader>
			<SidebarContent className="p-4 overflow-y-auto">
				<div className="space-y-4">
					<div className="space-y-2">
						<div className="text-sm font-medium">Title</div>
						<div className="text-sm text-muted-foreground">
							{entry.title || "No title"}
						</div>
					</div>
					<Separator />
					<div className="space-y-2">
						<div className="text-sm font-medium">URL</div>
						<a
							href={entry.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
						>
							{entry.url}
						</a>
					</div>
					<Separator />
					<div className="space-y-2">
						<div className="text-sm font-medium">Domain</div>
						<div className="text-sm text-muted-foreground">{domain}</div>
					</div>
					<Separator />
					<div className="space-y-2">
						<div className="text-sm font-medium">Visit Count</div>
						<div className="text-sm text-muted-foreground">
							{entry.visitCount} {entry.visitCount === 1 ? "time" : "times"}
						</div>
					</div>
					<Separator />
					<div className="space-y-2">
						<div className="text-sm font-medium">Timestamp</div>
						<div className="text-sm text-muted-foreground">
							{new Date(entry.timestamp).toLocaleString()}
						</div>
					</div>
				</div>
			</SidebarContent>
		</Sidebar>
	);
}

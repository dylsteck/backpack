import { Link } from "@tanstack/react-router";
import { ArrowLeft, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FlyHistoryTabId } from "./fly-history-types";

const NAVY = "bg-[#162b45] text-white hover:bg-[#1e3a5a] dark:bg-[#3d5a80] dark:hover:bg-[#4a6a94]";

type Props = {
	tab: FlyHistoryTabId;
	onTabChange: (t: FlyHistoryTabId) => void;
	filter: string;
	onFilterChange: (v: string) => void;
	deletePending: boolean;
	onDeleteAll: () => void;
};

const TABS: { id: FlyHistoryTabId; label: string }[] = [
	{ id: "visited", label: "Visited" },
	{ id: "analytics", label: "Analytics" },
];

export function FlyHistoryChrome({
	tab,
	onTabChange,
	filter,
	onFilterChange,
	deletePending,
	onDeleteAll,
}: Props) {
	return (
		<div className="shrink-0 bg-background">
			<header className="flex h-11 items-center gap-2 border-b border-border/80 px-3 md:px-8">
				<SidebarTrigger className="no-drag size-7 shrink-0 [&_svg]:size-3.5" />
				<Link
					to="/fly/browser"
					className="no-drag flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
					title="Back to browser"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
				</Link>
				<div className="flex-1" />
				<Button
					type="button"
					size="sm"
					className={cn("no-drag h-8 rounded-md px-4 text-[13px] font-medium shadow-none", NAVY)}
					disabled={deletePending}
					onClick={onDeleteAll}
				>
					Delete history
				</Button>
			</header>

			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-3 py-0 md:px-8">
				<nav className="flex min-w-0 flex-1 gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					{TABS.map(({ id, label }) => {
						const active = tab === id;
						return (
							<button
								key={id}
								type="button"
								onClick={() => onTabChange(id)}
								className={cn(
									"no-drag flex shrink-0 items-center gap-1.5 border-b-2 border-transparent py-3 text-[13px] transition-colors",
									active
										? "border-[#162b45] font-semibold text-foreground dark:border-[#6b8caf]"
										: "font-normal text-muted-foreground hover:text-foreground",
								)}
							>
								{label}
							</button>
						);
					})}
				</nav>
			</div>

			<div className="border-b border-border/60 px-3 py-3 md:px-8">
				<div className="relative max-w-xl">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
					<input
						type="search"
						value={filter}
						onChange={(e) => onFilterChange(e.target.value)}
						placeholder="Search history…"
						className="h-9 w-full rounded-md border border-border/70 bg-background py-2 pl-9 pr-3 font-mono text-[13px] text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:border-[#162b45]/50 focus-visible:ring-2 focus-visible:ring-[#162b45]/20 dark:focus-visible:border-[#6b8caf]/50 dark:focus-visible:ring-[#6b8caf]/20"
					/>
				</div>
			</div>
		</div>
	);
}

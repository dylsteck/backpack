import { Link } from "@tanstack/react-router";
import { Plus, X, LayoutGrid, History } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { FlyTabFavicon } from "./FlyTabFavicon";
import type { FlyBrowserTab, FlyViewMode } from "./fly-browser-types";

const tabTriggerClass = cn(
	"group relative flex h-7 max-w-[13rem] min-w-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-2.5 py-0 text-[11px] font-normal leading-tight shadow-none ring-0 ring-offset-0 transition-colors focus-visible:ring-2 data-[state=active]:border-border/60 data-[state=active]:bg-card data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:border-border/40 data-[state=inactive]:hover:bg-background/70 data-[state=inactive]:hover:text-foreground",
);

type Props = {
	viewMode: FlyViewMode;
	tabs: FlyBrowserTab[];
	activeTabId: string;
	tabFavicons: Record<string, string>;
	onActiveTabChange: (id: string) => void;
	onCloseTab: (id: string) => void;
	onToggleOverview: () => void;
	onAddTab: () => void;
};

export function FlyBrowserToolbar({
	viewMode,
	tabs,
	activeTabId,
	tabFavicons,
	onActiveTabChange,
	onCloseTab,
	onToggleOverview,
	onAddTab,
}: Props) {
	return (
		<div className="flex h-10 w-full min-w-0 shrink-0 items-center gap-1 border-b px-1.5 md:gap-1.5 md:px-2">
			<SidebarTrigger className="no-drag size-7 shrink-0 [&_svg]:size-3.5" />
			{viewMode === "browser" ? (
				<Tabs
					value={activeTabId}
					onValueChange={onActiveTabChange}
					className="flex min-h-0 min-w-0 flex-1"
				>
					<TabsList className="h-8 min-h-0 min-w-0 flex flex-1 justify-start gap-1 overflow-x-auto rounded-none border-0 bg-transparent p-0 shadow-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						{tabs.map((tab) => (
							<TabsTrigger key={tab.id} value={tab.id} className={tabTriggerClass}>
								<FlyTabFavicon
									key={`${tab.id}-${tab.url}-${tabFavicons[tab.id] ?? ""}`}
									pageUrl={tab.url}
									preferredSrc={tabFavicons[tab.id]}
									className="h-3.5 w-3.5"
								/>
								<span className="min-w-0 flex-1 truncate text-left">{tab.title}</span>
								<button
									type="button"
									className="no-drag ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 group-data-[state=active]:opacity-100"
									onPointerDown={(e) => e.stopPropagation()}
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										onCloseTab(tab.id);
									}}
								>
									<X className="h-2.5 w-2.5" />
								</button>
							</TabsTrigger>
						))}
					</TabsList>
					{tabs.map((tab) => (
						<TabsContent key={tab.id} value={tab.id} className="hidden">
							<span className="sr-only">{tab.title}</span>
						</TabsContent>
					))}
				</Tabs>
			) : (
				<div className="flex min-w-0 flex-1 items-center px-1 text-xs font-medium text-muted-foreground">
					Overview · {tabs.length} {tabs.length === 1 ? "tab" : "tabs"}
				</div>
			)}
			<Link
				to="/fly/history"
				className="no-drag flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
				title="History"
			>
				<History className="h-3.5 w-3.5" />
			</Link>
			<button
				type="button"
				onClick={onToggleOverview}
				className={cn(
					"no-drag flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
					viewMode === "grid" && "bg-accent text-accent-foreground",
				)}
				title={viewMode === "grid" ? "Back to browser" : "Tab overview"}
			>
				<LayoutGrid className="h-3.5 w-3.5" />
			</button>
			<button
				type="button"
				onClick={onAddTab}
				className="no-drag flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				title="New tab"
			>
				<Plus className="h-3.5 w-3.5" />
			</button>
			<div
				className="min-h-7 min-w-[2.5rem] flex-1 self-stretch pl-4 drag md:pl-6"
				aria-hidden
			/>
		</div>
	);
}

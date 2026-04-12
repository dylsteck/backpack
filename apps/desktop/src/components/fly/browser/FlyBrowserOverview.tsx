import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlyTabFavicon } from "./FlyTabFavicon";
import type { FlyBrowserTab } from "./fly-browser-types";

type Props = {
	tabs: FlyBrowserTab[];
	activeTabId: string;
	thumbnails: Record<string, string>;
	tabFavicons: Record<string, string>;
	onSelectTab: (id: string) => void;
	onCloseTab: (id: string) => void;
	onAddTab: () => void;
};

export function FlyBrowserOverview({
	tabs,
	activeTabId,
	thumbnails,
	tabFavicons,
	onSelectTab,
	onCloseTab,
	onAddTab,
}: Props) {
	return (
		<div className="absolute inset-0 z-10 overflow-auto bg-background/95 p-8 backdrop-blur-[2px] [animation:fade-in_0.18s_ease-out]">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => onSelectTab(tab.id)}
						className={cn(
							"group relative flex flex-col overflow-hidden rounded-2xl bg-card text-left shadow-sm transition-all duration-200 ease-out hover:shadow-md hover:ring-2 hover:ring-primary/40",
							tab.id === activeTabId && "ring-2 ring-primary",
						)}
					>
						<div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
							{thumbnails[tab.id] ? (
								<img
									src={thumbnails[tab.id]}
									alt={tab.title}
									className="h-full w-full object-cover object-top"
								/>
							) : (
								<div className="flex h-full items-center justify-center">
									<FlyTabFavicon
										key={`${tab.id}-${tab.url}-${tabFavicons[tab.id] ?? ""}`}
										pageUrl={tab.url}
										preferredSrc={tabFavicons[tab.id]}
										className="h-8 w-8 opacity-40"
									/>
								</div>
							)}
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onCloseTab(tab.id);
								}}
								className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
							>
								<X className="h-3 w-3" />
							</button>
						</div>
						<div className="flex items-center gap-2 px-3 py-2 shadow-[inset_0_1px_0_0_hsl(var(--border)/0.5)]">
							<FlyTabFavicon
								key={`${tab.id}-${tab.url}-${tabFavicons[tab.id] ?? ""}`}
								pageUrl={tab.url}
								preferredSrc={tabFavicons[tab.id]}
								className="h-3 w-3"
							/>
							<span className="truncate text-xs font-medium">{tab.title}</span>
						</div>
					</button>
				))}

				<button
					type="button"
					onClick={onAddTab}
					className={cn(
						"flex flex-col overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/20",
						"text-muted-foreground/40 shadow-sm transition-colors hover:border-primary/50 hover:text-primary/60",
					)}
				>
					<div className="relative flex aspect-[16/10] w-full items-center justify-center bg-muted/20">
						<Plus className="h-8 w-8" />
					</div>
					<div className="flex items-center gap-2 px-3 py-2 shadow-[inset_0_1px_0_0_hsl(var(--border)/0.5)]">
						<Plus className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
						<span className="truncate text-xs font-medium">New tab</span>
					</div>
				</button>
			</div>
		</div>
	);
}

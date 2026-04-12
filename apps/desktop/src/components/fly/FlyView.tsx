import { useState, useCallback, useRef } from "react";
import { Plus, X, ArrowLeft, ArrowRight, RotateCcw, Globe, LayoutGrid } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface Tab {
	id: string;
	url: string;
	title: string;
}

let nextId = 1;
function makeTab(url = "about:blank", title = "New Tab"): Tab {
	return { id: String(nextId++), url, title };
}

const STARTER_TABS: Tab[] = [
	makeTab("https://google.com", "Google"),
	makeTab("https://github.com", "GitHub"),
	makeTab("https://news.ycombinator.com", "Hacker News"),
];

type ViewMode = "browser" | "grid";

/** Hostname-only fallback via Google's favicon CDN (no path/query from the page). */
function googleHostedFaviconUrl(pageUrl: string): string | null {
	try {
		const { protocol, hostname } = new URL(pageUrl);
		if ((protocol !== "http:" && protocol !== "https:") || !hostname) return null;
		return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostname)}`;
	} catch {
		return null;
	}
}

/** Only allow http(s) absolute URLs from the webview (no javascript:, data:, etc.). */
function firstSafeHttpFavicon(urls: string[]): string | null {
	for (const raw of urls) {
		try {
			const u = new URL(raw);
			if ((u.protocol === "https:" || u.protocol === "http:") && u.hostname) return u.href;
		} catch {
			continue;
		}
	}
	return null;
}

function TabFavicon({
	pageUrl,
	preferredSrc,
	className,
}: {
	pageUrl: string;
	preferredSrc: string | undefined;
	className: string;
}) {
	const hosted = googleHostedFaviconUrl(pageUrl);
	const candidates = [...new Set([preferredSrc, hosted].filter(Boolean))] as string[];
	const [failIndex, setFailIndex] = useState(0);

	if (failIndex >= candidates.length) {
		return <Globe className={cn(className, "shrink-0 text-muted-foreground")} />;
	}

	return (
		<img
			src={candidates[failIndex]}
			alt=""
			referrerPolicy="no-referrer"
			className={cn(className, "shrink-0 rounded-sm object-contain")}
			onError={() => setFailIndex((i) => i + 1)}
		/>
	);
}

export function FlyView() {
	const [tabs, setTabs] = useState<Tab[]>(STARTER_TABS);
	const [activeTabId, setActiveTabId] = useState(STARTER_TABS[0].id);
	const [viewMode, setViewMode] = useState<ViewMode>("browser");
	const [urlInput, setUrlInput] = useState("");
	const [urlFocused, setUrlFocused] = useState(false);
	const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
	const [tabFavicons, setTabFavicons] = useState<Record<string, string>>({});
	const webviewRefs = useRef<Map<string, WebviewHTMLElement>>(new Map());

	const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

	const captureTab = useCallback(async (id: string, wv: WebviewHTMLElement) => {
		try {
			const image = await wv.capturePage();
			const dataUrl = image.toDataURL();
			if (dataUrl && dataUrl.length > 100) {
				setThumbnails((prev) => ({ ...prev, [id]: dataUrl }));
			}
		} catch {}
	}, []);

	const captureAll = useCallback(async () => {
		const entries = Array.from(webviewRefs.current.entries());
		await Promise.allSettled(entries.map(([id, wv]) => captureTab(id, wv)));
	}, [captureTab]);

	const syncTitle = useCallback((id: string, wv: WebviewHTMLElement) => {
		const title = wv.getTitle?.();
		if (title) {
			setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
		}
	}, []);

	const addTab = useCallback(() => {
		const tab = makeTab();
		setTabs((prev) => [...prev, tab]);
		setActiveTabId(tab.id);
		setViewMode("browser");
	}, []);

	const closeTab = useCallback(
		(id: string) => {
			setTabs((prev) => {
				const next = prev.filter((t) => t.id !== id);
				if (next.length === 0) {
					const fresh = makeTab();
					setActiveTabId(fresh.id);
					return [fresh];
				}
				if (activeTabId === id) {
					const idx = prev.findIndex((t) => t.id === id);
					const newActive = next[Math.min(idx, next.length - 1)];
					setActiveTabId(newActive.id);
				}
				return next;
			});
			webviewRefs.current.delete(id);
			setThumbnails((prev) => {
				const next = { ...prev };
				delete next[id];
				return next;
			});
			setTabFavicons((prev) => {
				const next = { ...prev };
				delete next[id];
				return next;
			});
		},
		[activeTabId],
	);

	const selectTab = useCallback((id: string) => {
		setActiveTabId(id);
		setViewMode("browser");
	}, []);

	const toggleOverview = useCallback(async () => {
		if (viewMode === "grid") {
			setViewMode("browser");
			return;
		}
		await captureAll();
		setViewMode("grid");
	}, [viewMode, captureAll]);

	const navigateTo = useCallback(
		(raw: string) => {
			let url = raw.trim();
			if (!url) return;
			if (!/^https?:\/\//i.test(url)) {
				url = url.includes(".") ? `https://${url}` : `https://www.google.com/search?q=${encodeURIComponent(url)}`;
			}
			setTabs((prev) =>
				prev.map((t) => (t.id === activeTabId ? { ...t, url, title: new URL(url).hostname } : t)),
			);
			setTabFavicons((prev) => {
				const next = { ...prev };
				delete next[activeTabId];
				return next;
			});
		},
		[activeTabId],
	);

	const handleUrlSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			navigateTo(urlInput);
			setUrlFocused(false);
		},
		[urlInput, navigateTo],
	);

	const makeWebviewRef = useCallback(
		(tabId: string) => (node: WebviewHTMLElement | null) => {
			if (node) {
				webviewRefs.current.set(tabId, node);
				const onTitle = () => syncTitle(tabId, node);
				const onLoad = () => {
					syncTitle(tabId, node);
					captureTab(tabId, node);
				};
				const onFavicon = (event: Event) => {
					const favicons = (event as unknown as { favicons?: string[] }).favicons ?? [];
					const safe = firstSafeHttpFavicon(favicons);
					if (safe) setTabFavicons((prev) => ({ ...prev, [tabId]: safe }));
				};
				node.addEventListener("page-title-updated", onTitle);
				node.addEventListener("did-finish-load", onLoad);
				node.addEventListener("page-favicon-updated", onFavicon);
			} else {
				webviewRefs.current.delete(tabId);
			}
		},
		[syncTitle, captureTab],
	);

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div className="flex h-10 w-full min-w-0 shrink-0 items-center gap-1 border-b bg-secondary/40 px-1.5 md:gap-1.5 md:px-2">
				<SidebarTrigger className="no-drag size-7 shrink-0 [&_svg]:size-3.5" />
				{viewMode === "browser" ? (
					<div className="flex min-h-0 min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						{tabs.map((tab) => (
							<div
								key={tab.id}
								onClick={() => setActiveTabId(tab.id)}
								className={cn(
									"group flex min-w-0 max-w-48 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] leading-tight transition-colors",
									tab.id === activeTabId
										? "bg-card text-foreground shadow-[0_1px_3px_hsl(0_0%_0%/0.06),0_2px_8px_hsl(0_0%_0%/0.04)]"
										: "text-muted-foreground hover:bg-background/55 hover:text-foreground",
								)}
							>
								<TabFavicon
									key={`${tab.id}-${tab.url}-${tabFavicons[tab.id] ?? ""}`}
									pageUrl={tab.url}
									preferredSrc={tabFavicons[tab.id]}
									className="h-3 w-3"
								/>
								<span className="truncate">{tab.title}</span>
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										closeTab(tab.id);
									}}
									className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
								>
									<X className="h-2.5 w-2.5" />
								</button>
							</div>
						))}
					</div>
				) : (
					<div className="flex min-w-0 flex-1 items-center px-1 text-xs font-medium text-muted-foreground">
						Overview · {tabs.length} {tabs.length === 1 ? "tab" : "tabs"}
					</div>
				)}
				<button
					type="button"
					onClick={toggleOverview}
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
					onClick={addTab}
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

			{viewMode === "browser" ? (
				<div className="flex items-center gap-1.5 px-1.5 py-1 shadow-[0_1px_0_0_hsl(var(--border)/0.5)] md:px-2">
					<div className="flex items-center gap-0.5">
						<button
							type="button"
							className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
						>
							<ArrowLeft className="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
						>
							<ArrowRight className="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent"
						>
							<RotateCcw className="h-3.5 w-3.5" />
						</button>
					</div>
					<form onSubmit={handleUrlSubmit} className="min-w-0 flex-1">
						<input
							type="text"
							value={urlFocused ? urlInput : activeTab?.url ?? ""}
							onChange={(e) => setUrlInput(e.target.value)}
							onFocus={() => {
								setUrlFocused(true);
								setUrlInput(activeTab?.url ?? "");
							}}
							onBlur={() => setUrlFocused(false)}
							placeholder="Search or enter URL..."
							className="h-8 w-full rounded-lg bg-secondary/60 px-3 text-[13px] text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
						/>
					</form>
				</div>
			) : null}

			<div className="relative min-h-0 flex-1 overflow-hidden bg-background">
				{viewMode === "grid" ? (
					<div className="absolute inset-0 z-10 overflow-auto bg-background p-8">
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
							{tabs.map((tab) => (
								<button
									key={tab.id}
									type="button"
									onClick={() => selectTab(tab.id)}
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
												<TabFavicon
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
												closeTab(tab.id);
											}}
											className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
										>
											<X className="h-3 w-3" />
										</button>
									</div>
									<div className="flex items-center gap-2 px-3 py-2 shadow-[inset_0_1px_0_0_hsl(var(--border)/0.5)]">
										<TabFavicon
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
								onClick={addTab}
								className="flex aspect-[16/10] flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground/40 transition-colors hover:border-primary/50 hover:text-primary/60"
							>
								<Plus className="h-8 w-8" />
								<span className="mt-1 text-xs font-medium">New tab</span>
							</button>
						</div>
					</div>
				) : null}

				<div
					className={cn(
						"absolute inset-0",
						viewMode === "grid" && "z-0 opacity-0 [&_webview]:pointer-events-none",
					)}
					aria-hidden={viewMode === "grid"}
				>
					{tabs.map((tab) => (
						<webview
							key={tab.id}
							src={tab.url}
							ref={makeWebviewRef(tab.id)}
							className={cn(
								"absolute inset-0 h-full w-full",
								tab.id !== activeTabId && "invisible",
							)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

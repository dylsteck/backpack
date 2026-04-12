import { useState, useCallback, useRef } from "react";
import { Plus, X, ArrowLeft, ArrowRight, RotateCcw, Globe, LayoutGrid, Columns2 } from "lucide-react";
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

export function FlyView() {
	const [tabs, setTabs] = useState<Tab[]>(STARTER_TABS);
	const [activeTabId, setActiveTabId] = useState(STARTER_TABS[0].id);
	const [viewMode, setViewMode] = useState<ViewMode>("browser");
	const [urlInput, setUrlInput] = useState("");
	const [urlFocused, setUrlFocused] = useState(false);
	const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
	const webviewRefs = useRef<Map<string, WebviewHTMLElement>>(new Map());

	const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

	const captureAll = useCallback(async () => {
		const entries = Array.from(webviewRefs.current.entries());
		const results = await Promise.allSettled(
			entries.map(async ([id, wv]) => {
				const image = await wv.capturePage();
				const dataUrl = image.toDataURL();
				if (dataUrl && dataUrl.length > 100) return [id, dataUrl] as const;
				return null;
			}),
		);
		const updates: Record<string, string> = {};
		for (const r of results) {
			if (r.status === "fulfilled" && r.value) {
				updates[r.value[0]] = r.value[1];
			}
		}
		if (Object.keys(updates).length > 0) {
			setThumbnails((prev) => ({ ...prev, ...updates }));
		}
	}, []);

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
		},
		[activeTabId],
	);

	const selectTab = useCallback((id: string) => {
		setActiveTabId(id);
		setViewMode("browser");
	}, []);

	const openGrid = useCallback(async () => {
		await captureAll();
		setViewMode("grid");
	}, [captureAll]);

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
				node.addEventListener("page-title-updated", onTitle);
			} else {
				webviewRefs.current.delete(tabId);
			}
		},
		[syncTitle],
	);

	if (viewMode === "grid") {
		return (
			<div className="flex flex-1 flex-col overflow-hidden">
				<div className="flex items-center justify-between border-b px-4 py-3">
					<button
						onClick={() => setViewMode("browser")}
						className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
					>
						<Columns2 className="h-3.5 w-3.5" />
						Back to browser
					</button>
					<div className="text-xs font-medium text-muted-foreground">
						{tabs.length} {tabs.length === 1 ? "tab" : "tabs"} open
					</div>
					<button
						onClick={addTab}
						className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						<Plus className="h-3.5 w-3.5" />
						New tab
					</button>
				</div>

				<div className="flex-1 overflow-auto p-6">
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
						{tabs.map((tab) => (
							<button
								key={tab.id}
								onClick={() => selectTab(tab.id)}
								className={cn(
									"group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:ring-2 hover:ring-primary/50 hover:shadow-lg",
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
											<Globe className="h-8 w-8 text-muted-foreground/30" />
										</div>
									)}
									<button
										onClick={(e) => {
											e.stopPropagation();
											closeTab(tab.id);
										}}
										className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
									>
										<X className="h-3 w-3" />
									</button>
								</div>
								<div className="flex items-center gap-2 border-t px-3 py-2">
									<Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
									<span className="truncate text-xs font-medium">{tab.title}</span>
								</div>
							</button>
						))}

						<button
							onClick={addTab}
							className="flex aspect-[16/10] flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 text-muted-foreground/40 transition-colors hover:border-primary/50 hover:text-primary/60"
						>
							<Plus className="h-8 w-8" />
							<span className="mt-1 text-xs font-medium">New tab</span>
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div className="flex items-center gap-0.5 border-b bg-muted/30 px-1 pt-1">
				<div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
					{tabs.map((tab) => (
						<div
							key={tab.id}
							onClick={() => setActiveTabId(tab.id)}
							className={cn(
								"group flex min-w-0 max-w-48 cursor-pointer items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-xs transition-colors",
								tab.id === activeTabId
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:bg-background/50 hover:text-foreground",
							)}
						>
							<Globe className="h-3 w-3 shrink-0" />
							<span className="truncate">{tab.title}</span>
							<button
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
				<button
					onClick={addTab}
					className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					<Plus className="h-3.5 w-3.5" />
				</button>
			</div>

			<div className="flex items-center gap-2 border-b px-2 py-1.5">
				<div className="flex items-center gap-0.5">
					<button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent">
						<ArrowLeft className="h-3.5 w-3.5" />
					</button>
					<button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent">
						<ArrowRight className="h-3.5 w-3.5" />
					</button>
					<button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent">
						<RotateCcw className="h-3.5 w-3.5" />
					</button>
				</div>
				<form onSubmit={handleUrlSubmit} className="flex-1">
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
						className="h-8 w-full rounded-lg bg-muted px-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
					/>
				</form>
				<button
					onClick={openGrid}
					className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
					title="Bird's eye view"
				>
					<LayoutGrid className="h-3.5 w-3.5" />
				</button>
			</div>

			{/* All webviews rendered; inactive ones are hidden but still load */}
			<div className="relative flex-1 overflow-hidden bg-background">
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
	);
}

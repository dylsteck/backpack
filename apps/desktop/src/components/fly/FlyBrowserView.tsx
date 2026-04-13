import { useQueryClient } from "@tanstack/react-query";
import { omniboxDisplayUrl } from "./browser/fly-browser-helpers";
import { FlyBrowserAddressBar } from "./browser/FlyBrowserAddressBar";
import { FlyBrowserOverview } from "./browser/FlyBrowserOverview";
import { FlyBrowserToolbar } from "./browser/FlyBrowserToolbar";
import { FlyBrowserWebviews } from "./browser/FlyBrowserWebviews";
import { useFlyBrowserShell } from "./browser/useFlyBrowserShell";
import { useFlyBrowserCommands } from "./browser/useFlyBrowserCommands";
import { useFlyBrowserWebview } from "./browser/useFlyBrowserWebview";

export function FlyBrowserView() {
	const queryClient = useQueryClient();
	const shell = useFlyBrowserShell();
	const web = useFlyBrowserWebview(queryClient, shell);
	const cmd = useFlyBrowserCommands(shell, web);

	if (!shell.ready || shell.tabs.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
				Loading Fly…
			</div>
		);
	}

	const activeTab = shell.tabs.find((t) => t.id === shell.activeTabId) ?? shell.tabs[0];
	const addressBarValue = shell.urlFocused
		? shell.urlInput
		: omniboxDisplayUrl(activeTab?.url);

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<FlyBrowserToolbar
				viewMode={shell.viewMode}
				tabs={shell.tabs}
				activeTabId={shell.activeTabId}
				tabFavicons={shell.tabFavicons}
				onActiveTabChange={(id) => {
					shell.setActiveTabId(id);
					shell.scheduleWindowPersist();
					const wv = shell.webviewRefs.current.get(id);
					shell.setNavCanGoBack(wv?.canGoBack() ?? false);
					shell.setNavCanGoForward(wv?.canGoForward() ?? false);
				}}
				onCloseTab={cmd.closeTab}
				onToggleOverview={cmd.toggleOverview}
				onAddTab={cmd.addTab}
			/>

			{shell.viewMode === "browser" ? (
				<FlyBrowserAddressBar
					value={addressBarValue}
					placeholder="Search Google or enter a URL…"
					onChange={shell.setUrlInput}
					onFocus={() => {
						shell.setUrlFocused(true);
						shell.setUrlInput(omniboxDisplayUrl(activeTab?.url));
					}}
					onBlur={() => shell.setUrlFocused(false)}
					onSubmit={cmd.handleUrlSubmit}
					onBack={cmd.goBack}
					onForward={cmd.goForward}
					onReload={cmd.reload}
					canGoBack={shell.navCanGoBack}
					canGoForward={shell.navCanGoForward}
				/>
			) : null}

			<div className="relative min-h-0 flex-1 overflow-hidden bg-background">
				{shell.viewMode === "grid" ? (
					<FlyBrowserOverview
						tabs={shell.tabs}
						activeTabId={shell.activeTabId}
						thumbnails={shell.thumbnails}
						tabFavicons={shell.tabFavicons}
						onSelectTab={cmd.selectTab}
						onCloseTab={cmd.closeTab}
						onAddTab={cmd.addTab}
					/>
				) : null}

				<FlyBrowserWebviews
					tabs={shell.tabs}
					activeTabId={shell.activeTabId}
					viewMode={shell.viewMode}
					makeWebviewRef={web.makeWebviewRef}
				/>
			</div>
		</div>
	);
}

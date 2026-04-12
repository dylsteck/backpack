import { useCallback } from "react";
import { flyApi } from "@/lib/backpack-client";
import { computeCloseTabResult } from "./fly-browser-close-tab";
import { hostTitle, makeFlyTab } from "./fly-browser-helpers";
import type { FlyBrowserShellApi } from "./fly-browser-shell-types";

type WebviewPart = {
	captureAll: () => Promise<void>;
	pushVisit: (tabId: string, url: string, transition: string) => void;
};

export function useFlyBrowserCommands(s: FlyBrowserShellApi, w: WebviewPart) {
	const addTab = useCallback(() => {
		const tab = makeFlyTab();
		s.setTabs((prev) => [...prev, tab]);
		s.setActiveTabId(tab.id);
		s.setViewMode("browser");
		s.scheduleWindowPersist();
	}, [s]);

	const closeTab = useCallback(
		(id: string) => {
			void flyApi.finalizeTab(id);
			s.setTabs((prev) => {
				const { nextTabs, nextActiveId } = computeCloseTabResult(
					prev,
					id,
					s.activeTabId,
				);
				s.setActiveTabId(nextActiveId);
				s.scheduleWindowPersist();
				return nextTabs;
			});
			s.webviewRefs.current.delete(id);
			s.setThumbnails((prev) => {
				const next = { ...prev };
				delete next[id];
				return next;
			});
			s.setTabFavicons((prev) => {
				const next = { ...prev };
				delete next[id];
				return next;
			});
		},
		[s],
	);

	const selectTab = useCallback(
		(id: string) => {
			s.setActiveTabId(id);
			s.setViewMode("browser");
			s.scheduleWindowPersist();
		},
		[s],
	);

	const toggleOverview = useCallback(async () => {
		if (s.viewMode === "grid") {
			s.setViewMode("browser");
			return;
		}
		await w.captureAll();
		s.setViewMode("grid");
	}, [s, w]);

	const navigateTo = useCallback(
		(raw: string) => {
			let url = raw.trim();
			if (!url) return;
			if (!/^https?:\/\//i.test(url)) {
				url = url.includes(".")
					? `https://${url}`
					: `https://www.google.com/search?q=${encodeURIComponent(url)}`;
			}
			s.setTabs((prev) =>
				prev.map((t) =>
					t.id === s.activeTabId ? { ...t, url, title: hostTitle(url) } : t,
				),
			);
			s.setTabFavicons((prev) => {
				const next = { ...prev };
				delete next[s.activeTabId];
				return next;
			});
			s.scheduleWindowPersist();
			w.pushVisit(s.activeTabId, url, "typed");
		},
		[s, w],
	);

	const handleUrlSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			navigateTo(s.urlInput);
			s.setUrlFocused(false);
		},
		[navigateTo, s],
	);

	const goBack = useCallback(() => {
		s.webviewRefs.current.get(s.activeTabId)?.goBack();
	}, [s.activeTabId, s.webviewRefs]);

	const goForward = useCallback(() => {
		s.webviewRefs.current.get(s.activeTabId)?.goForward();
	}, [s.activeTabId, s.webviewRefs]);

	const reload = useCallback(() => {
		s.webviewRefs.current.get(s.activeTabId)?.reload();
	}, [s.activeTabId, s.webviewRefs]);

	return {
		addTab,
		closeTab,
		selectTab,
		toggleOverview,
		navigateTo,
		handleUrlSubmit,
		goBack,
		goForward,
		reload,
	};
}

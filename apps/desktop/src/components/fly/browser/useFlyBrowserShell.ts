import { useState, useCallback, useRef } from "react";
import { flyApi } from "@/lib/backpack-client";
import { useMountEffect } from "@/hooks/useMountEffect";
import { makeFlyTab, hostTitle } from "./fly-browser-helpers";
import type { FlyBrowserTab, FlyViewMode } from "./fly-browser-types";

const PERSIST_DEBOUNCE_MS = 450;

export function useFlyBrowserShell() {
	const [ready, setReady] = useState(false);
	const [tabs, setTabs] = useState<FlyBrowserTab[]>([]);
	const [activeTabId, setActiveTabId] = useState("");
	const [viewMode, setViewMode] = useState<FlyViewMode>("browser");
	const [urlInput, setUrlInput] = useState("");
	const [urlFocused, setUrlFocused] = useState(false);
	const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
	const [tabFavicons, setTabFavicons] = useState<Record<string, string>>({});
	const [navCanGoBack, setNavCanGoBack] = useState(false);
	const [navCanGoForward, setNavCanGoForward] = useState(false);
	const webviewRefs = useRef<Map<string, WebviewHTMLElement>>(new Map());
	const sessionIdRef = useRef<string | null>(null);
	const tabsRef = useRef<FlyBrowserTab[]>([]);
	const activeTabIdRef = useRef("");
	const tabFaviconsRef = useRef<Record<string, string>>({});
	const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	tabsRef.current = tabs;
	activeTabIdRef.current = activeTabId;
	tabFaviconsRef.current = tabFavicons;

	const scheduleWindowPersist = useCallback(() => {
		if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
		persistTimerRef.current = setTimeout(() => {
			persistTimerRef.current = null;
			const t = tabsRef.current;
			const a = activeTabIdRef.current;
			if (t.length === 0 || !a) return;
			void flyApi.saveWindowState({
				tabs: t.map(({ id, url, title }) => ({ id, url, title })),
				activeTabId: a,
			});
		}, PERSIST_DEBOUNCE_MS);
	}, []);

	useMountEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const { sessionId } = await flyApi.ensureSession();
				if (cancelled) return;
				sessionIdRef.current = sessionId;
				const ws = await flyApi.getWindowState();
				if (cancelled) return;
				if (ws && ws.tabs.length > 0) {
					setTabs(
						ws.tabs.map((x) => ({
							id: x.id,
							url: x.url || "about:blank",
							title: x.title?.trim() || hostTitle(x.url),
						})),
					);
					setActiveTabId(ws.activeTabId);
				} else {
					const tab = makeFlyTab();
					setTabs([tab]);
					setActiveTabId(tab.id);
				}
			} finally {
				if (!cancelled) setReady(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	return {
		ready,
		tabs,
		setTabs,
		activeTabId,
		setActiveTabId,
		viewMode,
		setViewMode,
		urlInput,
		setUrlInput,
		urlFocused,
		setUrlFocused,
		thumbnails,
		setThumbnails,
		tabFavicons,
		setTabFavicons,
		navCanGoBack,
		setNavCanGoBack,
		navCanGoForward,
		setNavCanGoForward,
		webviewRefs,
		sessionIdRef,
		tabsRef,
		activeTabIdRef,
		tabFaviconsRef,
		scheduleWindowPersist,
	};
}

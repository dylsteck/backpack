import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { flyApi } from "@/lib/backpack-client";
import { invalidateFlyHistoryQueries } from "@/lib/fly-history-queries";
import { hostTitle, isBlankPageUrl } from "./fly-browser-helpers";
import { makeWebviewRefCallback } from "./fly-browser-webview-ref";
import type { FlyBrowserShellApi } from "./fly-browser-shell-types";

const CAPTURE_PAGE_TIMEOUT_MS = 2800;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error("capture timeout")), ms);
		promise.then(
			(v) => {
				clearTimeout(t);
				resolve(v);
			},
			(e) => {
				clearTimeout(t);
				reject(e);
			},
		);
	});
}

export function useFlyBrowserWebview(queryClient: QueryClient, s: FlyBrowserShellApi) {
	const captureTab = useCallback(async (id: string, wv: WebviewHTMLElement) => {
		try {
			const image = await withTimeout(wv.capturePage(), CAPTURE_PAGE_TIMEOUT_MS);
			const dataUrl = image.toDataURL();
			if (dataUrl && dataUrl.length > 100) {
				s.setThumbnails((prev) => ({ ...prev, [id]: dataUrl }));
			}
		} catch {
			/* timeout, invisible webview, or capture failure — keep prior thumbnail / favicon */
		}
	}, [s]);

	const captureAll = useCallback(async () => {
		const entries = Array.from(s.webviewRefs.current.entries());
		await Promise.allSettled(entries.map(([id, wv]) => captureTab(id, wv)));
	}, [captureTab, s.webviewRefs]);

	const syncTitle = useCallback(
		(id: string, wv: WebviewHTMLElement) => {
			const raw = wv.getTitle?.()?.trim();
			const pageUrl = wv.getURL?.() ?? "";
			if (isBlankPageUrl(pageUrl) || raw === "about:blank") {
				s.setTabs((prev) =>
					prev.map((t) => (t.id === id ? { ...t, title: "New Tab" } : t)),
				);
				s.scheduleWindowPersist();
				return;
			}
			if (raw) {
				s.setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, title: raw } : t)));
				s.scheduleWindowPersist();
			}
		},
		[s],
	);

	const pushVisit = useCallback(
		(tabId: string, url: string, transition: string) => {
			const sid = s.sessionIdRef.current;
			if (!sid || url === "about:blank") return;
			const wv = s.webviewRefs.current.get(tabId);
			const title = wv?.getTitle?.() || hostTitle(url);
			const faviconUrl = s.tabFaviconsRef.current[tabId] ?? null;
			void flyApi
				.recordVisit({
					sessionId: sid,
					tabId,
					url,
					title,
					faviconUrl,
					transition,
				})
				.then(() => invalidateFlyHistoryQueries(queryClient));
		},
		[queryClient, s.sessionIdRef, s.tabFaviconsRef, s.webviewRefs],
	);

	const onDidNavigate = useCallback(
		(tabId: string, url: string) => {
			if (url === "about:blank") return;
			s.setTabs((prev) =>
				prev.map((t) =>
					t.id === tabId ? { ...t, url, title: t.title || hostTitle(url) } : t,
				),
			);
			s.scheduleWindowPersist();
			pushVisit(tabId, url, "link");
		},
		[pushVisit, s],
	);

	const makeWebviewRef = useCallback(
		(tabId: string) =>
			makeWebviewRefCallback(tabId, {
				webviewRefs: s.webviewRefs,
				syncTitle,
				captureTab,
				scheduleWindowPersist: s.scheduleWindowPersist,
				onDidNavigate,
				setTabFavicons: s.setTabFavicons,
			}),
		[s, syncTitle, captureTab, onDidNavigate],
	);

	return {
		captureTab,
		captureAll,
		syncTitle,
		pushVisit,
		onDidNavigate,
		makeWebviewRef,
	};
}

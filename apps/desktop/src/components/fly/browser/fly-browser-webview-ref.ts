import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { firstSafeHttpFavicon, readNavigateUrl } from "./fly-browser-helpers";

export type WebviewRefDeps = {
	webviewRefs: MutableRefObject<Map<string, WebviewHTMLElement>>;
	syncTitle: (id: string, wv: WebviewHTMLElement) => void;
	captureTab: (id: string, wv: WebviewHTMLElement) => Promise<void>;
	scheduleWindowPersist: () => void;
	onDidNavigate: (tabId: string, url: string) => void;
	setTabFavicons: Dispatch<SetStateAction<Record<string, string>>>;
};

export function attachWebviewNode(tabId: string, node: WebviewHTMLElement, d: WebviewRefDeps): void {
	d.webviewRefs.current.set(tabId, node);
	const onTitle = () => d.syncTitle(tabId, node);
	const onLoad = () => {
		d.syncTitle(tabId, node);
		void d.captureTab(tabId, node);
	};
	const onFavicon = (event: Event) => {
		const favicons = (event as unknown as { favicons?: string[] }).favicons ?? [];
		const safe = firstSafeHttpFavicon(favicons);
		if (safe) {
			d.setTabFavicons((prev) => ({ ...prev, [tabId]: safe }));
			d.scheduleWindowPersist();
		}
	};
	const onNavigate = (e: Event) => {
		const url = readNavigateUrl(e);
		if (url) d.onDidNavigate(tabId, url);
	};
	node.addEventListener("page-title-updated", onTitle);
	node.addEventListener("did-finish-load", onLoad);
	node.addEventListener("page-favicon-updated", onFavicon);
	node.addEventListener("did-navigate", onNavigate);
	node.addEventListener("did-navigate-in-page", onNavigate);
}

export function makeWebviewRefCallback(
	tabId: string,
	deps: WebviewRefDeps,
): (node: WebviewHTMLElement | null) => void {
	return (node) => {
		if (node) {
			attachWebviewNode(tabId, node, deps);
		} else {
			deps.webviewRefs.current.delete(tabId);
		}
	};
}

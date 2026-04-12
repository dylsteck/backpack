import type { FlyBrowserTab } from "./fly-browser-types";

export function makeFlyTab(url = "about:blank", title = "New Tab"): FlyBrowserTab {
	return { id: crypto.randomUUID(), url, title };
}

export function isBlankPageUrl(url: string): boolean {
	const u = url.trim().toLowerCase();
	return u === "" || u === "about:blank" || u === "about:srcdoc";
}

export function hostTitle(url: string): string {
	if (isBlankPageUrl(url)) return "New Tab";
	try {
		return new URL(url).hostname || "New Tab";
	} catch {
		return "New Tab";
	}
}

/** Address bar display (hide about:blank). */
export function omniboxDisplayUrl(url: string | undefined): string {
	if (url == null || isBlankPageUrl(url)) return "";
	return url;
}

export function readNavigateUrl(e: Event): string | undefined {
	if ("url" in e && typeof (e as { url: unknown }).url === "string") {
		return (e as { url: string }).url;
	}
	return undefined;
}

export function googleHostedFaviconUrl(pageUrl: string): string | null {
	try {
		const { protocol, hostname } = new URL(pageUrl);
		if ((protocol !== "http:" && protocol !== "https:") || !hostname) return null;
		return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostname)}`;
	} catch {
		return null;
	}
}

export function firstSafeHttpFavicon(urls: string[]): string | null {
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

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

/** Address bar display: hide about:blank so the field looks empty until the user types. */
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

/** Resolve omnibox / typed input to a full http(s) URL, or null if empty. */
export function resolveNavigationUrl(raw: string): string | null {
	let url = raw.trim();
	if (!url) return null;
	if (!/^https?:\/\//i.test(url)) {
		url = url.includes(".")
			? `https://${url}`
			: `https://www.google.com/search?q=${encodeURIComponent(url)}`;
	}
	return url;
}

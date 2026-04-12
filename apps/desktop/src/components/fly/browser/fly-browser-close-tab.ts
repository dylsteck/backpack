import { makeFlyTab } from "./fly-browser-helpers";
import type { FlyBrowserTab } from "./fly-browser-types";

export function computeCloseTabResult(
	prev: FlyBrowserTab[],
	id: string,
	activeTabId: string,
): { nextTabs: FlyBrowserTab[]; nextActiveId: string } {
	const next = prev.filter((t) => t.id !== id);
	if (next.length === 0) {
		const fresh = makeFlyTab();
		return { nextTabs: [fresh], nextActiveId: fresh.id };
	}
	if (activeTabId === id) {
		const idx = prev.findIndex((t) => t.id === id);
		const picked = next[Math.min(idx, next.length - 1)];
		return { nextTabs: next, nextActiveId: picked!.id };
	}
	return { nextTabs: next, nextActiveId: activeTabId };
}

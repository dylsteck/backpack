import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { FlyBrowserTab, FlyViewMode } from "./fly-browser-types";

/** Mutable fly browser state wired between shell + action hooks. */
export type FlyBrowserShellApi = {
	tabs: FlyBrowserTab[];
	setTabs: Dispatch<SetStateAction<FlyBrowserTab[]>>;
	activeTabId: string;
	setActiveTabId: (id: string) => void;
	viewMode: FlyViewMode;
	setViewMode: Dispatch<SetStateAction<FlyViewMode>>;
	urlInput: string;
	setUrlInput: Dispatch<SetStateAction<string>>;
	setUrlFocused: (v: boolean) => void;
	thumbnails: Record<string, string>;
	setThumbnails: Dispatch<SetStateAction<Record<string, string>>>;
	tabFavicons: Record<string, string>;
	setTabFavicons: Dispatch<SetStateAction<Record<string, string>>>;
	webviewRefs: MutableRefObject<Map<string, WebviewHTMLElement>>;
	sessionIdRef: MutableRefObject<string | null>;
	tabFaviconsRef: MutableRefObject<Record<string, string>>;
	scheduleWindowPersist: () => void;
};

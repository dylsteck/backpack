import type {
	TimelineOptions,
	TimelineResult,
	ItemsOptions,
	ItemsResult,
	Item,
	SearchOptions,
	SearchResult,
	StatusResult,
	Connection,
} from "@backpack/sdk";
import type { FlyRendererApi } from "@/types/fly";

interface BackpackApi {
	timeline(opts?: TimelineOptions): Promise<TimelineResult>;
	items(opts?: ItemsOptions): Promise<ItemsResult>;
	get(id: string): Promise<Item | null>;
	search(query: string, opts?: SearchOptions): Promise<SearchResult>;
	status(): Promise<StatusResult>;
	connections(): Promise<Connection[]>;
	apps(): Promise<
		Array<{
			id: string;
			name: string;
			description: string;
			iconUrl: string;
			connectionType: string;
			oauth: boolean;
		}>
	>;
	dbPath(): Promise<string>;
	setDbPath(dbPath: string): Promise<string>;
}

interface WindowApi {
	minimize(): Promise<void>;
	maximize(): Promise<void>;
	close(): Promise<void>;
	/** macOS only; no-op on other platforms in main. */
	setTrafficLightsVisible(visible: boolean): Promise<void>;
}

interface ThemeApi {
	get(): Promise<{ shouldUseDark: boolean; source: "system" | "light" | "dark" }>;
	set(source: "system" | "light" | "dark"): Promise<{
		shouldUseDark: boolean;
		source: "system" | "light" | "dark";
	}>;
}

declare global {
	interface Window {
		runtime?: { readonly platform: NodeJS.Platform };
		backpack: BackpackApi;
		win: WindowApi;
		theme: ThemeApi;
		fly: FlyRendererApi;
	}
}

export const runtime: Window["runtime"] = window.runtime;

export const backpack: BackpackApi = window.backpack;
export const winApi: WindowApi = window.win;
export const themeApi: ThemeApi = window.theme;
export const flyApi: FlyRendererApi = window.fly;

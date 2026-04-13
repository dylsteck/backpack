import { contextBridge, ipcRenderer } from "electron";
import type {
	AnalyticsArgs,
	ListSearchesArgs,
	ListVisitsArgs,
	RecordVisitPayload,
	WindowStatePayload,
} from "@/types/fly";
import { FLY_CHANNELS, SDK_CHANNELS, THEME_CHANNELS, WEBVIEW_CHANNELS, WINDOW_CHANNELS } from "./channels";

const runtime = {
	platform: process.platform,
} as const;

const backpackApi = {
	timeline: (opts?: unknown) => ipcRenderer.invoke(SDK_CHANNELS.timeline, opts),
	items: (opts?: unknown) => ipcRenderer.invoke(SDK_CHANNELS.items, opts),
	get: (id: string) => ipcRenderer.invoke(SDK_CHANNELS.get, id),
	search: (query: string, opts?: unknown) =>
		ipcRenderer.invoke(SDK_CHANNELS.search, query, opts),
	status: () => ipcRenderer.invoke(SDK_CHANNELS.status),
	connections: () => ipcRenderer.invoke(SDK_CHANNELS.connections),
	apps: () => ipcRenderer.invoke(SDK_CHANNELS.apps),
	dbPath: () => ipcRenderer.invoke(SDK_CHANNELS.dbPath),
	setDbPath: (dbPath: string) => ipcRenderer.invoke(SDK_CHANNELS.setDbPath, dbPath),
};

const windowApi = {
	minimize: () => ipcRenderer.invoke(WINDOW_CHANNELS.minimize),
	maximize: () => ipcRenderer.invoke(WINDOW_CHANNELS.maximize),
	close: () => ipcRenderer.invoke(WINDOW_CHANNELS.close),
	setTrafficLightsVisible: (visible: boolean) =>
		ipcRenderer.invoke(WINDOW_CHANNELS.setTrafficLightsVisible, visible),
};

const themeApi = {
	get: () => ipcRenderer.invoke(THEME_CHANNELS.get),
	set: (source: "system" | "light" | "dark") => ipcRenderer.invoke(THEME_CHANNELS.set, source),
};

const webviewApi = {
	onOpenUrl: (cb: (url: string) => void) => {
		const handler = (_event: Electron.IpcRendererEvent, url: string) => cb(url);
		ipcRenderer.on(WEBVIEW_CHANNELS.openUrl, handler);
		return () => ipcRenderer.removeListener(WEBVIEW_CHANNELS.openUrl, handler);
	},
};

const flyApi = {
	ensureSession: () => ipcRenderer.invoke(FLY_CHANNELS.ensureSession) as Promise<{ sessionId: string }>,
	recordVisit: (payload: RecordVisitPayload) =>
		ipcRenderer.invoke(FLY_CHANNELS.recordVisit, payload) as Promise<{ visitId: string }>,
	finalizeTab: (tabId: string) => ipcRenderer.invoke(FLY_CHANNELS.finalizeTab, tabId),
	listVisits: (args?: ListVisitsArgs) => ipcRenderer.invoke(FLY_CHANNELS.listVisits, args),
	listSearches: (args?: ListSearchesArgs) => ipcRenderer.invoke(FLY_CHANNELS.listSearches, args),
	analytics: (args?: AnalyticsArgs) => ipcRenderer.invoke(FLY_CHANNELS.analytics, args),
	deleteAllHistory: () => ipcRenderer.invoke(FLY_CHANNELS.deleteAllHistory),
	getWindowState: () => ipcRenderer.invoke(FLY_CHANNELS.getWindowState),
	saveWindowState: (state: WindowStatePayload) => ipcRenderer.invoke(FLY_CHANNELS.saveWindowState, state),
};

export function exposeContexts(): void {
	contextBridge.exposeInMainWorld("runtime", runtime);
	contextBridge.exposeInMainWorld("backpack", backpackApi);
	contextBridge.exposeInMainWorld("win", windowApi);
	contextBridge.exposeInMainWorld("theme", themeApi);
	contextBridge.exposeInMainWorld("webview", webviewApi);
	contextBridge.exposeInMainWorld("fly", flyApi);
}

export type BackpackApi = typeof backpackApi;
export type WindowApi = typeof windowApi;
export type ThemeApi = typeof themeApi;
export type WebviewApi = typeof webviewApi;
export type FlyApi = typeof flyApi;

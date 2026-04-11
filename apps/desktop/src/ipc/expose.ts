import { contextBridge, ipcRenderer } from "electron";
import { SDK_CHANNELS, THEME_CHANNELS, WINDOW_CHANNELS } from "./channels";

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
};

const themeApi = {
	get: () => ipcRenderer.invoke(THEME_CHANNELS.get),
	set: (source: "system" | "light" | "dark") => ipcRenderer.invoke(THEME_CHANNELS.set, source),
};

export function exposeContexts(): void {
	contextBridge.exposeInMainWorld("backpack", backpackApi);
	contextBridge.exposeInMainWorld("win", windowApi);
	contextBridge.exposeInMainWorld("theme", themeApi);
}

export type BackpackApi = typeof backpackApi;
export type WindowApi = typeof windowApi;
export type ThemeApi = typeof themeApi;

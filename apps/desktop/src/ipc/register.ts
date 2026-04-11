import { BrowserWindow, ipcMain, nativeTheme } from "electron";
import type { Backpack } from "@backpack/sdk";
import { SDK_CHANNELS, THEME_CHANNELS, WINDOW_CHANNELS } from "./channels";

export function registerIpcHandlers(backpack: Backpack): void {
	ipcMain.handle(SDK_CHANNELS.timeline, (_e, opts) => backpack.timeline(opts));
	ipcMain.handle(SDK_CHANNELS.items, (_e, opts) => backpack.items(opts));
	ipcMain.handle(SDK_CHANNELS.get, (_e, id: string) => backpack.get(id));
	ipcMain.handle(SDK_CHANNELS.search, (_e, query: string, opts) => backpack.search(query, opts));
	ipcMain.handle(SDK_CHANNELS.status, () => backpack.status());
	ipcMain.handle(SDK_CHANNELS.connections, () => backpack.connections());
	ipcMain.handle(SDK_CHANNELS.apps, () => backpack.apps());
	ipcMain.handle(SDK_CHANNELS.dbPath, () => backpack.dbPath);
	ipcMain.handle(SDK_CHANNELS.setDbPath, (_e, dbPath: string) => {
		backpack.setDbPath(dbPath);
		return backpack.dbPath;
	});

	ipcMain.handle(WINDOW_CHANNELS.minimize, (e) => {
		BrowserWindow.fromWebContents(e.sender)?.minimize();
	});
	ipcMain.handle(WINDOW_CHANNELS.maximize, (e) => {
		const win = BrowserWindow.fromWebContents(e.sender);
		if (!win) return;
		if (win.isMaximized()) win.unmaximize();
		else win.maximize();
	});
	ipcMain.handle(WINDOW_CHANNELS.close, (e) => {
		BrowserWindow.fromWebContents(e.sender)?.close();
	});

	ipcMain.handle(THEME_CHANNELS.get, () => ({
		shouldUseDark: nativeTheme.shouldUseDarkColors,
		source: nativeTheme.themeSource,
	}));
	ipcMain.handle(THEME_CHANNELS.set, (_e, source: "system" | "light" | "dark") => {
		nativeTheme.themeSource = source;
		return { shouldUseDark: nativeTheme.shouldUseDarkColors, source };
	});
}

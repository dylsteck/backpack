import { BrowserWindow, ipcMain, nativeTheme } from "electron";
import type { Backpack, FlyHistoryService } from "@backpack/sdk";
import { FLY_CHANNELS, SDK_CHANNELS, THEME_CHANNELS, WINDOW_CHANNELS } from "./channels";

export function registerIpcHandlers(getBackpack: () => Backpack): void {
	ipcMain.handle(SDK_CHANNELS.timeline, (_e, opts) => getBackpack().timeline(opts));
	ipcMain.handle(SDK_CHANNELS.items, (_e, opts) => getBackpack().items(opts));
	ipcMain.handle(SDK_CHANNELS.get, (_e, id: string) => getBackpack().get(id));
	ipcMain.handle(SDK_CHANNELS.search, (_e, query: string, opts) =>
		getBackpack().search(query, opts),
	);
	ipcMain.handle(SDK_CHANNELS.status, () => getBackpack().status());
	ipcMain.handle(SDK_CHANNELS.connections, () => getBackpack().connections());
	ipcMain.handle(SDK_CHANNELS.apps, () => getBackpack().apps());
	ipcMain.handle(SDK_CHANNELS.dbPath, () => getBackpack().dbPath);
	ipcMain.handle(SDK_CHANNELS.setDbPath, (_e, dbPath: string) => {
		const backpack = getBackpack();
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

	ipcMain.handle(WINDOW_CHANNELS.setTrafficLightsVisible, (e, visible: boolean) => {
		if (process.platform !== "darwin") return;
		const win = BrowserWindow.fromWebContents(e.sender);
		if (!win) return;
		(
			win as BrowserWindow & { setWindowButtonVisibility(visible: boolean): void }
		).setWindowButtonVisibility(visible);
	});

	ipcMain.handle(THEME_CHANNELS.get, () => ({
		shouldUseDark: nativeTheme.shouldUseDarkColors,
		source: nativeTheme.themeSource,
	}));
	ipcMain.handle(THEME_CHANNELS.set, (_e, source: "system" | "light" | "dark") => {
		nativeTheme.themeSource = source;
		return { shouldUseDark: nativeTheme.shouldUseDarkColors, source };
	});

	ipcMain.handle(FLY_CHANNELS.ensureSession, () => ({
		sessionId: getBackpack().flyHistory.ensureSession(),
	}));
	ipcMain.handle(FLY_CHANNELS.recordVisit, (_e, payload: Parameters<FlyHistoryService["recordVisit"]>[0]) =>
		getBackpack().flyHistory.recordVisit(payload),
	);
	ipcMain.handle(FLY_CHANNELS.finalizeTab, (_e, tabId: string) => {
		getBackpack().flyHistory.finalizeTab(tabId);
	});
	ipcMain.handle(FLY_CHANNELS.listVisits, (_e, args: Parameters<FlyHistoryService["listVisits"]>[0]) =>
		getBackpack().flyHistory.listVisits(args ?? {}),
	);
	ipcMain.handle(FLY_CHANNELS.listSearches, (_e, args: Parameters<FlyHistoryService["listSearches"]>[0]) =>
		getBackpack().flyHistory.listSearches(args ?? {}),
	);
	ipcMain.handle(FLY_CHANNELS.analytics, (_e, args: Parameters<FlyHistoryService["getAnalytics"]>[0]) =>
		getBackpack().flyHistory.getAnalytics(args ?? {}),
	);
	ipcMain.handle(FLY_CHANNELS.deleteAllHistory, () => getBackpack().flyHistory.deleteAllHistory());
	ipcMain.handle(FLY_CHANNELS.getWindowState, () => getBackpack().flyHistory.getWindowState());
	ipcMain.handle(FLY_CHANNELS.saveWindowState, (_e, state: Parameters<FlyHistoryService["saveWindowState"]>[0]) =>
		getBackpack().flyHistory.saveWindowState(state),
	);
}

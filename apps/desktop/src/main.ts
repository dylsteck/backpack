import { app, BrowserWindow, nativeTheme } from "electron";
import path from "node:path";
import { Backpack } from "@backpack/sdk";
import { registerIpcHandlers } from "./ipc/register";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

const inDevelopment = process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null = null;
let backpack: Backpack | null = null;

function getBackpack(): Backpack {
	backpack ??= new Backpack();
	return backpack;
}

function windowBackgroundHex(): string {
	// Match app light/dark shells so the window does not flash white before the renderer paints.
	return nativeTheme.shouldUseDarkColors ? "#252524" : "#ffffff";
}

function createWindow() {
	const preload = path.join(__dirname, "preload.js");

	const iconPath = inDevelopment
		? path.join(process.cwd(), "images", "icon.png")
		: path.join(process.resourcesPath, "images", "icon.png");

	mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 960,
		minHeight: 600,
		show: false,
		backgroundColor: windowBackgroundHex(),
		icon: iconPath,
		titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
		trafficLightPosition: process.platform === "darwin" ? { x: 18, y: 12 } : undefined,
		webPreferences: {
			preload,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
			webviewTag: true,
		},
	});

	mainWindow.once("ready-to-show", () => {
		mainWindow?.show();
	});

	if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined" && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
	}

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

// Suppress ERR_ABORTED (-3) from webview guest navigation — this is normal browser behavior
// when a navigation is superseded by another (e.g. clicking a link while a page is still loading).
function isAbortError(err: unknown): boolean {
	if (!err || typeof err !== "object") return false;
	const e = err as Record<string, unknown>;
	return e.errno === -3 || e.code === "ERR_ABORTED";
}
process.on("uncaughtException", (err) => {
	if (isAbortError(err)) return;
	console.error("Uncaught exception:", err);
});
process.on("unhandledRejection", (reason) => {
	if (isAbortError(reason)) return;
	console.error("Unhandled rejection:", reason);
});

// Intercept target="_blank" / window.open in webviews: deny the OS window
// and send the URL to the renderer to open as an in-app tab.
app.on("web-contents-created", (_event, wc) => {
	if (wc.getType() === "webview") {
		wc.setWindowOpenHandler(({ url }) => {
			mainWindow?.webContents.send("webview:open-url", url);
			return { action: "deny" };
		});
	}
});

app.whenReady().then(() => {
	createWindow();
	registerIpcHandlers(getBackpack);

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") app.quit();
});

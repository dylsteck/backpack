import { app, BrowserWindow } from "electron";
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

	if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined" && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
	}

	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}

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

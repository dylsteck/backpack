import {
	CHROME_DETECT_HISTORY_PATH_CHANNEL,
	CHROME_READ_HISTORY_CHANNEL,
	CHROME_VERIFY_PATH_CHANNEL,
} from "./chrome-channels";

export function exposeChromeContext() {
	const electron = (typeof window !== "undefined" && (window as any).require) 
		? (window as any).require("electron") 
		: require("electron");
	const { contextBridge, ipcRenderer } = electron;
	contextBridge.exposeInMainWorld("chromeHistory", {
		detectHistoryPath: () => ipcRenderer.invoke(CHROME_DETECT_HISTORY_PATH_CHANNEL),
		verifyPath: (path: string) => ipcRenderer.invoke(CHROME_VERIFY_PATH_CHANNEL, path),
		readHistory: (path: string) => ipcRenderer.invoke(CHROME_READ_HISTORY_CHANNEL, path),
	});
}

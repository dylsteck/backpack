import {
	BRAVE_DETECT_HISTORY_PATH_CHANNEL,
	BRAVE_READ_HISTORY_CHANNEL,
	BRAVE_VERIFY_PATH_CHANNEL,
} from "./brave-channels";

export function exposeBraveContext() {
	const electron = (typeof window !== "undefined" && (window as any).require) 
		? (window as any).require("electron") 
		: require("electron");
	const { contextBridge, ipcRenderer } = electron;
	contextBridge.exposeInMainWorld("braveHistory", {
		detectHistoryPath: () => ipcRenderer.invoke(BRAVE_DETECT_HISTORY_PATH_CHANNEL),
		verifyPath: (path: string) => ipcRenderer.invoke(BRAVE_VERIFY_PATH_CHANNEL, path),
		readHistory: (path: string) => ipcRenderer.invoke(BRAVE_READ_HISTORY_CHANNEL, path),
	});
}


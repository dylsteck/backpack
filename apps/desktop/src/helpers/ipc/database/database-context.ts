import { contextBridge, ipcRenderer } from "electron";
import {
	DATABASE_SELECT_FOLDER_CHANNEL,
	DATABASE_GET_PATH_CHANNEL,
	DATABASE_SET_PATH_CHANNEL,
	DATABASE_GET_DEFAULT_PATH_CHANNEL,
	DATABASE_INIT_CHANNEL,
} from "./database-channels";

export interface DatabaseContext {
	selectFolder: () => Promise<string | null>;
	getPath: () => Promise<string | null>;
	setPath: (path: string) => Promise<{ success: boolean }>;
	getDefaultPath: () => Promise<string>;
	initDatabase: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>;
}

export function exposeDatabaseContext(): void {
	const databaseContext: DatabaseContext = {
		selectFolder: () => ipcRenderer.invoke(DATABASE_SELECT_FOLDER_CHANNEL),
		getPath: () => ipcRenderer.invoke(DATABASE_GET_PATH_CHANNEL),
		setPath: (path: string) => ipcRenderer.invoke(DATABASE_SET_PATH_CHANNEL, path),
		getDefaultPath: () => ipcRenderer.invoke(DATABASE_GET_DEFAULT_PATH_CHANNEL),
		initDatabase: (path: string) => ipcRenderer.invoke(DATABASE_INIT_CHANNEL, path),
	};

	contextBridge.exposeInMainWorld("databaseApi", databaseContext);
}


import {
	OBSIDIAN_SELECT_VAULT_CHANNEL,
	OBSIDIAN_READ_VAULT_CHANNEL,
	OBSIDIAN_READ_NOTE_CHANNEL,
	OBSIDIAN_CREATE_NOTE_CHANNEL,
	OBSIDIAN_UPDATE_NOTE_CHANNEL,
	OBSIDIAN_SEARCH_NOTES_CHANNEL,
} from "./obsidian-channels";

export interface ObsidianNote {
	path: string;
	title: string;
	body: string;
	mtime: number;
	tags?: string[];
	backlinks?: string[];
}

export interface ObsidianVaultResult {
	success: boolean;
	notes?: ObsidianNote[];
	error?: string;
	vaultPath?: string;
	noteCount?: number;
}

export function exposeObsidianContext() {
	const electron = (typeof window !== "undefined" && (window as any).require) 
		? (window as any).require("electron") 
		: require("electron");
	const { contextBridge, ipcRenderer } = electron;
	
	contextBridge.exposeInMainWorld("obsidianVault", {
		selectVault: () => ipcRenderer.invoke(OBSIDIAN_SELECT_VAULT_CHANNEL),
		readVault: (vaultPath: string) => ipcRenderer.invoke(OBSIDIAN_READ_VAULT_CHANNEL, vaultPath),
		readNote: (notePath: string) => ipcRenderer.invoke(OBSIDIAN_READ_NOTE_CHANNEL, notePath),
		createNote: (vaultPath: string, title: string, content: string, frontmatter?: Record<string, unknown>) => 
			ipcRenderer.invoke(OBSIDIAN_CREATE_NOTE_CHANNEL, vaultPath, title, content, frontmatter),
		updateNote: (notePath: string, content: string, mode: 'replace' | 'append' | 'prepend') => 
			ipcRenderer.invoke(OBSIDIAN_UPDATE_NOTE_CHANNEL, notePath, content, mode),
		searchNotes: (vaultPath: string, query: string) => 
			ipcRenderer.invoke(OBSIDIAN_SEARCH_NOTES_CHANNEL, vaultPath, query),
	});
}


"use strict";
const electron = require("electron");
const THEME_MODE_CURRENT_CHANNEL = "theme-mode:current";
const THEME_MODE_TOGGLE_CHANNEL = "theme-mode:toggle";
const THEME_MODE_DARK_CHANNEL = "theme-mode:dark";
const THEME_MODE_LIGHT_CHANNEL = "theme-mode:light";
const THEME_MODE_SYSTEM_CHANNEL = "theme-mode:system";
function exposeThemeContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");
  contextBridge.exposeInMainWorld("themeMode", {
    current: () => ipcRenderer.invoke(THEME_MODE_CURRENT_CHANNEL),
    toggle: () => ipcRenderer.invoke(THEME_MODE_TOGGLE_CHANNEL),
    dark: () => ipcRenderer.invoke(THEME_MODE_DARK_CHANNEL),
    light: () => ipcRenderer.invoke(THEME_MODE_LIGHT_CHANNEL),
    system: () => ipcRenderer.invoke(THEME_MODE_SYSTEM_CHANNEL)
  });
}
const WIN_MINIMIZE_CHANNEL = "window:minimize";
const WIN_MAXIMIZE_CHANNEL = "window:maximize";
const WIN_CLOSE_CHANNEL = "window:close";
const WIN_OPEN_EXTERNAL_CHANNEL = "window:open-external";
function exposeWindowContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");
  contextBridge.exposeInMainWorld("electronWindow", {
    minimize: () => ipcRenderer.invoke(WIN_MINIMIZE_CHANNEL),
    maximize: () => ipcRenderer.invoke(WIN_MAXIMIZE_CHANNEL),
    close: () => ipcRenderer.invoke(WIN_CLOSE_CHANNEL),
    openExternal: (url) => ipcRenderer.invoke(WIN_OPEN_EXTERNAL_CHANNEL, url)
  });
}
const CHROME_DETECT_HISTORY_PATH_CHANNEL = "chrome:detect-history-path";
const CHROME_READ_HISTORY_CHANNEL = "chrome:read-history";
const CHROME_VERIFY_PATH_CHANNEL = "chrome:verify-path";
function exposeChromeContext() {
  const electron2 = typeof window !== "undefined" && window.require ? window.require("electron") : require("electron");
  const { contextBridge, ipcRenderer } = electron2;
  contextBridge.exposeInMainWorld("chromeHistory", {
    detectHistoryPath: () => ipcRenderer.invoke(CHROME_DETECT_HISTORY_PATH_CHANNEL),
    verifyPath: (path) => ipcRenderer.invoke(CHROME_VERIFY_PATH_CHANNEL, path),
    readHistory: (path) => ipcRenderer.invoke(CHROME_READ_HISTORY_CHANNEL, path)
  });
}
const BRAVE_DETECT_HISTORY_PATH_CHANNEL = "brave:detect-history-path";
const BRAVE_READ_HISTORY_CHANNEL = "brave:read-history";
const BRAVE_VERIFY_PATH_CHANNEL = "brave:verify-path";
function exposeBraveContext() {
  const electron2 = typeof window !== "undefined" && window.require ? window.require("electron") : require("electron");
  const { contextBridge, ipcRenderer } = electron2;
  contextBridge.exposeInMainWorld("braveHistory", {
    detectHistoryPath: () => ipcRenderer.invoke(BRAVE_DETECT_HISTORY_PATH_CHANNEL),
    verifyPath: (path) => ipcRenderer.invoke(BRAVE_VERIFY_PATH_CHANNEL, path),
    readHistory: (path) => ipcRenderer.invoke(BRAVE_READ_HISTORY_CHANNEL, path)
  });
}
const DEEPLINK_CALLBACK_CHANNEL = "deep-link-callback";
function exposeDeepLinkContext() {
  electron.contextBridge.exposeInMainWorld("electronDeepLink", {
    onCallback: (callback) => {
      electron.ipcRenderer.on(DEEPLINK_CALLBACK_CHANNEL, (_event, data) => {
        callback(data);
      });
    },
    removeCallback: () => {
      electron.ipcRenderer.removeAllListeners(DEEPLINK_CALLBACK_CHANNEL);
    }
  });
}
function exposeServerContext() {
  const serverContext = {
    getPort: () => electron.ipcRenderer.invoke("get-server-port"),
    onPortChange: (callback) => {
      const handler = (_event, port) => {
        callback(port);
      };
      electron.ipcRenderer.on("server-port", handler);
      return () => {
        electron.ipcRenderer.removeListener("server-port", handler);
      };
    }
  };
  electron.contextBridge.exposeInMainWorld("serverApi", serverContext);
}
const DATABASE_SELECT_FOLDER_CHANNEL = "database:select-folder";
const DATABASE_GET_PATH_CHANNEL = "database:get-path";
const DATABASE_SET_PATH_CHANNEL = "database:set-path";
const DATABASE_GET_DEFAULT_PATH_CHANNEL = "database:get-default-path";
const DATABASE_INIT_CHANNEL = "database:init";
function exposeDatabaseContext() {
  const databaseContext = {
    selectFolder: () => electron.ipcRenderer.invoke(DATABASE_SELECT_FOLDER_CHANNEL),
    getPath: () => electron.ipcRenderer.invoke(DATABASE_GET_PATH_CHANNEL),
    setPath: (path) => electron.ipcRenderer.invoke(DATABASE_SET_PATH_CHANNEL, path),
    getDefaultPath: () => electron.ipcRenderer.invoke(DATABASE_GET_DEFAULT_PATH_CHANNEL),
    initDatabase: (path) => electron.ipcRenderer.invoke(DATABASE_INIT_CHANNEL, path)
  };
  electron.contextBridge.exposeInMainWorld("databaseApi", databaseContext);
}
const SHELL_OPEN_EXTERNAL_CHANNEL = "shell:open-external";
function exposeShellContext() {
  electron.contextBridge.exposeInMainWorld("shellApi", {
    openExternal: (url) => {
      return electron.ipcRenderer.invoke(SHELL_OPEN_EXTERNAL_CHANNEL, url);
    }
  });
}
const OBSIDIAN_SELECT_VAULT_CHANNEL = "obsidian:select-vault";
const OBSIDIAN_READ_VAULT_CHANNEL = "obsidian:read-vault";
const OBSIDIAN_READ_NOTE_CHANNEL = "obsidian:read-note";
const OBSIDIAN_CREATE_NOTE_CHANNEL = "obsidian:create-note";
const OBSIDIAN_UPDATE_NOTE_CHANNEL = "obsidian:update-note";
const OBSIDIAN_DELETE_NOTE_CHANNEL = "obsidian:delete-note";
const OBSIDIAN_SEARCH_NOTES_CHANNEL = "obsidian:search-notes";
function exposeObsidianContext() {
  const electron2 = typeof window !== "undefined" && window.require ? window.require("electron") : require("electron");
  const { contextBridge, ipcRenderer } = electron2;
  contextBridge.exposeInMainWorld("obsidianVault", {
    selectVault: () => ipcRenderer.invoke(OBSIDIAN_SELECT_VAULT_CHANNEL),
    readVault: (vaultPath) => ipcRenderer.invoke(OBSIDIAN_READ_VAULT_CHANNEL, vaultPath),
    readNote: (notePath) => ipcRenderer.invoke(OBSIDIAN_READ_NOTE_CHANNEL, notePath),
    createNote: (vaultPath, title, content, frontmatter) => ipcRenderer.invoke(OBSIDIAN_CREATE_NOTE_CHANNEL, vaultPath, title, content, frontmatter),
    updateNote: (notePath, content, mode) => ipcRenderer.invoke(OBSIDIAN_UPDATE_NOTE_CHANNEL, notePath, content, mode),
    deleteNote: (notePath) => ipcRenderer.invoke(OBSIDIAN_DELETE_NOTE_CHANNEL, notePath),
    searchNotes: (vaultPath, query) => ipcRenderer.invoke(OBSIDIAN_SEARCH_NOTES_CHANNEL, vaultPath, query)
  });
}
function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeChromeContext();
  exposeBraveContext();
  exposeDeepLinkContext();
  exposeServerContext();
  exposeDatabaseContext();
  exposeShellContext();
  exposeObsidianContext();
}
exposeContexts();

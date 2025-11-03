"use strict";
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
function exposeWindowContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");
  contextBridge.exposeInMainWorld("electronWindow", {
    minimize: () => ipcRenderer.invoke(WIN_MINIMIZE_CHANNEL),
    maximize: () => ipcRenderer.invoke(WIN_MAXIMIZE_CHANNEL),
    close: () => ipcRenderer.invoke(WIN_CLOSE_CHANNEL)
  });
}
const CHROME_DETECT_HISTORY_PATH_CHANNEL = "chrome:detect-history-path";
const CHROME_READ_HISTORY_CHANNEL = "chrome:read-history";
const CHROME_VERIFY_PATH_CHANNEL = "chrome:verify-path";
function exposeChromeContext() {
  const electron = typeof window !== "undefined" && window.require ? window.require("electron") : require("electron");
  const { contextBridge, ipcRenderer } = electron;
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
  const electron = typeof window !== "undefined" && window.require ? window.require("electron") : require("electron");
  const { contextBridge, ipcRenderer } = electron;
  contextBridge.exposeInMainWorld("braveHistory", {
    detectHistoryPath: () => ipcRenderer.invoke(BRAVE_DETECT_HISTORY_PATH_CHANNEL),
    verifyPath: (path) => ipcRenderer.invoke(BRAVE_VERIFY_PATH_CHANNEL, path),
    readHistory: (path) => ipcRenderer.invoke(BRAVE_READ_HISTORY_CHANNEL, path)
  });
}
function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeChromeContext();
  exposeBraveContext();
}
exposeContexts();

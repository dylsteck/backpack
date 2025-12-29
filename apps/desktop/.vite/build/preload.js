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
  if (typeof window === "undefined") {
    return;
  }
  const { contextBridge: contextBridge2, ipcRenderer: ipcRenderer2 } = window.require("electron");
  contextBridge2.exposeInMainWorld("electronDeepLink", {
    onCallback: (callback) => {
      ipcRenderer2.on(DEEPLINK_CALLBACK_CHANNEL, (_event, data) => {
        callback(data);
      });
    },
    removeCallback: () => {
      ipcRenderer2.removeAllListeners(DEEPLINK_CALLBACK_CHANNEL);
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
function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeChromeContext();
  exposeBraveContext();
  exposeDeepLinkContext();
  exposeServerContext();
}
exposeContexts();

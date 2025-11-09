import { contextBridge, ipcRenderer } from "electron";

const DEEPLINK_CALLBACK_CHANNEL = "deep-link-callback";

export function exposeDeepLinkContext() {
  if (typeof window === "undefined") {
    return;
  }

  const { contextBridge, ipcRenderer } = window.require("electron");
  
  contextBridge.exposeInMainWorld("electronDeepLink", {
    onCallback: (callback: (data: any) => void) => {
      ipcRenderer.on(DEEPLINK_CALLBACK_CHANNEL, (_event, data) => {
        callback(data);
      });
    },
    removeCallback: () => {
      ipcRenderer.removeAllListeners(DEEPLINK_CALLBACK_CHANNEL);
    },
  });
}


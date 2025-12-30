import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

const DEEPLINK_CALLBACK_CHANNEL = "deep-link-callback";

export function exposeDeepLinkContext() {
  contextBridge.exposeInMainWorld("electronDeepLink", {
    onCallback: (callback: (data: unknown) => void) => {
      ipcRenderer.on(DEEPLINK_CALLBACK_CHANNEL, (_event: IpcRendererEvent, data: unknown) => {
        callback(data);
      });
    },
    removeCallback: () => {
      ipcRenderer.removeAllListeners(DEEPLINK_CALLBACK_CHANNEL);
    },
  });
}


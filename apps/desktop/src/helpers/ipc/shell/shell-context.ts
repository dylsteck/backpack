import { contextBridge, ipcRenderer } from "electron";
import { SHELL_OPEN_EXTERNAL_CHANNEL } from "./shell-channels";

export function exposeShellContext() {
  contextBridge.exposeInMainWorld("shellApi", {
    openExternal: (url: string): Promise<void> => {
      return ipcRenderer.invoke(SHELL_OPEN_EXTERNAL_CHANNEL, url);
    },
  });
}


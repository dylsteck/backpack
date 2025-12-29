/**
 * Server Context - Exposes server port to renderer
 */

import { contextBridge, ipcRenderer } from "electron";

export interface ServerContext {
  getPort: () => Promise<number>;
  onPortChange: (callback: (port: number) => void) => () => void;
}

export function exposeServerContext(): void {
  const serverContext: ServerContext = {
    getPort: () => ipcRenderer.invoke("get-server-port"),
    onPortChange: (callback: (port: number) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, port: number) => {
        callback(port);
      };
      ipcRenderer.on("server-port", handler);
      return () => {
        ipcRenderer.removeListener("server-port", handler);
      };
    },
  };

  contextBridge.exposeInMainWorld("serverApi", serverContext);
}


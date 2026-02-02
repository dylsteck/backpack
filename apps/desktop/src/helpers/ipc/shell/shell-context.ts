import { contextBridge, ipcRenderer } from "electron";
import { SHELL_OPEN_EXTERNAL_CHANNEL, SHELL_CHECK_CLI_INSTALLED, SHELL_INSTALL_CLI, SHELL_CHECK_QMD_INSTALLED, SHELL_INSTALL_QMD } from "./shell-channels";

export function exposeShellContext() {
  contextBridge.exposeInMainWorld("shellApi", {
    openExternal: (url: string): Promise<void> => {
      return ipcRenderer.invoke(SHELL_OPEN_EXTERNAL_CHANNEL, url);
    },
    checkCliInstalled: (): Promise<{ installed: boolean; version?: string }> => {
      return ipcRenderer.invoke(SHELL_CHECK_CLI_INSTALLED);
    },
    installCli: (): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke(SHELL_INSTALL_CLI);
    },
    checkQmdInstalled: (): Promise<{ installed: boolean; version?: string }> => {
      return ipcRenderer.invoke(SHELL_CHECK_QMD_INSTALLED);
    },
    installQmd: (): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke(SHELL_INSTALL_QMD);
    },
  });
}


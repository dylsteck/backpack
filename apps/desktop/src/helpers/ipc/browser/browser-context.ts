import {
	BROWSER_CREATE_TAB_CHANNEL,
	BROWSER_CLOSE_TAB_CHANNEL,
	BROWSER_SWITCH_TAB_CHANNEL,
	BROWSER_NAVIGATE_TAB_CHANNEL,
	BROWSER_GO_BACK_CHANNEL,
	BROWSER_GO_FORWARD_CHANNEL,
	BROWSER_RELOAD_TAB_CHANNEL,
	BROWSER_GET_ALL_TABS_CHANNEL,
	BROWSER_GET_TAB_CHANNEL,
	BROWSER_CAPTURE_SCREENSHOT_CHANNEL,
	BROWSER_EVENT_CHANNEL,
	BROWSER_UPDATE_BOUNDS_CHANNEL,
	BROWSER_HIDE_TABS_CHANNEL,
	BROWSER_SHOW_TABS_CHANNEL,
	MCP_CALL_TOOL_CHANNEL,
	MCP_LIST_TOOLS_CHANNEL,
	MCP_GET_STATUS_CHANNEL,
} from "./browser-channels";

export function exposeBrowserContext() {
	const electron = (typeof window !== "undefined" && (window as any).require) 
		? (window as any).require("electron") 
		: require("electron");
	const { contextBridge, ipcRenderer } = electron;
	
	contextBridge.exposeInMainWorld("browser", {
		createTab: (url?: string) => ipcRenderer.invoke(BROWSER_CREATE_TAB_CHANNEL, url),
		closeTab: (tabId: string) => ipcRenderer.invoke(BROWSER_CLOSE_TAB_CHANNEL, tabId),
		switchTab: (tabId: string) => ipcRenderer.invoke(BROWSER_SWITCH_TAB_CHANNEL, tabId),
		navigateTab: (tabId: string, url: string) => ipcRenderer.invoke(BROWSER_NAVIGATE_TAB_CHANNEL, tabId, url),
		goBack: (tabId: string) => ipcRenderer.invoke(BROWSER_GO_BACK_CHANNEL, tabId),
		goForward: (tabId: string) => ipcRenderer.invoke(BROWSER_GO_FORWARD_CHANNEL, tabId),
		reloadTab: (tabId: string) => ipcRenderer.invoke(BROWSER_RELOAD_TAB_CHANNEL, tabId),
		getAllTabs: () => ipcRenderer.invoke(BROWSER_GET_ALL_TABS_CHANNEL),
		getTab: (tabId: string) => ipcRenderer.invoke(BROWSER_GET_TAB_CHANNEL, tabId),
		captureScreenshot: (tabId: string) => ipcRenderer.invoke(BROWSER_CAPTURE_SCREENSHOT_CHANNEL, tabId),
		updateBounds: (bounds: { x: number; y: number; width: number; height: number }) => 
			ipcRenderer.invoke(BROWSER_UPDATE_BOUNDS_CHANNEL, bounds),
		hideTabs: () => ipcRenderer.invoke(BROWSER_HIDE_TABS_CHANNEL),
		showTabs: () => ipcRenderer.invoke(BROWSER_SHOW_TABS_CHANNEL),
		on: (callback: (event: string, ...args: any[]) => void) => {
			ipcRenderer.on(BROWSER_EVENT_CHANNEL, (_event, data) => callback(data.event, ...data.args));
		},
		off: () => {
			ipcRenderer.removeAllListeners(BROWSER_EVENT_CHANNEL);
		},
	});
	
	contextBridge.exposeInMainWorld("mcp", {
		callTool: (toolName: string, args: object) => ipcRenderer.invoke(MCP_CALL_TOOL_CHANNEL, toolName, args),
		listTools: () => ipcRenderer.invoke(MCP_LIST_TOOLS_CHANNEL),
		getStatus: () => ipcRenderer.invoke(MCP_GET_STATUS_CHANNEL),
	});
}

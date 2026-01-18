import { ipcMain, BrowserWindow } from "electron";
import { BrowserManager } from "../../browser/manager";
import { getMCPInstance } from "../../mcp/chrome-devtools";
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
	BROWSER_UPDATE_BOUNDS_CHANNEL,
	BROWSER_HIDE_TABS_CHANNEL,
	BROWSER_SHOW_TABS_CHANNEL,
	MCP_CALL_TOOL_CHANNEL,
	MCP_LIST_TOOLS_CHANNEL,
	MCP_GET_STATUS_CHANNEL,
} from "./browser-channels";

let browserManager: BrowserManager | null = null;
let mcpClient: any = null; // Will be set when MCP client is created

export function setBrowserManager(manager: BrowserManager) {
	browserManager = manager;
}

export function getBrowserManager(): BrowserManager | null {
	return browserManager;
}

export function setMCPClient(client: any) {
	mcpClient = client;
}

function serializeTab(tab: any) {
	return {
		id: tab.id,
		url: tab.url,
		title: tab.title,
		favicon: tab.favicon,
		loading: tab.loading,
		canGoBack: tab.canGoBack,
		canGoForward: tab.canGoForward,
	};
}

export function addBrowserEventListeners(mainWindow: BrowserWindow) {
	if (!browserManager) {
		browserManager = new BrowserManager(mainWindow);
		
		// Listen for browser events to retry MCP initialization when tabs are created
		ipcMain.on('browser-event', (_event, data: { event: string; args: any[] }) => {
			if (data.event === 'tab-created') {
				// Retry MCP initialization now that a browser tab exists
				setTimeout(() => {
					const mcpInstance = getMCPInstance();
					if (mcpInstance && !mcpInstance.getStatus().running) {
						console.log('[MCP] Retrying initialization after tab creation');
						mcpInstance.retryInitialization().catch(console.error);
					}
				}, 2000); // Wait for tab to fully load
			}
		});
	}
	
	// Create new tab
	ipcMain.handle(BROWSER_CREATE_TAB_CHANNEL, async (_event, url?: string) => {
		if (!browserManager) return null;
		return browserManager.createTab(url);
	});
	
	// Switch tab
	ipcMain.handle(BROWSER_SWITCH_TAB_CHANNEL, async (_event, tabId: string) => {
		if (!browserManager) return;
		browserManager.switchTab(tabId);
	});
	
	// Close tab
	ipcMain.handle(BROWSER_CLOSE_TAB_CHANNEL, async (_event, tabId: string) => {
		if (!browserManager) return;
		await browserManager.closeTab(tabId);
	});
	
	// Get tab
	ipcMain.handle(BROWSER_GET_TAB_CHANNEL, async (_event, tabId: string) => {
		if (!browserManager) return null;
		const tab = browserManager.getTab(tabId);
		return tab ? serializeTab(tab) : null;
	});
	
	// Get all tabs
	ipcMain.handle(BROWSER_GET_ALL_TABS_CHANNEL, async () => {
		if (!browserManager) return [];
		return browserManager.getAllTabs().map(serializeTab);
	});
	
	// Navigate
	ipcMain.handle(BROWSER_NAVIGATE_TAB_CHANNEL, async (_event, tabId: string, url: string) => {
		if (!browserManager) return;
		browserManager.navigateTab(tabId, url);
	});
	
	// Reload
	ipcMain.handle(BROWSER_RELOAD_TAB_CHANNEL, async (_event, tabId: string) => {
		if (!browserManager) return;
		browserManager.reloadTab(tabId);
	});
	
	// Go back
	ipcMain.handle(BROWSER_GO_BACK_CHANNEL, async (_event, tabId: string) => {
		if (!browserManager) return;
		browserManager.goBack(tabId);
	});
	
	// Go forward
	ipcMain.handle(BROWSER_GO_FORWARD_CHANNEL, async (_event, tabId: string) => {
		if (!browserManager) return;
		browserManager.goForward(tabId);
	});
	
	// Capture screenshot
	ipcMain.handle(BROWSER_CAPTURE_SCREENSHOT_CHANNEL, async (_event, tabId: string) => {
		if (!browserManager) return null;
		return await browserManager.captureScreenshot(tabId);
	});
	
	// Update bounds
	ipcMain.handle(BROWSER_UPDATE_BOUNDS_CHANNEL, async (_event, bounds: { x: number; y: number; width: number; height: number }) => {
		if (!browserManager) return;
		browserManager.updateBoundsManually(bounds);
	});
	
	// Hide all tabs
	ipcMain.handle(BROWSER_HIDE_TABS_CHANNEL, async () => {
		if (!browserManager) return;
		browserManager.hideAllTabs();
	});
	
	// Show active tab
	ipcMain.handle(BROWSER_SHOW_TABS_CHANNEL, async () => {
		if (!browserManager) return;
		browserManager.showActiveTab();
	});
	
	// MCP tool calls
	ipcMain.handle(MCP_CALL_TOOL_CHANNEL, async (_event, toolName: string, args: object) => {
		if (!mcpClient) {
			throw new Error('MCP client not initialized');
		}
		return await mcpClient.callTool(toolName, args);
	});
	
	ipcMain.handle(MCP_LIST_TOOLS_CHANNEL, async () => {
		if (!mcpClient) {
			return [];
		}
		return await mcpClient.listTools();
	});
	
	ipcMain.handle(MCP_GET_STATUS_CHANNEL, async () => {
		if (!mcpClient) {
			return { running: false };
		}
		return await mcpClient.getStatus();
	});
}

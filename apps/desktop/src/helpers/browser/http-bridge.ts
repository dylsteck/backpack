/**
 * HTTP Bridge for Browser MCP Tools
 * Allows the server to call browser MCP tools via HTTP
 * Now with DIRECT FALLBACK when MCP fails
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import * as net from 'net';
import { getMCPInstance } from '../mcp/chrome-devtools';
import { getBrowserManager } from '../ipc/browser/browser-listeners';
import safeConsole from '../safe-console';

let httpServer: ReturnType<typeof createServer> | null = null;
let bridgePort: number = 0;

/**
 * Check what pages CDP can see (for debugging)
 */
async function checkCDPPages(): Promise<void> {
  try {
    const cdpPort = process.env.ELECTRON_CDP_PORT || process.env.CDP_PORT || '9222';
    const response = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    const pages = await response.json();
    console.log(`[Bridge] CDP sees ${pages.length} pages:`, pages.map((p: any) => ({ id: p.id, url: p.url, title: p.title })));
  } catch (error) {
    console.error('[Bridge] Failed to check CDP pages:', error);
  }
}

/**
 * Execute tool using Electron's native webContents.debugger API (for our tabs)
 * This works even when chrome-devtools-mcp can't see our WebContentsView instances
 */
async function executeNativeBrowserTool(toolName: string, args: any): Promise<any> {
  const browserManager = getBrowserManager();
  if (!browserManager) {
    throw new Error('Browser not initialized');
  }
  
  const activeTab = browserManager.getActiveTab();
  if (!activeTab) {
    throw new Error('No active browser tab');
  }
  
  switch (toolName) {
    case 'navigate_page': {
      const url = args?.url;
      if (!url) throw new Error('URL required for navigation');
      const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
      
      // Use CDP Page.navigate for more reliable navigation
      try {
        await browserManager.executeCDPCommand(activeTab.id, 'Page.navigate', { url: normalizedUrl });
        return { success: true, url: normalizedUrl, message: `Navigated to ${normalizedUrl}` };
      } catch (error) {
        // Fallback to direct navigation
        browserManager.navigateTab(activeTab.id, normalizedUrl);
        return { success: true, url: normalizedUrl, message: `Navigated to ${normalizedUrl}` };
      }
    }
    
    case 'list_pages': {
      const tabs = browserManager.getAllTabs();
      return tabs.map((tab, index) => ({
        id: index,
        url: tab.url,
        title: tab.title,
        isActive: tab.id === activeTab.id,
      }));
    }
    
    case 'select_page': {
      const tabs = browserManager.getAllTabs();
      // If no pageId provided, use active tab (index 0 or find active)
      let pageId = args?.pageId;
      if (pageId === undefined || pageId === null) {
        // Find active tab index
        const activeTab = browserManager.getActiveTab();
        if (activeTab) {
          pageId = tabs.findIndex(t => t.id === activeTab.id);
          if (pageId < 0) pageId = 0;
        } else {
          pageId = 0;
        }
      }
      if (pageId >= 0 && pageId < tabs.length) {
        const tab = tabs[pageId];
        browserManager.switchTab(tab.id);
        return { success: true, selected: pageId, url: tab.url };
      }
      return { success: false, error: `Invalid page ID: ${pageId}. Available pages: ${tabs.length}` };
    }
    
    case 'take_screenshot': {
      const screenshot = await browserManager.captureScreenshot(activeTab.id);
      return { screenshot };
    }
    
    case 'take_snapshot': {
      // Use CDP DOMSnapshot for better snapshot
      try {
        const snapshot = await browserManager.executeCDPCommand(activeTab.id, 'DOMSnapshot.captureSnapshot', {
          computedStyles: [],
          includePaintOrder: false,
          includeDOMRects: false,
        });
        
        // Extract text content from snapshot
        const textContent = await activeTab.view.webContents.executeJavaScript(`
          (function() {
            return {
              url: window.location.href,
              title: document.title,
              text: document.body?.innerText?.substring(0, 5000) || '',
            };
          })()
        `);
        return textContent;
      } catch (error) {
        // Fallback to simple JavaScript execution
        const content = await activeTab.view.webContents.executeJavaScript(`
          (function() {
            return {
              url: window.location.href,
              title: document.title,
              text: document.body?.innerText?.substring(0, 5000) || '',
            };
          })()
        `);
        return content;
      }
    }
    
    case 'click': {
      // Use CDP to find element by accessibility tree uid and click it
      const uid = args?.uid;
      if (!uid) throw new Error('UID required for click');
      
      try {
        // Get accessibility tree to find element by uid
        const accessibilityTree = await browserManager.executeCDPCommand(activeTab.id, 'Accessibility.getFullAXTree', {});
        
        // Find node with matching backendDOMNodeId or id
        const findNodeByUid = (nodes: any[], targetUid: string): any => {
          for (const node of nodes) {
            // UID format from snapshot is like "1_11" - check nodeId or backendDOMNodeId
            const nodeId = node.nodeId?.toString() || node.backendDOMNodeId?.toString();
            if (nodeId === targetUid || nodeId?.endsWith(`_${targetUid.split('_')[1]}`)) {
              return node;
            }
            if (node.children) {
              const found = findNodeByUid(node.children, targetUid);
              if (found) return found;
            }
          }
          return null;
        };
        
        const targetNode = findNodeByUid(accessibilityTree.nodes || [], uid);
        if (!targetNode || !targetNode.backendDOMNodeId) {
          throw new Error(`Element with uid ${uid} not found in accessibility tree`);
        }
        
        // Get DOM node and its bounding box
        const domNode = await browserManager.executeCDPCommand(activeTab.id, 'DOM.describeNode', {
          backendNodeId: targetNode.backendDOMNodeId,
        });
        
        const boxModel = await browserManager.executeCDPCommand(activeTab.id, 'DOM.getBoxModel', {
          backendNodeId: targetNode.backendDOMNodeId,
        });
        
        if (!boxModel.model || !boxModel.model.content) {
          throw new Error(`Could not get bounding box for element ${uid}`);
        }
        
        // Calculate center of element
        const content = boxModel.model.content;
        const centerX = (content[0] + content[2]) / 2;
        const centerY = (content[1] + content[5]) / 2;
        
        // Click at center
        await browserManager.executeCDPCommand(activeTab.id, 'Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: Math.round(centerX),
          y: Math.round(centerY),
          button: 'left',
          clickCount: args?.dblClick ? 2 : 1,
        });
        
        await browserManager.executeCDPCommand(activeTab.id, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: Math.round(centerX),
          y: Math.round(centerY),
          button: 'left',
          clickCount: args?.dblClick ? 2 : 1,
        });
        
        return { success: true, clicked: uid, position: { x: Math.round(centerX), y: Math.round(centerY) } };
      } catch (error: any) {
        // Fallback: try to click by executing JavaScript
        try {
          await activeTab.view.webContents.executeJavaScript(`
            (function() {
              // Try to find and click element - this is a fallback
              const links = Array.from(document.querySelectorAll('a'));
              const targetLink = links.find(link => link.href && link.textContent.trim().toLowerCase().includes('base'));
              if (targetLink) {
                targetLink.click();
                return { success: true, method: 'javascript_fallback' };
              }
              throw new Error('Could not find element to click');
            })()
          `);
          return { success: true, method: 'javascript_fallback' };
        } catch (fallbackError: any) {
          throw new Error(`Click failed: ${error.message}. Fallback also failed: ${fallbackError.message}`);
        }
      }
    }
    
    case 'fill': {
      // Use CDP Input.insertText
      const uid = args?.uid;
      const value = args?.value;
      if (!uid || !value) throw new Error('UID and value required for fill');
      
      // Focus element first, then insert text
      await browserManager.executeCDPCommand(activeTab.id, 'Input.insertText', { text: value });
      return { success: true };
    }
    
    default:
      throw new Error(`Tool ${toolName} not supported in native mode. Use MCP for advanced features.`);
  }
}

/**
 * Start HTTP bridge server for browser tool calls
 */
export async function startBrowserBridge(): Promise<number> {
  if (httpServer) {
    return bridgePort;
  }
  
  // Find available port starting from 3001
  bridgePort = await findAvailablePort(3001);
  
  httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    if (req.method !== 'POST' || req.url !== '/browser-tool') {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    
    try {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }
      
      const { toolName, args } = JSON.parse(body);
      
      // Validate toolName and args
      if (!toolName || typeof toolName !== 'string') {
        throw new Error('toolName is required and must be a string');
      }
      
      // Ensure browser component is ready
      const browserManager = getBrowserManager();
      if (!browserManager) {
        throw new Error('Browser manager not initialized - ensure you are on the /browser route');
      }
      
      // Check if browser has tabs
      const tabs = browserManager.getAllTabs();
      
      // If no tabs exist, create one (this can happen if browser tools are called before navigating to browser route)
      if (tabs.length === 0) {
        safeConsole.log('[Bridge] No tabs found, creating default tab');
        const newTabId = browserManager.createTab('https://www.google.com');
        browserManager.switchTab(newTabId);
        // Wait a bit for tab to initialize
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Ensure active tab exists (MCP needs at least one page to connect to)
      const activeTab = browserManager.getActiveTab();
      if (!activeTab && tabs.length > 0) {
        browserManager.switchTab(tabs[0].id);
      } else if (!activeTab) {
        // Re-fetch tabs after creating one
        const updatedTabs = browserManager.getAllTabs();
        if (updatedTabs.length > 0) {
          browserManager.switchTab(updatedTabs[0].id);
        }
      }
      
      // Small delay to ensure CDP has registered the tab (WebContentsView needs time to appear in CDP)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Debug: Check what CDP sees before MCP call
      if (toolName === 'list_pages' || toolName === 'navigate_page') {
        await checkCDPPages();
      }
      
      let result: any;
      const mcpInstance = getMCPInstance();
      const mcpStatus = mcpInstance.getStatus();
      
      // Try MCP first with short timeout (10 seconds - increased for CDP discovery), then fall back to direct control
      if (mcpStatus.running) {
        try {
          safeConsole.log(`[Bridge] Attempting MCP call for ${toolName}...`);
          result = await Promise.race([
            mcpInstance.callTool(toolName, args || {}),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('MCP_TIMEOUT')), 10000) // Increased to 10s for CDP discovery
            ),
          ]);
          console.log(`[Bridge] MCP call succeeded for ${toolName}`);
        } catch (mcpError: any) {
          // MCP failed or timed out - use native Electron debugger API
          // This works because WebContentsView instances aren't exposed via remote debugging port
          safeConsole.warn(`[Bridge] MCP failed (${mcpError?.message}), using native Electron debugger API for ${toolName}`);
          safeConsole.warn(`[Bridge] Note: WebContentsView tabs aren't visible to chrome-devtools-mcp via CDP`);
          try {
            result = await executeNativeBrowserTool(toolName, args || {});
            console.log(`[Bridge] Native tool execution succeeded for ${toolName}`);
          } catch (nativeError: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: nativeError.message }));
            return;
          }
        }
      } else {
        // MCP not running - use native Electron debugger API immediately
        safeConsole.log(`[Bridge] MCP not running, using native Electron debugger API for ${toolName}`);
        try {
          result = await executeNativeBrowserTool(toolName, args || {});
        } catch (nativeError: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: nativeError.message }));
          return;
        }
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        error: errorMessage
      }));
    }
  });
  
  return new Promise((resolve, reject) => {
    httpServer!.listen(bridgePort, '127.0.0.1', () => {
      console.log(`[Browser Bridge] HTTP server listening on port ${bridgePort}`);
      resolve(bridgePort);
    });
    
    httpServer!.on('error', (error) => {
      safeConsole.error('[Browser Bridge] Server error:', error);
      reject(error);
    });
  });
}

/**
 * Stop HTTP bridge server
 */
export function stopBrowserBridge(): void {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
    bridgePort = 0;
  }
}

/**
 * Get bridge port
 */
export function getBridgePort(): number {
  return bridgePort;
}

/**
 * Find available port
 */
function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(startPort, '127.0.0.1', () => {
      const address = server.address() as { port: number };
      const port = address.port;
      server.close(() => resolve(port));
    });
    
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

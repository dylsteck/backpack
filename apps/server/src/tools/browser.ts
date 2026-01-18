/**
 * Browser Tools for AI Chat
 * Tools that control the in-app browser via MCP
 * These tools proxy to Electron's browser bridge
 */

import { tool } from "ai";
import { z } from "zod";

// Get browser bridge port from environment (set by Electron)
const BRIDGE_PORT = process.env.BROWSER_BRIDGE_PORT || "3001";
const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}/browser-tool`;

/**
 * Call browser MCP tool via HTTP bridge
 */
async function callBrowserTool(toolName: string, args: any): Promise<any> {
  try {
    const response = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName, args }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bridge returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Tool call failed');
    }
    
    return data.result;
  } catch (error: any) {
    // If bridge is not available, return error
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      throw new Error('Browser bridge not available. Make sure the browser tab is open.');
    }
    // Re-throw with better error message
    throw new Error(`Failed to call browser tool ${toolName}: ${error.message || error}`);
  }
}

/**
 * Navigate to a URL in the browser
 */
export const browserNavigateTool = tool({
  description:
    "Navigate the browser to a URL. CRITICAL: You MUST always provide the 'url' parameter as a string property in an object. Example: browser_navigate({\"url\": \"withcortex.com\"}) or browser_navigate({\"url\": \"https://example.com\"}). Never call this tool without the url parameter.",
  inputSchema: z.object({
    url: z.string({
      required_error: "URL parameter is REQUIRED - you must provide a url property",
      invalid_type_error: "URL must be a string, not undefined or null",
    }).min(1, "URL cannot be empty - provide a website address like 'withcortex.com'").describe("REQUIRED: The URL to navigate to. Examples: 'withcortex.com', 'https://example.com', 'google.com'. Protocol will be added automatically if missing."),
    type: z.enum(["url", "back", "forward", "reload"]).optional().default("url").describe("Navigation type - always use 'url' for normal navigation"),
  }).strict(), // Use strict() to reject unknown properties and ensure all required fields are present
  execute: async (input) => {
    try {
      // Log input for debugging
      console.log('[browser_navigate] Received input:', JSON.stringify(input));
      
      // Validate input exists
      if (!input || typeof input !== 'object') {
        throw new Error('Invalid input: expected an object with "url" property. Example: {"url": "withcortex.com"}');
      }
      
      // Safely extract and validate input
      const { url, type = 'url' } = input as { url?: string; type?: string };
      
      // Validate URL is provided
      if (!url) {
        throw new Error('Missing required parameter: "url". You must provide a URL. Example: {"url": "withcortex.com"}');
      }
      
      if (typeof url !== 'string') {
        throw new Error(`Invalid URL type: expected string, got ${typeof url}. Example: {"url": "withcortex.com"}`);
      }
      
      if (url.trim().length === 0) {
        throw new Error('URL cannot be empty. Provide a valid URL like "withcortex.com" or "https://example.com"');
      }
      
      // Normalize URL - add https:// if no protocol
      let normalizedUrl = url.trim();
      if (!normalizedUrl.match(/^https?:\/\//i)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      
      // Call navigate_page directly - the bridge handles MCP or direct fallback
      if (type === 'url') {
        const result = await callBrowserTool('navigate_page', { type: 'url', url: normalizedUrl });
        return { success: true, url: normalizedUrl, message: `Navigated to ${normalizedUrl}`, result };
      } else {
        const result = await callBrowserTool('navigate_page', { type });
        return { success: true, action: type, result };
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      throw new Error(`Navigation failed: ${errorMessage}`);
    }
  },
});

/**
 * Click on an element in the browser
 */
export const browserClickTool = tool({
  description:
    "Click on an element in the browser. Use this to interact with buttons, links, or other clickable elements. " +
    "CRITICAL: You MUST first call browser_snapshot to get the uid of the element you want to click. " +
    "The uid looks like '1_11' or '2_5' and is shown in the snapshot output. " +
    "Example: browser_snapshot() → find 'uid=1_11 link' → browser_click({\"uid\": \"1_11\"})",
  inputSchema: z.object({
    uid: z.string({
      required_error: "uid is REQUIRED - you must get it from browser_snapshot first",
      invalid_type_error: "uid must be a string like '1_11' from the snapshot",
    }).min(1, "uid cannot be empty").describe("REQUIRED: The uid of the element to click (e.g., '1_11'). Get this from browser_snapshot output."),
    dblClick: z.boolean().optional().default(false).describe("Double click instead of single click"),
  }).strict(),
  execute: async (input) => {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input: expected object with "uid" property');
    }
    const { uid, dblClick = false } = input as { uid?: string; dblClick?: boolean };
    if (!uid || typeof uid !== 'string') {
      throw new Error('uid is REQUIRED and must be a string. Get it from browser_snapshot first.');
    }
    return await callBrowserTool('click', { uid, dblClick });
  },
});

/**
 * Fill a form field in the browser
 */
export const browserFillTool = tool({
  description:
    "Fill in a text input or textarea in the browser. Use this to enter text into search boxes, forms, etc.",
  inputSchema: z.object({
    uid: z.string().describe("The uid of the input element (from page snapshot)"),
    value: z.string().describe("The text to fill in"),
  }),
  execute: async ({ uid, value }) => {
    return await callBrowserTool('fill', { uid, value });
  },
});

/**
 * Take a screenshot of the current page
 */
export const browserScreenshotTool = tool({
  description:
    "Take a screenshot of the current browser page. Use this to see what's currently displayed.",
  inputSchema: z.object({}).optional(),
  execute: async (input) => {
    const result = await callBrowserTool('take_screenshot', {});
    // Normalize to a data URL for easy rendering in chat
    try {
      if (result?.content && Array.isArray(result.content)) {
        const imageBlock = result.content.find((block: any) => block?.type === 'image' && block?.data);
        if (imageBlock?.data) {
          return {
            ...result,
            imageDataUrl: `data:image/png;base64,${imageBlock.data}`,
          };
        }
      }
      if (typeof result?.screenshot === 'string') {
        const alreadyDataUrl = result.screenshot.startsWith('data:image');
        return {
          ...result,
          imageDataUrl: alreadyDataUrl ? result.screenshot : `data:image/png;base64,${result.screenshot}`,
        };
      }
    } catch {
      // Fall through to raw result
    }
    return result;
  },
});

/**
 * Get a snapshot of the page DOM
 */
export const browserSnapshotTool = tool({
  description:
    "Get a text snapshot of the current page showing all interactive elements. Use this to understand what's on the page before clicking or filling.",
  inputSchema: z.object({
    verbose: z.boolean().optional().default(false).describe("Include detailed information"),
  }),
  execute: async ({ verbose }) => {
    return await callBrowserTool('take_snapshot', { verbose });
  },
});

/**
 * List network requests
 */
export const browserNetworkTool = tool({
  description:
    "List all network requests made by the current page. Use this to see API calls, resource loads, etc.",
  inputSchema: z.object({}),
  execute: async () => {
    return await callBrowserTool('list_network_requests', {});
  },
});

/**
 * Evaluate JavaScript in the browser
 */
export const browserEvaluateTool = tool({
  description:
    "Execute JavaScript code in the browser context. Use this to extract data, interact with page elements, or run custom code.",
  inputSchema: z.object({
    function: z.string().describe("JavaScript function to execute (e.g., '() => document.title')"),
    args: z.array(z.any()).optional().describe("Arguments to pass to the function"),
  }),
  execute: async ({ function: func, args }) => {
    return await callBrowserTool('evaluate_script', { function: func, args: args || [] });
  },
});

/**
 * Wait for text to appear on the page
 */
export const browserWaitTool = tool({
  description:
    "Wait for specific text to appear on the page. Use this after navigation or actions that load content asynchronously.",
  inputSchema: z.object({
    text: z.string().describe("The text to wait for"),
    timeout: z.number().optional().describe("Maximum wait time in milliseconds"),
  }),
  execute: async ({ text, timeout }) => {
    return await callBrowserTool('wait_for', { text, timeout });
  },
});

/**
 * List all open browser pages/tabs
 */
export const browserListPagesTool = tool({
  description:
    "List all open browser pages/tabs. Use this to see what pages are currently open.",
  inputSchema: z.object({}),
  execute: async () => {
    return await callBrowserTool('list_pages', {});
  },
});

/**
 * Select a specific browser page/tab
 */
export const browserSelectPageTool = tool({
  description:
    "Switch to a different browser tab/page. Use this when you need to work with a specific tab.",
  inputSchema: z.object({
    pageId: z.number().describe("The page ID to switch to (from list_pages)"),
  }),
  execute: async ({ pageId }) => {
    return await callBrowserTool('select_page', { pageId });
  },
});

// Export all browser tools
export const browserTools = {
  browser_navigate: browserNavigateTool,
  browser_click: browserClickTool,
  browser_fill: browserFillTool,
  browser_screenshot: browserScreenshotTool,
  browser_snapshot: browserSnapshotTool,
  browser_network: browserNetworkTool,
  browser_evaluate: browserEvaluateTool,
  browser_wait: browserWaitTool,
  browser_list_pages: browserListPagesTool,
  browser_select_page: browserSelectPageTool,
};

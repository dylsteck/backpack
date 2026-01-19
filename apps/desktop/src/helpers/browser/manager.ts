import { WebContentsView, BrowserWindow } from "electron";
import { saveBrowserSession, loadBrowserSession, BrowserSessionTab } from "./session-manager";
import safeConsole from "../safe-console";

export interface BrowserTab {
  id: string;
  view: WebContentsView;
  url: string;
  title: string;
  favicon?: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export class BrowserManager {
  private tabs: Map<string, BrowserTab> = new Map();
  private activeTabId: string | null = null;
  private window: BrowserWindow;
  private bounds = { x: 0, y: 0, width: 0, height: 0 };
  private saveTimeout: NodeJS.Timeout | null = null;
  
  constructor(window: BrowserWindow) {
    this.window = window;
    this.updateBounds();
    
    // Update bounds when window resizes
    window.on('resize', () => this.updateBounds());
    
    // Load saved session
    this.loadSession();
    
    // Save session periodically and on app close
    this.setupAutoSave();
  }
  
  /**
   * Load saved browser session
   */
  private loadSession(): void {
    // Delay loading to ensure database is ready
    setTimeout(() => {
      try {
        const session = loadBrowserSession();
        if (!session || !session.tabs || session.tabs.length === 0) {
          // No saved session, create default tab
          const tabId = this.createTab('https://www.google.com');
          // CRITICAL: Hide tabs immediately after creation if not on browser route
          // We can't check route here, so hide by default - they'll be shown when navigating to browser route
          this.hideAllTabs();
          return;
        }

        // Restore tabs from session
        const restoredTabIds: string[] = [];
        for (const tabData of session.tabs) {
          try {
            const id = this.createTabFromSession(tabData);
            restoredTabIds.push(id);
            if (session.activeTabId === tabData.id) {
              this.activeTabId = id;
            }
          } catch (error) {
            // Silently ignore restore errors to prevent EIO
          }
        }
        
        // Switch to active tab (but don't show it yet)
        if (this.activeTabId && this.tabs.has(this.activeTabId)) {
          // Set active tab but don't show it - it will be shown when navigating to browser route
          // Don't call switchTab here as it might show the tab
        } else if (restoredTabIds.length > 0) {
          // Fallback to first restored tab
          this.activeTabId = restoredTabIds[0];
        } else {
          // No tabs restored, create default
          const tabId = this.createTab('https://www.google.com');
          this.activeTabId = tabId;
        }
        
        // CRITICAL: Hide all tabs after loading session
        // They will be shown when user navigates to browser route
        this.hideAllTabs();
      } catch (error) {
        // Fallback to default tab
        if (this.tabs.size === 0) {
          const tabId = this.createTab('https://www.google.com');
          this.activeTabId = tabId;
        }
        // Hide tabs even on error
        this.hideAllTabs();
      }
    }, 500); // Wait 500ms for database to be ready
  }
  
  /**
   * Create tab from saved session data
   */
  private createTabFromSession(tabData: BrowserSessionTab): string {
    const id = tabData.id; // Use saved ID to maintain consistency
    
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: 'persist:browser',
        webSecurity: true,
        allowRunningInsecureContent: false,
      }
    });
    
    const tab: BrowserTab = {
      id,
      view,
      url: tabData.url,
      title: tabData.title || 'New Tab',
      favicon: tabData.favicon,
      loading: true,
      canGoBack: false,
      canGoForward: false
    };
    
    // Setup event listeners
    this.setupViewListeners(tab);
    
    // Add to map
    this.tabs.set(id, tab);
    
    // Add to map first (before loading)
    this.tabs.set(id, tab);
    
    // Load URL
    view.webContents.loadURL(tabData.url);
    
    return id;
  }
  
  /**
   * Setup auto-save for browser sessions
   */
  private setupAutoSave(): void {
    // Save on window close
    this.window.on('close', () => {
      this.saveSessionImmediate();
    });
    
    // Save periodically (every 60 seconds instead of 30)
    setInterval(() => {
      this.saveSessionImmediate();
    }, 60000);
  }
  
  /**
   * Save current browser session (debounced - won't save more than once per 5 seconds)
   */
  private saveSession(): void {
    // The saveBrowserSession function now handles debouncing internally
    const tabs: BrowserSessionTab[] = Array.from(this.tabs.values()).map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favicon: tab.favicon,
    }));
    
    saveBrowserSession(tabs, this.activeTabId);
  }
  
  /**
   * Save session immediately (bypass debounce) - for critical moments like window close
   */
  private saveSessionImmediate(): void {
    const tabs: BrowserSessionTab[] = Array.from(this.tabs.values()).map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favicon: tab.favicon,
    }));
    
    saveBrowserSession(tabs, this.activeTabId);
  }
  
  private updateBounds(): void {
    const { width, height } = this.window.getContentBounds();
    // Account for sidebar (256px when expanded, 0 when collapsed) and topbar (44px)
    // We'll use a default sidebar width - actual positioning handled by renderer
    const sidebarWidth = 256; // Default sidebar width
    this.bounds = {
      x: sidebarWidth,
      y: 44,
      width: width - sidebarWidth,
      height: height - 44,
    };
    
    // Update active tab bounds
    if (this.activeTabId) {
      const tab = this.tabs.get(this.activeTabId);
      if (tab) {
        tab.view.setBounds(this.bounds);
      }
    }
  }
  
  /**
   * Update bounds manually (called from renderer when layout changes)
   */
  updateBoundsManually(bounds: { x: number; y: number; width: number; height: number }): void {
    // Validate bounds
    if (bounds.width <= 0 || bounds.height <= 0 || bounds.x < 0 || bounds.y < 0) {
      console.warn('[BrowserManager] Invalid bounds:', bounds);
      return;
    }
    
    const windowBounds = this.window.getContentBounds();
    
    // CRITICAL: Strictly clamp bounds to window - be VERY aggressive
    // Never allow bounds to extend beyond window width
    let clampedBounds = {
      x: Math.max(0, bounds.x),
      y: Math.max(44, bounds.y), // At least below topbar
      width: Math.min(bounds.width, windowBounds.width - bounds.x - 2), // 2px safety margin
      height: Math.min(bounds.height, windowBounds.height - bounds.y),
    };
    
    // CRITICAL: Ensure bounds don't exceed window boundaries - multiple checks
    const rightEdge = clampedBounds.x + clampedBounds.width;
    if (rightEdge > windowBounds.width - 2) {
      clampedBounds.width = Math.max(100, windowBounds.width - clampedBounds.x - 2);
    }
    
    if (clampedBounds.y + clampedBounds.height > windowBounds.height) {
      clampedBounds.height = Math.max(100, windowBounds.height - clampedBounds.y);
    }
    
    // Final validation
    if (clampedBounds.width < 100 || clampedBounds.height < 100) {
      safeConsole.warn('[BrowserManager] Clamped bounds too small:', { original: bounds, clamped: clampedBounds, windowBounds });
      return;
    }
    
    // CRITICAL: Final check - ensure right edge never exceeds window
    const finalRightEdge = clampedBounds.x + clampedBounds.width;
    if (finalRightEdge > windowBounds.width - 1) {
      console.error('[BrowserManager] ERROR: Bounds would exceed window width!', {
        bounds: clampedBounds,
        windowWidth: windowBounds.width,
        wouldExceed: finalRightEdge - windowBounds.width,
      });
      // Force fix - ensure at least 2px margin from window edge
      clampedBounds.width = Math.max(100, windowBounds.width - clampedBounds.x - 2);
    }
    
    this.bounds = clampedBounds;
    
    if (this.activeTabId) {
      const tab = this.tabs.get(this.activeTabId);
      if (tab) {
        try {
          // CRITICAL: Final check before setting bounds
          const finalBounds = {
            x: Math.max(0, clampedBounds.x),
            y: Math.max(44, clampedBounds.y),
            width: Math.min(clampedBounds.width, windowBounds.width - clampedBounds.x),
            height: Math.min(clampedBounds.height, windowBounds.height - clampedBounds.y),
          };
          
          // Ensure final bounds don't exceed window
          if (finalBounds.x + finalBounds.width > windowBounds.width) {
            finalBounds.width = windowBounds.width - finalBounds.x;
          }
          
          tab.view.setBounds(finalBounds);
        } catch (error) {
          safeConsole.error('[BrowserManager] Failed to set bounds:', error);
        }
      }
    }
  }
  
  /**
   * Create a new browser tab
   */
  createTab(url: string = 'https://www.google.com'): string {
    const id = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: 'persist:browser',
        webSecurity: true,
        allowRunningInsecureContent: false,
      }
    });
    
    const tab: BrowserTab = {
      id,
      view,
      url,
      title: 'New Tab',
      loading: true,
      canGoBack: false,
      canGoForward: false
    };
    
    // Setup event listeners
    this.setupViewListeners(tab);
    
    // Add to map
    this.tabs.set(id, tab);
    
    // Load URL
    view.webContents.loadURL(url);
    
    // Switch to new tab (but don't show it if not on browser route)
    // The tab will be shown when navigating to browser route
    this.activeTabId = id;
    
    // Save session after creating tab
    this.saveSession();
    
    // Notify MCP that a browser tab is now available
    // This allows MCP to connect to CDP if it wasn't able to before
    this.emit('tab-created', id);
    
    // CRITICAL: Don't automatically show the tab - it will be shown when navigating to browser route
    // Only show if we're currently on the browser route (check via IPC or assume hidden)
    
    return id;
  }
  
  /**
   * Switch to a different tab
   */
  switchTab(id: string): void {
    const tab = this.tabs.get(id);
    if (!tab) return;
    
    // Hide current tab
    if (this.activeTabId) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        try {
          this.window.contentView.removeChildView(currentTab.view);
        } catch (error) {
          // View might not be attached
          console.warn('[BrowserManager] Failed to remove view:', error);
        }
      }
    }
    
    // Show new tab
    try {
      // Check if view is already attached
      const isAttached = this.window.contentView.children.some(
        (child: any) => child === tab.view
      );
      
      if (!isAttached) {
        this.window.contentView.addChildView(tab.view);
      }
      
      // Ensure bounds are valid
      if (this.bounds.width > 0 && this.bounds.height > 0) {
        tab.view.setBounds(this.bounds);
      }
    } catch (error) {
      safeConsole.error('[BrowserManager] Failed to add view:', error);
    }
    
    this.activeTabId = id;
    this.emit('tab-switched', id);
    
    // Save session after switching tabs
    this.saveSession();
  }
  
  /**
   * Close a tab
   */
  async closeTab(id: string): Promise<void> {
    const tab = this.tabs.get(id);
    if (!tab) return;
    
    // Remove view
    if (this.activeTabId === id) {
      try {
        this.window.contentView.removeChildView(tab.view);
      } catch (error) {
        console.warn('[BrowserManager] Failed to remove view on close:', error);
      }
      
      // Switch to another tab
      const otherTabs = Array.from(this.tabs.keys()).filter(t => t !== id);
      if (otherTabs.length > 0) {
        this.switchTab(otherTabs[0]);
      } else {
        this.activeTabId = null;
      }
    }
    
    // Cleanup
    try {
      tab.view.webContents.destroy();
    } catch (error) {
      safeConsole.warn('[BrowserManager] Failed to destroy webContents:', error);
    }
    this.tabs.delete(id);
    this.emit('tab-closed', id);
    
    // Save session after closing tab
    this.saveSession();
  }
  
  /**
   * Hide all tabs (when switching away from browser route)
   */
  hideAllTabs(): void {
    for (const tab of this.tabs.values()) {
      try {
        const isAttached = this.window.contentView.children.some(
          (child: any) => child === tab.view
        );
        if (isAttached) {
          this.window.contentView.removeChildView(tab.view);
        }
      } catch (error) {
        // View might not be attached - that's fine
      }
    }
  }
  
  /**
   * Show active tab (when switching to browser route)
   */
  showActiveTab(): void {
    if (this.activeTabId) {
      const tab = this.tabs.get(this.activeTabId);
      if (tab) {
        try {
          const isAttached = this.window.contentView.children.some(
            (child: any) => child === tab.view
          );
          
          if (!isAttached) {
            this.window.contentView.addChildView(tab.view);
          }
          
          // Ensure bounds are valid before setting
          if (this.bounds.width > 100 && this.bounds.height > 100) {
            tab.view.setBounds(this.bounds);
          } else {
            // Use default bounds if not set yet
            const windowBounds = this.window.getContentBounds();
            const defaultBounds = {
              x: 256,
              y: 44,
              width: windowBounds.width - 256,
              height: windowBounds.height - 44,
            };
            tab.view.setBounds(defaultBounds);
            this.bounds = defaultBounds;
          }
        } catch (error) {
          console.error('[BrowserManager] Failed to show active tab:', error);
        }
      }
    }
  }
  
  /**
   * Get tab by ID
   */
  getTab(id: string): BrowserTab | undefined {
    return this.tabs.get(id);
  }
  
  /**
   * Get active tab
   */
  getActiveTab(): BrowserTab | null {
    return this.activeTabId ? this.tabs.get(this.activeTabId) || null : null;
  }
  
  /**
   * Get all tabs
   */
  getAllTabs(): BrowserTab[] {
    return Array.from(this.tabs.values());
  }
  
  /**
   * Navigate tab to URL
   */
  navigateTab(id: string, url: string): void {
    const tab = this.tabs.get(id);
    if (tab) {
      tab.view.webContents.loadURL(url);
    }
  }
  
  /**
   * Reload tab
   */
  reloadTab(id: string): void {
    const tab = this.tabs.get(id);
    if (tab) {
      tab.view.webContents.reload();
    }
  }
  
  /**
   * Go back in tab history
   */
  goBack(id: string): void {
    const tab = this.tabs.get(id);
    if (tab && tab.canGoBack) {
      try {
        // Use navigationHistory API (new) if available
        if (tab.view.webContents.navigationHistory?.canGoBack()) {
          tab.view.webContents.navigationHistory.goBack();
        } else {
          // Fallback to deprecated API
          tab.view.webContents.goBack();
        }
      } catch (e) {
        // Fallback to deprecated API
        tab.view.webContents.goBack();
      }
    }
  }
  
  /**
   * Go forward in tab history
   */
  goForward(id: string): void {
    const tab = this.tabs.get(id);
    if (tab && tab.canGoForward) {
      try {
        // Use navigationHistory API (new) if available
        if (tab.view.webContents.navigationHistory?.canGoForward()) {
          tab.view.webContents.navigationHistory.goForward();
        } else {
          // Fallback to deprecated API
          tab.view.webContents.goForward();
        }
      } catch (e) {
        // Fallback to deprecated API
        tab.view.webContents.goForward();
      }
    }
  }
  
  /**
   * Take screenshot of tab
   */
  async captureScreenshot(id: string): Promise<string> {
    const tab = this.tabs.get(id);
    if (!tab) throw new Error('Tab not found');
    
    const image = await tab.view.webContents.capturePage();
    return image.toDataURL();
  }
  
  /**
   * Get CDP target ID for a tab
   */
  async getCDPTargetId(tabId: string): Promise<string | null> {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;
    
    // WebContentsView instances aren't exposed via remote debugging port
    // We need to use webContents.debugger API directly instead
    // Return the webContents ID as the "target ID" for internal use
    return `electron-${tab.view.webContents.id}`;
  }
  
  /**
   * Execute CDP command directly on a tab using webContents.debugger API
   */
  async executeCDPCommand(tabId: string, method: string, params: any = {}): Promise<any> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }
    
    const webContents = tab.view.webContents;
    
    // Attach debugger if not already attached
    if (!webContents.debugger.isAttached()) {
      webContents.debugger.attach('1.3');
    }
    
    try {
      return await new Promise((resolve, reject) => {
        webContents.debugger.sendCommand(method, params, (error: Error | null, result: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      safeConsole.error(`[BrowserManager] CDP command ${method} failed:`, error);
      throw error;
    }
  }
  
  /**
   * Setup event listeners for a tab
   */
  private setupViewListeners(tab: BrowserTab): void {
    const { view } = tab;
    
    // Intercept new window requests (links with target="_blank" or window.open())
    // This handles: target="_blank" links, window.open(), and programmatically created links
    view.webContents.setWindowOpenHandler(({ url }) => {
      // Create a new tab with the target URL
      const newTabId = this.createTab(url);
      // Switch to the new tab
      this.switchTab(newTabId);
      // Prevent default window opening
      return { action: 'deny' };
    });
    
    // Track modifier keys for Ctrl/Cmd+click detection
    let ctrlKeyPressed = false;
    let metaKeyPressed = false;
    
    // Track keyboard state via before-input-event
    view.webContents.on('before-input-event', (_event, input) => {
      ctrlKeyPressed = input.control || input.meta;
      metaKeyPressed = input.meta;
    });
    
    // Intercept navigation when modifier keys are pressed (Ctrl/Cmd+click)
    view.webContents.on('will-navigate', (event, url) => {
      // If Ctrl/Cmd was pressed, open in new tab instead
      if (ctrlKeyPressed || metaKeyPressed) {
        event.preventDefault();
        const newTabId = this.createTab(url);
        this.switchTab(newTabId);
        // Reset flags
        ctrlKeyPressed = false;
        metaKeyPressed = false;
      }
    });
    
    // Inject JavaScript to intercept middle-click and Shift+click
    // These will trigger setWindowOpenHandler by creating links with target="_blank"
    view.webContents.on('did-finish-load', () => {
      view.webContents.executeJavaScript(`
        (function() {
          // Handle middle mouse button on links
          document.addEventListener('auxclick', (e) => {
            if (e.button === 1) { // Middle mouse button
              const link = e.target.closest('a[href]');
              if (link) {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                  e.preventDefault();
                  e.stopPropagation();
                  // Create temporary link with target="_blank" to trigger setWindowOpenHandler
                  const url = new URL(href, window.location.href).href;
                  const tempLink = document.createElement('a');
                  tempLink.href = url;
                  tempLink.target = '_blank';
                  tempLink.style.display = 'none';
                  document.body.appendChild(tempLink);
                  tempLink.click();
                  document.body.removeChild(tempLink);
                  return false;
                }
              }
            }
          }, true);
          
          // Handle Shift+click
          document.addEventListener('click', (e) => {
            if (e.shiftKey) {
              const link = e.target.closest('a[href]');
              if (link) {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                  e.preventDefault();
                  e.stopPropagation();
                  // Create temporary link with target="_blank" to trigger setWindowOpenHandler
                  const url = new URL(href, window.location.href).href;
                  const tempLink = document.createElement('a');
                  tempLink.href = url;
                  tempLink.target = '_blank';
                  tempLink.style.display = 'none';
                  document.body.appendChild(tempLink);
                  tempLink.click();
                  document.body.removeChild(tempLink);
                  return false;
                }
              }
            }
          }, true);
        })();
      `).catch((error) => {
        console.error('[BrowserManager] Failed to inject link click handler:', error);
      });
    });
    
    view.webContents.on('did-start-loading', () => {
      tab.loading = true;
      this.emit('tab-loading', tab.id);
    });
    
    view.webContents.on('did-stop-loading', () => {
      tab.loading = false;
      // Use navigationHistory API (new) instead of deprecated canGoBack/canGoForward
      try {
        const history = view.webContents.navigationHistory;
        tab.canGoBack = history?.canGoBack() ?? false;
        tab.canGoForward = history?.canGoForward() ?? false;
      } catch (e) {
        // Fallback to deprecated API if navigationHistory not available
        tab.canGoBack = view.webContents.canGoBack?.() ?? false;
        tab.canGoForward = view.webContents.canGoForward?.() ?? false;
      }
      this.emit('tab-loaded', tab.id);
    });
    
    view.webContents.on('did-navigate', (_event, url) => {
      tab.url = url;
      // Use navigationHistory API (new) instead of deprecated canGoBack/canGoForward
      try {
        const history = view.webContents.navigationHistory;
        tab.canGoBack = history?.canGoBack() ?? false;
        tab.canGoForward = history?.canGoForward() ?? false;
      } catch (e) {
        // Fallback to deprecated API if navigationHistory not available
        tab.canGoBack = view.webContents.canGoBack?.() ?? false;
        tab.canGoForward = view.webContents.canGoForward?.() ?? false;
      }
      this.emit('tab-navigated', tab.id, url);
      
      // Save session after navigation
      this.saveSession();
    });
    
    view.webContents.on('did-navigate-in-page', (_event, url) => {
      tab.url = url;
      this.emit('tab-navigated', tab.id, url);
    });
    
    view.webContents.on('page-title-updated', (_event, title) => {
      tab.title = title;
      this.emit('tab-title-updated', tab.id, title);
      
      // Save session after title update
      this.saveSession();
    });
    
    view.webContents.on('page-favicon-updated', (_event, favicons) => {
      tab.favicon = favicons[0];
      this.emit('tab-favicon-updated', tab.id, favicons[0]);
      
      // Save session after favicon update
      this.saveSession();
    });
    
    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      safeConsole.error('Tab load failed:', errorDescription);
      this.emit('tab-error', tab.id, errorDescription);
    });
  }
  
  /**
   * Emit event to renderer
   */
  private emit(event: string, ...args: any[]): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('browser-event', { event, args });
    }
  }
}

/**
 * Browser Component
 * Simple browser with tabs, navigation, and light devtools
 * WebContentsView managed by main process, UI in renderer
 */

import { Component } from './Component';
import { createElement, clearChildren } from '../utils/dom';
import { store } from '../store';

interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

declare global {
  interface Window {
    browser?: {
      createTab: (url?: string) => Promise<string>;
      closeTab: (tabId: string) => Promise<void>;
      switchTab: (tabId: string) => Promise<void>;
      navigateTab: (tabId: string, url: string) => Promise<void>;
      goBack: (tabId: string) => Promise<void>;
      goForward: (tabId: string) => Promise<void>;
      reloadTab: (tabId: string) => Promise<void>;
      getAllTabs: () => Promise<BrowserTab[]>;
      getTab: (tabId: string) => Promise<BrowserTab | null>;
      captureScreenshot: (tabId: string) => Promise<string>;
      updateBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<void>;
      hideTabs: () => Promise<void>;
      showTabs: () => Promise<void>;
      on: (callback: (event: string, ...args: any[]) => void) => void;
      off: () => void;
    };
  }
}

export class Browser extends Component {
  private tabs: BrowserTab[] = [];
  private activeTabId: string | null = null;
  private tabBar: HTMLElement | null = null;
  private tabsContainer: HTMLElement | null = null;
  private controlsBar: HTMLElement | null = null;
  private urlInput: HTMLInputElement | null = null;
  private backBtn: HTMLButtonElement | null = null;
  private forwardBtn: HTMLButtonElement | null = null;
  private reloadBtn: HTMLButtonElement | null = null;
  private devtoolsPanel: HTMLElement | null = null;
  private devtoolsExpanded = false;
  
  async init(): Promise<void> {
    // Listen to browser events from main process
    if (window.browser) {
      window.browser.on((event: string, ...args: any[]) => {
        this.handleBrowserEvent(event, ...args);
      });
    }
    
    // Initial delay to let BrowserManager finish loading session (500ms) and http-bridge create tabs if needed
    // This prevents creating duplicate tabs when browser tools are called before navigating to browser route
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Update bounds when layout changes - use requestAnimationFrame for smooth updates
    const updateBounds = () => {
      requestAnimationFrame(() => {
        this.updateBrowserBounds();
      });
    };
    
    // Initial bounds update - wait a bit for sidebar to be ready if chat was transferred
    const chatSidebarOpen = store.chatSidebarOpen.get();
    if (chatSidebarOpen) {
      // If sidebar is open (likely from transfer), wait a bit longer for it to render
      setTimeout(() => {
        updateBounds();
      }, 100);
    } else {
      updateBounds();
    }
    
    // Subscribe to sidebar and chat sidebar state changes
    // Use longer delay to ensure layout has fully updated
    this.subscribe(store.sidebarCollapsed, () => {
      // Multiple updates to catch CSS transitions
      setTimeout(updateBounds, 50);
      setTimeout(updateBounds, 200);
      setTimeout(updateBounds, 400);
    });
    this.subscribe(store.chatSidebarOpen, () => {
      // CRITICAL: Update bounds immediately when chat sidebar opens/closes
      // Use multiple timeouts to catch both the initial state change and after CSS transitions
      const isOpen = store.chatSidebarOpen.get();
      console.log('[Browser] Chat sidebar state changed:', isOpen);
      
      // Immediate update
      updateBounds();
      
      // Multiple updates to catch CSS transitions (300ms transition duration)
      setTimeout(updateBounds, 0);
      setTimeout(updateBounds, 10);
      setTimeout(updateBounds, 25);
      setTimeout(updateBounds, 50);
      setTimeout(updateBounds, 100);
      setTimeout(updateBounds, 150);
      setTimeout(updateBounds, 200);
      setTimeout(updateBounds, 300); // After transition completes
      setTimeout(updateBounds, 400);
      setTimeout(updateBounds, 500);
      setTimeout(updateBounds, 700);
      setTimeout(updateBounds, 1000); // Final check
    });
    
    // Also update on window resize
    this.addListener(window, 'resize', () => {
      setTimeout(updateBounds, 100);
    });
    
    // Listen for chat sidebar state change events
    this.addListener(window, 'chat-sidebar-state-changed', ((e: CustomEvent) => {
      console.log('[Browser] Chat sidebar state change event:', e.detail);
      updateBounds();
      setTimeout(updateBounds, 10);
      setTimeout(updateBounds, 50);
      setTimeout(updateBounds, 100);
      setTimeout(updateBounds, 200);
      setTimeout(updateBounds, 300);
    }) as EventListener);
    
    // Watch for both sidebar width changes using ResizeObserver
    const leftSidebar = document.querySelector('[data-sidebar="true"]') as HTMLElement;
    const chatSidebar = document.querySelector('.chat-sidebar-container') as HTMLElement;
    
    if (window.ResizeObserver) {
      // Observe left sidebar
      if (leftSidebar) {
        const leftObserver = new ResizeObserver(() => {
          updateBounds();
        });
        leftObserver.observe(leftSidebar);
        this.registerCleanup(() => leftObserver.disconnect());
      }
      
      // Observe chat sidebar - CRITICAL for preventing overlap
      if (chatSidebar) {
        const chatObserver = new ResizeObserver((entries) => {
          // Immediate update when chat sidebar resizes
          for (const entry of entries) {
            const width = entry.contentRect.width;
            console.log('[Browser] Chat sidebar resized:', width);
          }
          updateBounds();
          // Also update after short delays to catch any layout changes
          setTimeout(updateBounds, 0);
          setTimeout(updateBounds, 10);
          setTimeout(updateBounds, 50);
          setTimeout(updateBounds, 100);
          setTimeout(updateBounds, 200);
        });
        chatObserver.observe(chatSidebar);
        this.registerCleanup(() => chatObserver.disconnect());
      }
      
      // Also observe the browser container itself for any layout changes
      const containerObserver = new ResizeObserver(() => {
        updateBounds();
      });
      containerObserver.observe(this.container);
      this.registerCleanup(() => containerObserver.disconnect());
    }
    
    // Periodic update to catch any layout changes
    // More frequent when chat sidebar is open to prevent overlap
    const periodicUpdate = () => {
      const chatOpen = store.chatSidebarOpen.get();
      updateBounds();
      // More frequent updates when sidebar is open
      setTimeout(periodicUpdate, chatOpen ? 200 : 1000);
    };
    setTimeout(periodicUpdate, 1000);
    
    // Load initial tabs - retry multiple times to catch tabs created by BrowserManager or http-bridge
    // BrowserManager loads session after 500ms, and http-bridge might create tabs when tools are called
    let retries = 0;
    const maxRetries = 8; // Increased retries to wait longer
    while (retries < maxRetries) {
      await this.loadTabs();
      if (this.tabs.length > 0) {
        console.log(`[Browser] Found ${this.tabs.length} existing tab(s) after ${retries} retries`);
        break; // Tabs found, no need to create new ones
      }
      // Wait progressively longer - BrowserManager loads after 500ms, so wait at least that long
      const delay = retries < 3 ? 200 : 300; // Faster initial checks, then slower
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
    
    // Only create initial tab if none exist after all retries
    // This prevents duplicate tabs when browser tools create tabs before navigation
    if (this.tabs.length === 0 && window.browser) {
      console.log('[Browser] No tabs found after all retries, creating default tab');
      const tabId = await window.browser.createTab('https://www.google.com');
      this.activeTabId = tabId;
      await this.loadTabs();
    } else if (this.tabs.length > 0) {
      // Ensure we have an active tab from existing tabs
      if (!this.activeTabId) {
        this.activeTabId = this.tabs[0].id;
        // Switch to the first tab to ensure it's active
        if (window.browser) {
          await window.browser.switchTab(this.activeTabId);
        }
      }
    }
    
    this.render();
  }
  
  private updateBrowserBounds(): void {
    if (!window.browser) return;
    
    // Calculate bounds based on actual viewport element position
    const viewport = this.container.querySelector('.browser-viewport') as HTMLElement;
    if (!viewport) return;
    
    const viewportRect = viewport.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const safetyMargin = 4;

    // Get chat sidebar position
    const chatSidebar = document.querySelector('.chat-sidebar-container') as HTMLElement;
    const chatSidebarRect = chatSidebar?.getBoundingClientRect();
    const chatSidebarIsOpen = store.chatSidebarOpen.get();

    // Calculate maximum right edge browser can extend to
    let maxRightEdge: number;
    if (chatSidebarIsOpen) {
      if (chatSidebarRect && chatSidebarRect.width > 0 && chatSidebarRect.left > 0) {
        // Chat sidebar is open - browser MUST stop before it
        maxRightEdge = Math.round(chatSidebarRect.left) - safetyMargin;
      } else {
        // Fallback: estimate chat sidebar position
        const chatWidth = chatSidebar?.offsetWidth || 320;
        maxRightEdge = windowWidth - chatWidth - safetyMargin;
      }
    } else {
      // Chat sidebar closed - browser can use full width
      maxRightEdge = windowWidth - safetyMargin;
    }

    // Use viewport's actual position for X and Y
    // But calculate width from available space (viewport left to maxRightEdge)
    const viewportLeft = Math.max(0, Math.round(viewportRect.left));
    const availableWidth = Math.max(100, maxRightEdge - viewportLeft);

    const bounds = {
      x: viewportLeft,
      y: Math.max(44, Math.round(viewportRect.top)),
      width: Math.max(100, Math.round(availableWidth)),
      height: Math.max(100, Math.round(viewportRect.height)),
    };

    // Ensure bounds don't exceed window
    if (bounds.x + bounds.width > windowWidth - safetyMargin) {
      bounds.width = Math.max(100, windowWidth - bounds.x - safetyMargin);
    }

    if (bounds.y + bounds.height > windowHeight) {
      bounds.height = Math.max(100, windowHeight - bounds.y);
    }

    // Final safety check - ensure browser NEVER extends past chat sidebar
    if (chatSidebarIsOpen && chatSidebarRect && chatSidebarRect.left > 0) {
      const finalRight = bounds.x + bounds.width;
      if (finalRight > chatSidebarRect.left - safetyMargin) {
        bounds.width = Math.max(100, Math.round(chatSidebarRect.left - bounds.x - safetyMargin));
      }
    }

    // Final validation
    if (bounds.width <= 0 || bounds.height <= 0 || bounds.x < 0 || bounds.y < 0) {
      console.warn('[Browser] Invalid bounds calculated:', bounds, {
        viewportLeft,
        maxRightEdge,
        availableWidth,
        chatSidebarIsOpen,
        chatSidebarLeft: chatSidebarRect?.left,
        windowWidth,
      });
      return;
    }

    window.browser.updateBounds(bounds);
  }
  
  render(): void {
    this.container.innerHTML = '';
    this.container.className = 'browser-container';
    this.container.style.cssText = `
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      background: rgba(10, 10, 15, 0.98);
      overflow: hidden;
      position: relative;
      z-index: 1;
      box-sizing: border-box;
      flex-shrink: 1;
      contain: layout style paint;
      isolation: isolate;
      clip-path: inset(0);
      overflow-x: hidden;
      overflow-y: hidden;
    `;
    
    // Tab bar
    this.renderTabBar();
    
    // Controls bar
    this.renderControlsBar();
    
    // Browser viewport placeholder
    this.renderViewport();
    
    // DevTools panel
    this.renderDevTools();
  }
  
  private renderTabBar(): void {
    this.tabBar = createElement('div', {
      className: 'browser-tabbar',
    });
    this.tabBar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 6px 12px;
      background: rgba(18, 18, 26, 0.95);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      -webkit-app-region: drag;
      flex-shrink: 0;
    `;
    
    this.tabsContainer = createElement('div', {
      className: 'browser-tabs-container',
    });
    this.tabsContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 2px;
      flex: 1;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-app-region: no-drag;
    `;
    
    // Render tabs
    this.renderTabs();
    
    // New tab button
    const newTabBtn = createElement('button', {
      className: 'browser-new-tab-btn',
      attributes: {
        'aria-label': 'New tab',
      },
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14"/><path d="M12 5v14"/>
        </svg>
      `,
    });
    newTabBtn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: var(--cc-text-secondary, #cbd5e1);
      cursor: pointer;
      transition: all 0.15s ease;
      flex-shrink: 0;
      -webkit-app-region: no-drag;
    `;
    this.addListener(newTabBtn, 'click', () => this.createNewTab());
    this.addListener(newTabBtn, 'mouseenter', () => {
      newTabBtn.style.background = 'rgba(255, 255, 255, 0.06)';
      newTabBtn.style.color = 'var(--cc-text-primary, #f8fafc)';
    });
    this.addListener(newTabBtn, 'mouseleave', () => {
      newTabBtn.style.background = 'transparent';
      newTabBtn.style.color = 'var(--cc-text-secondary, #cbd5e1)';
    });
    
    this.tabBar.appendChild(this.tabsContainer);
    this.tabBar.appendChild(newTabBtn);
    this.container.appendChild(this.tabBar);
  }
  
  private renderTabs(): void {
    if (!this.tabsContainer) return;
    clearChildren(this.tabsContainer);
    
    for (const tab of this.tabs) {
      const tabEl = this.createTabElement(tab);
      this.tabsContainer.appendChild(tabEl);
    }
  }
  
  private createTabElement(tab: BrowserTab): HTMLElement {
    const isActive = tab.id === this.activeTabId;
    
    const tabEl = createElement('button', {
      className: 'browser-tab',
      attributes: {
        role: 'tab',
        'aria-selected': isActive ? 'true' : 'false',
        'aria-controls': `tabpanel-${tab.id}`,
        tabindex: isActive ? '0' : '-1',
      },
    });
    
    tabEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      max-width: 180px;
      min-width: 80px;
      background: ${isActive ? 'rgba(255, 255, 255, 0.06)' : 'transparent'};
      border: 1px solid ${isActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent'};
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      -webkit-app-region: no-drag;
      box-shadow: ${isActive ? '0 0 12px rgba(99, 102, 241, 0.1)' : 'none'};
    `;
    
    // Favicon or loading indicator
    if (tab.loading) {
      const loadingIcon = createElement('div', {
        className: 'browser-tab-loading',
      });
      loadingIcon.style.cssText = `
        width: 16px;
        height: 16px;
        border: 2px solid rgba(99, 102, 241, 0.3);
        border-top-color: rgba(99, 102, 241, 0.9);
        border-radius: 50%;
        animation: browser-tab-spin 0.6s linear infinite;
        flex-shrink: 0;
      `;
      tabEl.appendChild(loadingIcon);
    } else if (tab.favicon) {
      const faviconEl = createElement('img', {
        attributes: {
          src: tab.favicon,
          alt: '',
        },
      });
      faviconEl.style.cssText = `
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      `;
      tabEl.appendChild(faviconEl);
    }
    
    // Tab title
    const titleEl = createElement('span', {
      className: 'browser-tab-title',
      textContent: tab.title || 'New Tab',
    });
    titleEl.style.cssText = `
      font-family: var(--cc-font-body, 'Archivo', sans-serif);
      font-size: 12px;
      color: var(--cc-text-secondary, #cbd5e1);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      text-align: left;
    `;
    tabEl.appendChild(titleEl);
    
    // Close button
    const closeBtn = createElement('button', {
      className: 'browser-tab-close',
      attributes: {
        'aria-label': 'Close tab',
      },
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      `,
    });
    closeBtn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: 4px;
      color: var(--cc-text-muted, #64748b);
      cursor: pointer;
      opacity: 0;
      transition: all 0.15s ease;
      flex-shrink: 0;
    `;
    this.addListener(closeBtn, 'click', (e) => {
      e.stopPropagation();
      this.closeTab(tab.id);
    });
    this.addListener(closeBtn, 'mouseenter', () => {
      closeBtn.style.background = 'rgba(239, 68, 68, 0.2)';
      closeBtn.style.color = '#ef4444';
    });
    this.addListener(closeBtn, 'mouseleave', () => {
      closeBtn.style.background = 'transparent';
      closeBtn.style.color = 'var(--cc-text-muted, #64748b)';
    });
    tabEl.appendChild(closeBtn);
    
    // Hover effects
    this.addListener(tabEl, 'mouseenter', () => {
      if (!isActive) {
        tabEl.style.background = 'rgba(255, 255, 255, 0.04)';
      }
      closeBtn.style.opacity = '1';
    });
    this.addListener(tabEl, 'mouseleave', () => {
      if (!isActive) {
        tabEl.style.background = 'transparent';
      }
      closeBtn.style.opacity = '0';
    });
    
    // Click to switch tab
    this.addListener(tabEl, 'click', (e) => {
      if (e.target !== closeBtn) {
        this.switchTab(tab.id);
      }
    });
    
    // Keyboard navigation
    this.addListener(tabEl, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.switchTab(tab.id);
      }
    });
    
    // Focus visible
    this.addListener(tabEl, 'focus', () => {
      tabEl.style.outline = 'none';
      tabEl.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.5)';
    });
    this.addListener(tabEl, 'blur', () => {
      if (!isActive) {
        tabEl.style.boxShadow = 'none';
      }
    });
    
    return tabEl;
  }
  
  private renderControlsBar(): void {
    this.controlsBar = createElement('div', {
      className: 'browser-controls',
    });
    this.controlsBar.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: rgba(18, 18, 26, 0.95);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      flex-shrink: 0;
    `;
    
    // Back button
    this.backBtn = createElement('button', {
      className: 'browser-nav-btn',
      attributes: {
        'aria-label': 'Go back',
      },
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      `,
    }) as HTMLButtonElement;
    this.styleNavButton(this.backBtn);
    this.addListener(this.backBtn, 'click', () => {
      if (this.activeTabId) this.goBack();
    });
    
    // Forward button
    this.forwardBtn = createElement('button', {
      className: 'browser-nav-btn',
      attributes: {
        'aria-label': 'Go forward',
      },
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      `,
    }) as HTMLButtonElement;
    this.styleNavButton(this.forwardBtn);
    this.addListener(this.forwardBtn, 'click', () => {
      if (this.activeTabId) this.goForward();
    });
    
    // Reload button
    this.reloadBtn = createElement('button', {
      className: 'browser-nav-btn',
      attributes: {
        'aria-label': 'Reload',
      },
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>
        </svg>
      `,
    }) as HTMLButtonElement;
    this.styleNavButton(this.reloadBtn);
    this.addListener(this.reloadBtn, 'click', () => {
      if (this.activeTabId) this.reload();
    });
    
    // URL input
    this.urlInput = createElement('input', {
      className: 'browser-url-input',
      attributes: {
        type: 'text',
        'aria-label': 'URL address bar',
        placeholder: 'Search or enter URL...',
        spellcheck: 'false',
        autocomplete: 'off',
      },
    }) as HTMLInputElement;
    this.urlInput.style.cssText = `
      flex: 1;
      height: 32px;
      padding: 0 12px;
      font-family: var(--cc-font-mono, 'JetBrains Mono', monospace);
      font-size: 13px;
      letter-spacing: -0.01em;
      color: var(--cc-text-primary, #f8fafc);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid transparent;
      border-radius: 8px;
      outline: none;
      transition: all 0.2s ease;
    `;
    this.addListener(this.urlInput, 'focus', () => {
      this.urlInput!.style.background = 'rgba(99, 102, 241, 0.15)';
      this.urlInput!.style.borderColor = 'rgba(99, 102, 241, 0.3)';
      this.urlInput!.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
    });
    this.addListener(this.urlInput, 'blur', () => {
      this.urlInput!.style.background = 'rgba(255, 255, 255, 0.04)';
      this.urlInput!.style.borderColor = 'transparent';
      this.urlInput!.style.boxShadow = 'none';
    });
    this.addListener(this.urlInput, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.navigate();
      }
    });
    
    // Settings button (placeholder)
    const settingsBtn = createElement('button', {
      className: 'browser-nav-btn',
      attributes: {
        'aria-label': 'Browser settings',
      },
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
        </svg>
      `,
    });
    this.styleNavButton(settingsBtn);
    
    this.controlsBar.appendChild(this.backBtn);
    this.controlsBar.appendChild(this.forwardBtn);
    this.controlsBar.appendChild(this.reloadBtn);
    this.controlsBar.appendChild(this.urlInput);
    this.controlsBar.appendChild(settingsBtn);
    this.container.appendChild(this.controlsBar);
  }
  
  private styleNavButton(btn: HTMLButtonElement): void {
    btn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: var(--cc-text-secondary, #cbd5e1);
      cursor: pointer;
      transition: all 0.15s ease;
    `;
    this.addListener(btn, 'mouseenter', () => {
      if (!btn.disabled) {
        btn.style.background = 'rgba(255, 255, 255, 0.06)';
        btn.style.color = 'var(--cc-text-primary, #f8fafc)';
      }
    });
    this.addListener(btn, 'mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--cc-text-secondary, #cbd5e1)';
    });
    this.addListener(btn, 'focus', () => {
      btn.style.outline = 'none';
      btn.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.5)';
    });
    this.addListener(btn, 'blur', () => {
      btn.style.boxShadow = 'none';
    });
  }
  
  private renderViewport(): void {
    const viewport = createElement('div', {
      className: 'browser-viewport',
    });
    viewport.style.cssText = `
      flex: 1;
      position: relative;
      background: #0a0a0f;
      contain: layout style paint;
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
      min-height: 0;
      overflow: hidden;
      overflow-x: hidden;
      overflow-y: hidden;
      clip-path: inset(0);
      isolation: isolate;
    `;
    
    // Note: WebContentsView is managed by main process and overlays this div
    // This div provides the layout space for the WebContentsView
    
    this.container.appendChild(viewport);
    
    // Update bounds after viewport is rendered and layout is stable
    // Use multiple timeouts to catch layout changes
    setTimeout(() => {
      requestAnimationFrame(() => {
        this.updateBrowserBounds();
      });
    }, 100);
    
    setTimeout(() => {
      requestAnimationFrame(() => {
        this.updateBrowserBounds();
      });
    }, 300);
  }
  
  private renderDevTools(): void {
    this.devtoolsPanel = createElement('div', {
      className: 'browser-devtools',
    });
    this.devtoolsPanel.style.cssText = `
      background: rgba(0, 0, 0, 0.3);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      overflow: hidden;
      transition: max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      max-height: 28px;
      flex-shrink: 0;
    `;
    
    const header = createElement('div', {
      className: 'browser-devtools-header',
    });
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 4px 12px;
      font-family: var(--cc-font-mono, 'JetBrains Mono', monospace);
      font-size: 11px;
      color: var(--cc-text-muted, #64748b);
    `;
    
    const toggleBtn = createElement('button', {
      className: 'browser-devtools-toggle',
      attributes: {
        'aria-label': 'Toggle devtools',
        'aria-expanded': 'false',
      },
      innerHTML: `
        <span>▾ Network (0)</span>
        <span>▾ Console (0)</span>
        <span style="margin-left: auto;">[Collapse ▴]</span>
      `,
    });
    toggleBtn.style.cssText = `
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 2px 8px;
      background: transparent;
      border: none;
      border-radius: 4px;
      color: var(--cc-text-muted, #64748b);
      cursor: pointer;
      transition: all 0.15s ease;
      width: 100%;
      text-align: left;
    `;
    this.addListener(toggleBtn, 'click', () => {
      this.devtoolsExpanded = !this.devtoolsExpanded;
      toggleBtn.setAttribute('aria-expanded', String(this.devtoolsExpanded));
      if (this.devtoolsExpanded) {
        this.devtoolsPanel!.style.maxHeight = '200px';
        toggleBtn.innerHTML = `
          <span>▾ Network (0)</span>
          <span>▾ Console (0)</span>
          <span style="margin-left: auto;">[Expand ▾]</span>
        `;
      } else {
        this.devtoolsPanel!.style.maxHeight = '28px';
        toggleBtn.innerHTML = `
          <span>▾ Network (0)</span>
          <span>▾ Console (0)</span>
          <span style="margin-left: auto;">[Collapse ▴]</span>
        `;
      }
    });
    this.addListener(toggleBtn, 'mouseenter', () => {
      toggleBtn.style.background = 'rgba(255, 255, 255, 0.05)';
      toggleBtn.style.color = 'var(--cc-text-secondary, #cbd5e1)';
    });
    this.addListener(toggleBtn, 'mouseleave', () => {
      toggleBtn.style.background = 'transparent';
      toggleBtn.style.color = 'var(--cc-text-muted, #64748b)';
    });
    
    header.appendChild(toggleBtn);
    this.devtoolsPanel.appendChild(header);
    this.container.appendChild(this.devtoolsPanel);
  }
  
  private async loadTabs(): Promise<void> {
    if (!window.browser) return;
    
    try {
      this.tabs = await window.browser.getAllTabs();
      if (this.tabs.length > 0 && !this.activeTabId) {
        this.activeTabId = this.tabs[0].id;
      }
      this.updateControls();
    } catch (error) {
      console.error('[Browser] Failed to load tabs:', error);
    }
  }
  
  private async createNewTab(url?: string): Promise<void> {
    if (!window.browser) return;
    
    try {
      const tabId = await window.browser.createTab(url || 'https://www.google.com');
      this.activeTabId = tabId;
      await this.loadTabs();
      this.renderTabs();
      this.updateControls();
    } catch (error) {
      console.error('[Browser] Failed to create tab:', error);
    }
  }
  
  private async switchTab(tabId: string): Promise<void> {
    if (!window.browser) return;
    
    try {
      await window.browser.switchTab(tabId);
      this.activeTabId = tabId;
      await this.loadTabs();
      this.renderTabs();
      this.updateControls();
    } catch (error) {
      console.error('[Browser] Failed to switch tab:', error);
    }
  }
  
  private async closeTab(tabId: string): Promise<void> {
    if (!window.browser) return;
    
    try {
      await window.browser.closeTab(tabId);
      
      // Switch to another tab if we closed the active one
      if (tabId === this.activeTabId) {
        const remainingTabs = this.tabs.filter(t => t.id !== tabId);
        if (remainingTabs.length > 0) {
          this.activeTabId = remainingTabs[0].id;
          await window.browser.switchTab(this.activeTabId);
        } else {
          this.activeTabId = null;
        }
      }
      
      await this.loadTabs();
      this.renderTabs();
      this.updateControls();
    } catch (error) {
      console.error('[Browser] Failed to close tab:', error);
    }
  }
  
  private async navigate(): Promise<void> {
    if (!this.urlInput || !this.activeTabId || !window.browser) return;
    
    let url = this.urlInput.value.trim();
    if (!url) return;
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      // Check if it looks like a domain
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        // Treat as search query
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }
    
    try {
      await window.browser.navigateTab(this.activeTabId, url);
    } catch (error) {
      console.error('[Browser] Failed to navigate:', error);
    }
  }
  
  private async goBack(): Promise<void> {
    if (!this.activeTabId || !window.browser) return;
    try {
      await window.browser.goBack(this.activeTabId);
    } catch (error) {
      console.error('[Browser] Failed to go back:', error);
    }
  }
  
  private async goForward(): Promise<void> {
    if (!this.activeTabId || !window.browser) return;
    try {
      await window.browser.goForward(this.activeTabId);
    } catch (error) {
      console.error('[Browser] Failed to go forward:', error);
    }
  }
  
  private async reload(): Promise<void> {
    if (!this.activeTabId || !window.browser) return;
    try {
      await window.browser.reloadTab(this.activeTabId);
    } catch (error) {
      console.error('[Browser] Failed to reload:', error);
    }
  }
  
  private updateControls(): void {
    const activeTab = this.tabs.find(t => t.id === this.activeTabId);
    
    if (activeTab) {
      if (this.urlInput) {
        this.urlInput.value = activeTab.url;
        if (activeTab.loading) {
          this.urlInput.classList.add('loading');
        } else {
          this.urlInput.classList.remove('loading');
        }
      }
      
      if (this.backBtn) {
        this.backBtn.disabled = !activeTab.canGoBack;
        this.backBtn.style.opacity = activeTab.canGoBack ? '1' : '0.3';
      }
      
      if (this.forwardBtn) {
        this.forwardBtn.disabled = !activeTab.canGoForward;
        this.forwardBtn.style.opacity = activeTab.canGoForward ? '1' : '0.3';
      }
    }
  }
  
  private handleBrowserEvent(event: string, ...args: any[]): void {
    switch (event) {
      case 'tab-navigated':
        const [tabId, url] = args;
        if (tabId === this.activeTabId && this.urlInput) {
          this.urlInput.value = url;
        }
        this.loadTabs().then(() => {
          this.renderTabs();
          this.updateControls();
        });
        break;
      
      case 'tab-loading':
        this.loadTabs().then(() => {
          this.renderTabs();
          this.updateControls();
        });
        break;
      
      case 'tab-loaded':
        this.loadTabs().then(() => {
          this.renderTabs();
          this.updateControls();
        });
        break;
      
      case 'tab-title-updated':
      case 'tab-favicon-updated':
        this.loadTabs().then(() => {
          this.renderTabs();
        });
        break;
      
      case 'tab-switched':
        const [switchedTabId] = args;
        this.activeTabId = switchedTabId;
        this.loadTabs().then(() => {
          this.renderTabs();
          this.updateControls();
        });
        break;
      
      case 'tab-closed':
        this.loadTabs().then(() => {
          this.renderTabs();
          this.updateControls();
        });
        break;
    }
  }
  
  destroy(): void {
    if (window.browser) {
      window.browser.off();
    }
    super.destroy();
  }
}

// Add CSS animation for tab loading spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes browser-tab-spin {
    to { transform: rotate(360deg); }
  }
  
  .browser-url-input.loading {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.04) 0%,
      rgba(99, 102, 241, 0.15) 50%,
      rgba(255, 255, 255, 0.04) 100%
    );
    background-size: 200% 100%;
    animation: browser-loading-shimmer 1.5s ease-in-out infinite;
  }
  
  @keyframes browser-loading-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;
document.head.appendChild(style);

export default Browser;

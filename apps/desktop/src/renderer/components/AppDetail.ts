/**
 * App Detail Component
 * Shows detailed view of a single app with tabs
 */

import { Component } from './Component';
import { store, actions } from '../store';
import { router } from '../router';
import { fetchAppsWithCache, fetchApps, getAppById, api, appsCache, fetchTimeline } from '../api';
import { createElement, clearChildren, escapeHtml, formatTime, formatDate } from '../utils/dom';
import type { AppServer, TimelineItem, SourceType, FarcasterCast, BrowserHistoryEntry, TellerTransaction } from '../types';

type TabType = 'settings' | 'data';

export class AppDetail extends Component {
  private app: AppServer | null = null;
  private currentTab: TabType = 'settings';
  private contentContainer: HTMLElement | null = null;
  
  constructor(container: HTMLElement, private appId?: string) {
    super(container);
  }
  
  async init(): Promise<void> {
    // Load apps if not already loaded
    if (store.apps.get().length === 0) {
      await fetchAppsWithCache();
    }
    
    // Find the app
    if (this.appId) {
      this.app = getAppById(this.appId) || null;
    }
    
    this.render();
    
    // Subscribe to apps changes
    this.subscribe(store.apps, () => {
      if (this.appId) {
        this.app = getAppById(this.appId) || null;
        this.render();
        // Re-setup refresh button if connection status changed
        if (this.app?.connection?.status === 'connected') {
          const refreshButton = this.container.querySelector('[data-refresh]');
          if (!refreshButton) {
            // Re-render header to add refresh button
            const header = this.container.querySelector('.border-b');
            if (header) {
              const newHeader = this.createHeader();
              header.replaceWith(newHeader);
            }
          }
        }
      }
    });
    
    // Subscribe to timeline items changes to update Data tab
    this.subscribe(store.timelineItems, () => {
      if (this.currentTab === 'data' && this.contentContainer) {
        this.renderTabContent();
      }
    });
    
    // Subscribe to expanded item changes to update Data tab
    this.subscribe(store.expandedItemId, () => {
      if (this.currentTab === 'data' && this.contentContainer) {
        this.renderTabContent();
      }
    });
    
    // Subscribe to browser history changes for chrome/brave apps
    if (this.appId === 'chrome' || this.appId === 'brave') {
      this.subscribe(store.chromeHistory, () => {
        if (this.currentTab === 'data' && this.contentContainer && this.appId === 'chrome') {
          this.renderTabContent();
        }
      });
      this.subscribe(store.braveHistory, () => {
        if (this.currentTab === 'data' && this.contentContainer && this.appId === 'brave') {
          this.renderTabContent();
        }
      });
    }
    
    // Subscribe to backfill status changes
    this.subscribe(store.backfillStatus, () => {
      if (this.currentTab === 'settings' && this.contentContainer && this.app) {
        this.renderTabContent();
      }
    });
    
    // Set up event delegation for data items (once, not on every render)
    this.setupDataItemEventDelegation();
  }
  
  render(): void {
    this.container.innerHTML = '';
    // Don't override container className - it has overflow-y-auto from Layout
    
    // Create inner wrapper for app detail content
    const wrapper = createElement('div', {
      className: 'flex flex-col w-full h-full min-h-0',
    });
    
    if (!this.app) {
      this.renderNotFound();
      return;
    }
    
    // Header
    const header = this.createHeader();
    wrapper.appendChild(header);
    
    // Content area
    const contentWrapper = createElement('div', {
      className: 'flex-1 min-h-0 overflow-y-auto',
    });
    
    const contentInner = createElement('div', {
      className: 'max-w-7xl mx-auto px-6 py-6',
    });
    
    // Tabs
    const tabs = this.createTabs();
    contentInner.appendChild(tabs);
    
    // Tab content
    this.contentContainer = createElement('div', {
      className: 'mt-6',
    });
    this.renderTabContent();
    contentInner.appendChild(this.contentContainer);
    
    contentWrapper.appendChild(contentInner);
    wrapper.appendChild(contentWrapper);
    this.container.appendChild(wrapper);
  }
  
  private renderNotFound(): void {
    this.container.innerHTML = `
      <div class="flex flex-col w-full p-4 items-center justify-center min-h-[400px]">
        <div class="text-center space-y-4">
          <h2 class="text-2xl font-mono uppercase tracking-wider">App not found</h2>
          <p class="text-muted-foreground font-mono">The app you're looking for doesn't exist.</p>
          <button class="px-4 py-2 bg-primary text-primary-foreground flex items-center gap-2 mx-auto border border-border font-mono uppercase tracking-wider text-sm" data-back>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            Back to Apps
          </button>
        </div>
      </div>
    `;
    
    const backButton = this.container.querySelector('[data-back]');
    if (backButton) {
      this.addListener(backButton as HTMLElement, 'click', () => {
        router.navigate('/apps');
      });
    }
  }
  
  private createHeader(): HTMLElement {
    const header = createElement('div', {
      className: 'border-b bg-background sticky top-0 z-20',
    });
    
    const content = createElement('div', {
      className: 'max-w-7xl mx-auto px-6 py-8 relative',
    });
    
    // Row with back button and app info
    const row = createElement('div', {
      className: 'flex items-start gap-6 mb-4',
    });
    
    // Back button
    const backButton = createElement('button', {
      className: 'shrink-0 mt-1 p-2 hover:bg-accent transition-colors',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`,
    });
    this.addListener(backButton, 'click', () => {
      router.navigate('/apps');
    });
    row.appendChild(backButton);
    
    // App info
    const infoWrapper = createElement('div', {
      className: 'flex items-start gap-6',
    });
    
    // Icon
    if (this.app?.iconUrl) {
      const iconWrapper = createElement('div', {
        className: 'h-16 w-16 bg-card p-3 flex items-center justify-center shrink-0 border border-border',
      });
      const icon = createElement('img', {
        className: 'h-full w-full object-contain',
        attributes: {
          src: this.app.iconUrl,
          alt: this.app.name,
        },
      });
      iconWrapper.appendChild(icon);
      infoWrapper.appendChild(iconWrapper);
    }
    
    // Text info
    const textInfo = createElement('div', {
      className: 'flex flex-col gap-2 pt-0.5 flex-1',
    });
    
    const titleRow = createElement('div', {
      className: 'flex items-center gap-3',
    });
    
    const title = createElement('h1', {
      className: 'text-3xl font-mono uppercase tracking-wider text-foreground',
      textContent: this.app?.name || '',
    });
    titleRow.appendChild(title);
    
    // Refresh button (only show if connected)
    if (this.app?.connection?.status === 'connected') {
      const refreshButton = createElement('button', {
        className: 'p-2 hover:bg-accent transition-colors shrink-0',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>`,
        dataset: { refresh: 'true' },
        title: 'Refresh data',
      });
      this.addListener(refreshButton, 'click', () => this.handleRefresh());
      titleRow.appendChild(refreshButton);
    }
    
    textInfo.appendChild(titleRow);
    
    if (this.app?.description) {
      const desc = createElement('p', {
        className: 'text-base text-muted-foreground max-w-2xl leading-relaxed',
        textContent: this.app.description,
      });
      textInfo.appendChild(desc);
    }
    
    infoWrapper.appendChild(textInfo);
    row.appendChild(infoWrapper);
    content.appendChild(row);
    header.appendChild(content);
    
    return header;
  }
  
  private createTabs(): HTMLElement {
    const tabsWrapper = createElement('div', {
      className: 'border-b',
    });
    
    const tabsList = createElement('div', {
      className: 'flex gap-4',
    });
    
    const tabs: { value: TabType; label: string }[] = [
      { value: 'settings', label: 'Settings' },
      { value: 'data', label: 'Data' },
    ];
    
    for (const tab of tabs) {
      const button = createElement('button', {
        className: `px-4 py-2 text-sm font-mono uppercase tracking-wider border-b-2 transition-colors ${
          this.currentTab === tab.value
            ? 'border-primary text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`,
        textContent: tab.label,
        dataset: { tab: tab.value },
      });
      
      this.addListener(button, 'click', () => {
        this.currentTab = tab.value;
        this.updateTabStyles();
        this.renderTabContent();
      });
      
      tabsList.appendChild(button);
    }
    
    tabsWrapper.appendChild(tabsList);
    return tabsWrapper;
  }
  
  private updateTabStyles(): void {
    const buttons = this.container.querySelectorAll('[data-tab]');
    buttons.forEach(btn => {
      const tab = (btn as HTMLElement).dataset.tab as TabType;
      const isActive = tab === this.currentTab;
      btn.className = `px-4 py-2 text-sm font-mono uppercase tracking-wider border-b-2 transition-colors ${
        isActive
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`;
    });
  }
  
  private renderTabContent(): void {
    if (!this.contentContainer || !this.app) return;
    
    clearChildren(this.contentContainer);
    
    switch (this.currentTab) {
      case 'settings':
        this.renderSettings();
        break;
      case 'data':
        // renderData is now async, so we need to call it without await
        this.renderData().catch(error => {
          console.error('[AppDetail] Error rendering data:', error);
          if (this.contentContainer) {
            this.contentContainer.innerHTML = `
              <div class="p-6 border bg-card">
                <div class="text-status-error font-mono uppercase tracking-wider text-sm text-center py-8">
                  Failed to load data
                </div>
              </div>
            `;
          }
        });
        break;
    }
  }
  
  private renderSettings(): void {
    if (!this.contentContainer || !this.app) return;
    
    const isConnected = this.app.connection?.status === 'connected';
    
    // Connection status card
    const statusCard = createElement('div', {
      className: 'p-6 border bg-card',
    });
    
    statusCard.innerHTML = `
      <h3 class="text-lg font-mono uppercase tracking-wider mb-4">Connection Status</h3>
      <div class="flex items-center gap-3">
        <div class="w-3 h-3 ${isConnected ? 'bg-status-connected' : 'bg-muted-foreground/30'}"></div>
        <span class="font-mono uppercase">${isConnected ? 'Connected' : 'Not Connected'}</span>
      </div>
      <div class="mt-4 pt-4 border-t border-border">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-muted-foreground font-mono uppercase tracking-wider text-xs">Connection Type</span>
            <p class="font-mono mt-1">${this.app.connectionType}</p>
          </div>
          <div>
            <span class="text-muted-foreground font-mono uppercase tracking-wider text-xs">ID</span>
            <p class="font-mono mt-1">${this.app.id}</p>
          </div>
        </div>
      </div>
    `;
    
    this.contentContainer.appendChild(statusCard);
    
    // Connect/Disconnect button
    const actionCard = createElement('div', {
      className: 'mt-6 p-6 border bg-card',
    });
    
    if (!isConnected) {
      // Check if this app needs API key (like Farcaster)
      const needsApiKey = this.app.connectionType === 'api' && this.app.id === 'farcaster';
      
      if (needsApiKey) {
        actionCard.innerHTML = `
          <h3 class="text-lg font-mono uppercase tracking-wider mb-4">Get Started</h3>
          <p class="text-muted-foreground mb-4">Connect this app to start seeing data in your timeline.</p>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-mono uppercase tracking-wider mb-2">Neynar API Key</label>
              <div class="relative">
                <input 
                  type="password" 
                  class="w-full px-3 py-2 pr-10 bg-background border border-border font-mono text-sm" 
                  placeholder="Enter your Neynar API key"
                  data-api-key-input
                />
                <button 
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent transition-colors"
                  data-toggle-api-key-visibility
                  aria-label="Toggle API key visibility"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-eye-icon>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hidden" data-eye-off-icon>
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                    <line x1="2" x2="22" y1="2" y2="22"/>
                  </svg>
                </button>
              </div>
              <p class="text-xs text-muted-foreground mt-2 font-mono">Get your API key from <a href="https://neynar.com" target="_blank" class="underline">neynar.com</a></p>
            </div>
            <div>
              <label class="block text-sm font-mono uppercase tracking-wider mb-2">Farcaster ID (FID)</label>
              <input 
                type="number" 
                class="w-full px-3 py-2 bg-background border border-border font-mono text-sm" 
                placeholder="Enter your Farcaster ID"
                data-fid-input
              />
              <p class="text-xs text-muted-foreground mt-2 font-mono">Your FID is your unique Farcaster identifier (e.g., 12345)</p>
            </div>
            <button class="px-4 py-2 bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm" data-connect>
              Connect ${this.app.name}
            </button>
          </div>
        `;
        
        // Add toggle visibility handler for API key
        const toggleButton = actionCard.querySelector('[data-toggle-api-key-visibility]');
        const apiKeyInput = actionCard.querySelector('[data-api-key-input]') as HTMLInputElement;
        const eyeIcon = actionCard.querySelector('[data-eye-icon]') as HTMLElement;
        const eyeOffIcon = actionCard.querySelector('[data-eye-off-icon]') as HTMLElement;
        
        if (toggleButton && apiKeyInput && eyeIcon && eyeOffIcon) {
          this.addListener(toggleButton as HTMLElement, 'click', () => {
            const isPassword = apiKeyInput.type === 'password';
            apiKeyInput.type = isPassword ? 'text' : 'password';
            eyeIcon.classList.toggle('hidden', !isPassword);
            eyeOffIcon.classList.toggle('hidden', isPassword);
          });
        }
      } else {
        actionCard.innerHTML = `
          <h3 class="text-lg font-mono uppercase tracking-wider mb-4">Get Started</h3>
          <p class="text-muted-foreground mb-4">Connect this app to start seeing data in your timeline.</p>
          <button class="px-4 py-2 bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm" data-connect>
            Connect ${this.app.name}
          </button>
        `;
      }
    } else {
      // Get backfill status for this app
      const backfillStatus = store.backfillStatus.get().get(this.app.id) || { status: 'idle' as const };
      
      let backfillIndicator = '';
      if (backfillStatus.status === 'running') {
        backfillIndicator = `
          <div class="mt-4 p-4 bg-muted/30 border border-border">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-3">
                <div class="w-2 h-2 bg-primary animate-pulse"></div>
                <span class="text-sm font-mono uppercase tracking-wider">Running in background</span>
              </div>
              <button 
                class="px-3 py-1 text-xs bg-background border border-border hover:bg-muted font-mono uppercase tracking-wider transition-colors"
                data-stop-backfill
                title="Stop backfill"
              >
                Stop
              </button>
            </div>
            <p class="text-xs text-muted-foreground font-mono mt-1">Historical data is being synced. This may take a few minutes.</p>
          </div>
        `;
      } else if (backfillStatus.status === 'success') {
        backfillIndicator = `
          <div class="mt-4 p-4 bg-status-connected/10 border border-status-connected/30">
            <div class="flex items-center gap-3">
              <div class="w-2 h-2 bg-status-connected"></div>
              <span class="text-sm font-mono uppercase tracking-wider text-status-connected">Backfill complete</span>
            </div>
            ${backfillStatus.message ? `<p class="text-xs text-muted-foreground font-mono mt-1">${escapeHtml(backfillStatus.message)}</p>` : ''}
          </div>
        `;
      } else if (backfillStatus.status === 'error') {
        backfillIndicator = `
          <div class="mt-4 p-4 bg-status-error/10 border border-status-error/30">
            <div class="flex items-center gap-3">
              <div class="w-2 h-2 bg-status-error"></div>
              <span class="text-sm font-mono uppercase tracking-wider text-status-error">Backfill error</span>
            </div>
            ${backfillStatus.message ? `<p class="text-xs text-status-error font-mono mt-1">${escapeHtml(backfillStatus.message)}</p>` : ''}
          </div>
        `;
      }
      
      actionCard.innerHTML = `
        <h3 class="text-lg font-mono uppercase tracking-wider mb-4">Manage Connection</h3>
        <p class="text-muted-foreground mb-4">This app is connected and syncing data.</p>
        ${backfillIndicator}
        <div class="mt-4">
          <button class="px-4 py-2 bg-destructive text-destructive-foreground font-mono uppercase tracking-wider text-sm" data-disconnect>
            Disconnect
          </button>
        </div>
      `;
    }
    
    this.contentContainer.appendChild(actionCard);
    
    // Add click handlers for connect/disconnect buttons
    const connectButton = actionCard.querySelector('[data-connect]');
    if (connectButton) {
      this.addListener(connectButton as HTMLElement, 'click', async () => {
        await this.handleConnect();
      });
    }
    
    const disconnectButton = actionCard.querySelector('[data-disconnect]');
    if (disconnectButton) {
      this.addListener(disconnectButton as HTMLElement, 'click', async () => {
        await this.handleDisconnect();
      });
    }
    
    const stopBackfillButton = actionCard.querySelector('[data-stop-backfill]');
    if (stopBackfillButton) {
      this.addListener(stopBackfillButton as HTMLElement, 'click', async () => {
        await this.handleStopBackfill();
      });
    }
    
    // Additional settings
    if (this.app.connection?.connectionMetadata?.localPath) {
      const settingsCard = createElement('div', {
        className: 'mt-6 p-6 border bg-card',
      });
      
      settingsCard.innerHTML = `
        <h3 class="text-lg font-mono uppercase tracking-wider mb-4">Configuration</h3>
        <div class="mt-4">
          <label class="text-sm text-muted-foreground font-mono uppercase tracking-wider">Local Path</label>
          <p class="font-mono text-sm mt-1 p-2 bg-muted border border-border">${escapeHtml(this.app.connection.connectionMetadata.localPath)}</p>
        </div>
      `;
      
      this.contentContainer.appendChild(settingsCard);
    }
  }
  
  private async renderData(): Promise<void> {
    if (!this.contentContainer || !this.app) return;
    
    // Get all timeline items filtered by this app's source
    // Map app ID to source type (app ID should match source type)
    const sourceType = this.app.id as SourceType;
    
    // Get total count and first 100 items
    let totalCount = 0;
    let appItems: TimelineItem[] = [];
    
    try {
      // Get total count
      const countResult = await api.timeline.getItemCount.query({
        source: sourceType,
      }) as { count: number };
      totalCount = countResult.count;
      
      // Fetch first 100 items only
      const result = await fetchTimeline(100, undefined, sourceType);
      appItems = result.items;
    } catch (error) {
      console.error('[AppDetail] Error fetching items:', error);
      // Fallback to store items
      const serverItems = store.timelineItems.get();
      appItems = serverItems.filter(item => item.source === sourceType);
      totalCount = appItems.length;
    }
    
    // For browser apps, also include browser history items
    if (this.app.id === 'chrome') {
      const chromeHistory = store.chromeHistory.get();
      const chromeItems: TimelineItem[] = chromeHistory.map(entry => ({
        id: `chrome-${entry.url}-${entry.timestamp}`,
        timestamp: new Date(entry.timestamp),
        source: 'chrome' as SourceType,
        type: 'browser-history',
        data: entry,
      }));
      appItems = [...appItems, ...chromeItems];
    } else if (this.app.id === 'brave') {
      const braveHistory = store.braveHistory.get();
      const braveItems: TimelineItem[] = braveHistory.map(entry => ({
        id: `brave-${entry.url}-${entry.timestamp}`,
        timestamp: new Date(entry.timestamp),
        source: 'brave' as SourceType,
        type: 'browser-history',
        data: entry,
      }));
      appItems = [...appItems, ...braveItems];
    }
    
    if (appItems.length === 0 && totalCount === 0) {
      const card = createElement('div', {
        className: 'p-6 border bg-card',
      });
      
      card.innerHTML = `
        <h3 class="text-lg font-mono uppercase tracking-wider mb-4">Data</h3>
        <p class="text-muted-foreground">No data available for ${escapeHtml(this.app.name)} yet.</p>
        <div class="mt-4 py-8 text-center text-muted-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mx-auto mb-4 opacity-40">
            <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
          </svg>
          <p class="font-mono uppercase tracking-wider text-sm">No data</p>
        </div>
      `;
      
      this.contentContainer.appendChild(card);
      return;
    }
    
    // Render data items
    const wrapper = createElement('div', {
      className: 'space-y-4',
    });
    
    const header = createElement('div', {
      className: 'p-6 border bg-card',
    });
    header.innerHTML = `
      <h3 class="text-lg font-mono uppercase tracking-wider mb-2">Data</h3>
      <p class="text-sm text-muted-foreground font-mono">${totalCount.toLocaleString()} item${totalCount !== 1 ? 's' : ''} from ${escapeHtml(this.app.name)}</p>
    `;
    wrapper.appendChild(header);
    
    // Render items (sorted by timestamp, newest first)
    const sortedItems = [...appItems].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    for (const item of sortedItems) {
      const itemCard = this.renderDataItem(item);
      wrapper.appendChild(itemCard);
    }
    
    this.contentContainer.appendChild(wrapper);
  }
  
  private setupDataItemEventDelegation(): void {
    // Use event delegation on the container (set up once in init)
    // This will work for all items rendered in the DATA tab
    // We need to attach to the container that persists, not contentContainer which gets cleared
    this.addListener(this.container, 'click', (e: Event) => {
      const target = e.target as HTMLElement;
      
      // Only handle clicks when we're on the DATA tab
      if (this.currentTab !== 'data') return;
      
      // Check for close button
      const closeButton = target.closest('[data-close-expanded]');
      if (closeButton) {
        e.preventDefault();
        e.stopPropagation();
        actions.setExpandedItem(null);
        return;
      }
      
      // Check for clickable content - look for data-clickable within data-entry-id
      const clickable = target.closest('[data-clickable]');
      if (clickable) {
        const entry = clickable.closest('[data-entry-id]') as HTMLElement;
        if (entry?.dataset.entryId) {
          e.preventDefault();
          e.stopPropagation();
          console.log('[AppDetail] Toggling expanded item:', entry.dataset.entryId);
          actions.toggleExpandedItem(entry.dataset.entryId);
        }
      }
    }, { capture: true });
  }
  
  private renderDataItem(item: TimelineItem): HTMLElement {
    const isExpanded = store.expandedItemId.get() === item.id;
    const time = formatTime(item.timestamp);
    const date = formatDate(item.timestamp);
    
    const entry = createElement('div', {
      className: 'p-4 border bg-card',
    });
    entry.setAttribute('data-entry-id', item.id);
    
    // Time label
    const timeLabel = createElement('div', {
      className: 'text-xs text-muted-foreground mb-2 font-mono',
      textContent: `${time} · ${date}`,
    });
    entry.appendChild(timeLabel);
    
    // Content based on type
    const content = this.renderItemContent(item);
    content.classList.add('cursor-pointer');
    content.setAttribute('data-clickable', 'true');
    
    entry.appendChild(content);
    
    // Expanded view
    if (isExpanded) {
      const expandedView = this.renderExpandedView(item);
      entry.appendChild(expandedView);
    }
    
    return entry;
  }
  
  private renderItemContent(item: TimelineItem): HTMLElement {
    switch (item.type) {
      case 'cast':
        return this.renderCastContent(item.data as FarcasterCast);
      case 'browser-history':
        return this.renderBrowserHistoryContent(item.data as BrowserHistoryEntry);
      case 'transaction':
        return this.renderTransactionContent(item.data as TellerTransaction);
      default:
        return createElement('div', {
          className: 'text-sm p-3 bg-card border font-mono',
          textContent: JSON.stringify(item.data),
        });
    }
  }
  
  private renderCastContent(cast: FarcasterCast): HTMLElement {
    const wrapper = createElement('div', {
      className: 'p-3 bg-card border hover:bg-accent transition-colors',
    });
    
    // Author row
    const authorRow = createElement('div', {
      className: 'flex items-center gap-2 mb-2',
    });
    
    if (cast.author?.pfp_url) {
      authorRow.innerHTML = `
        <img src="${escapeHtml(cast.author.pfp_url)}" alt="" class="w-6 h-6" />
        <span class="font-medium text-sm">${escapeHtml(cast.author.display_name || '')}</span>
        <span class="text-muted-foreground text-sm font-mono">@${escapeHtml(cast.author.username || '')}</span>
      `;
    } else {
      authorRow.innerHTML = `
        <div class="w-6 h-6 bg-muted"></div>
        <span class="font-medium text-sm">${escapeHtml(cast.author?.display_name || '')}</span>
        <span class="text-muted-foreground text-sm font-mono">@${escapeHtml(cast.author?.username || '')}</span>
      `;
    }
    wrapper.appendChild(authorRow);
    
    // Text content
    const text = createElement('p', {
      className: 'text-sm',
      textContent: cast.text || '',
    });
    wrapper.appendChild(text);
    
    // Reactions
    if (cast.reactions) {
      const reactions = createElement('div', {
        className: 'flex items-center gap-4 mt-2 text-xs text-muted-foreground font-mono',
      });
      reactions.innerHTML = `
        <span>❤️ ${cast.reactions.likes_count || 0}</span>
        <span>🔁 ${cast.reactions.recasts_count || 0}</span>
        ${cast.replies ? `<span>💬 ${cast.replies.count || 0}</span>` : ''}
      `;
      wrapper.appendChild(reactions);
    }
    
    return wrapper;
  }
  
  private renderBrowserHistoryContent(entry: BrowserHistoryEntry): HTMLElement {
    const wrapper = createElement('div', {
      className: 'p-3 bg-card border hover:bg-accent transition-colors',
    });
    
    // Get favicon
    let faviconUrl = '';
    try {
      const url = new URL(entry.url);
      faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
    } catch {
      // Invalid URL
    }
    
    wrapper.innerHTML = `
      <div class="flex items-start gap-3">
        ${faviconUrl ? `<img src="${faviconUrl}" alt="" class="w-4 h-4 mt-0.5" />` : '<div class="w-4 h-4 mt-0.5 bg-muted"></div>'}
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">${escapeHtml(entry.title || 'Untitled')}</p>
          <p class="text-xs text-muted-foreground truncate font-mono">${escapeHtml(entry.url)}</p>
        </div>
      </div>
    `;
    
    return wrapper;
  }
  
  private renderTransactionContent(transaction: TellerTransaction): HTMLElement {
    const wrapper = createElement('div', {
      className: 'p-3 bg-card border hover:bg-accent transition-colors',
    });
    
    const amount = parseFloat(transaction.amount);
    const isPositive = amount > 0;
    
    wrapper.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium">${escapeHtml(transaction.description)}</p>
          <p class="text-xs text-muted-foreground font-mono uppercase">${escapeHtml(transaction.details?.category || 'Uncategorized')}</p>
        </div>
        <span class="font-mono text-sm ${isPositive ? 'text-status-connected' : 'text-foreground'}">
          ${isPositive ? '+' : ''}$${Math.abs(amount).toFixed(2)}
        </span>
      </div>
    `;
    
    return wrapper;
  }
  
  private renderExpandedView(item: TimelineItem): HTMLElement {
    const wrapper = createElement('div', {
      className: 'mt-3 p-4 bg-card border border-border relative',
    });
    
    // Close button in top right
    const closeButton = createElement('button', {
      className: 'absolute top-2 right-2 p-1.5 hover:bg-accent transition-colors z-10',
      attributes: {
        'aria-label': 'Close',
        style: 'cursor: pointer;',
      },
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    });
    closeButton.dataset.closeExpanded = 'true';
    wrapper.appendChild(closeButton);
    
    // Content based on item type
    switch (item.type) {
      case 'cast':
        return this.renderCastExpanded(item.data as FarcasterCast, wrapper);
      case 'browser-history':
        return this.renderBrowserHistoryExpanded(item.data as BrowserHistoryEntry, wrapper);
      case 'transaction':
        return this.renderTransactionExpanded(item.data as TellerTransaction, wrapper);
      default:
        return this.renderDefaultExpanded(item, wrapper);
    }
  }
  
  private renderCastExpanded(cast: FarcasterCast, wrapper: HTMLElement): HTMLElement {
    // Clear only the content, keep the close button
    const existingContent = wrapper.querySelector('.expanded-content');
    if (existingContent) {
      existingContent.remove();
    }
    
    const content = createElement('div', {
      className: 'expanded-content space-y-3 text-sm',
    });
    
    // Author info
    const authorSection = createElement('div', {
      className: 'flex items-center gap-3 pb-3 border-b border-border',
    });
    
    if (cast.author?.pfp_url) {
      authorSection.innerHTML = `
        <img src="${escapeHtml(cast.author.pfp_url)}" alt="" class="w-10 h-10" />
        <div>
          <div class="font-medium">${escapeHtml(cast.author.display_name || '')}</div>
          <div class="text-xs text-muted-foreground font-mono">@${escapeHtml(cast.author.username || '')}</div>
        </div>
      `;
    } else {
      authorSection.innerHTML = `
        <div class="w-10 h-10 bg-muted"></div>
        <div>
          <div class="font-medium">${escapeHtml(cast.author?.display_name || '')}</div>
          <div class="text-xs text-muted-foreground font-mono">@${escapeHtml(cast.author?.username || '')}</div>
        </div>
      `;
    }
    content.appendChild(authorSection);
    
    // Full text
    const textSection = createElement('div', {
      className: 'text-sm leading-relaxed',
      textContent: cast.text || '',
    });
    content.appendChild(textSection);
    
    // Metadata
    if (cast.reactions || cast.replies) {
      const metaSection = createElement('div', {
        className: 'flex items-center gap-4 pt-2 text-xs text-muted-foreground font-mono',
      });
      
      const metaItems: string[] = [];
      if (cast.reactions?.likes_count) metaItems.push(`❤️ ${cast.reactions.likes_count}`);
      if (cast.reactions?.recasts_count) metaItems.push(`🔁 ${cast.reactions.recasts_count}`);
      if (cast.replies?.count) metaItems.push(`💬 ${cast.replies.count}`);
      
      metaSection.textContent = metaItems.join(' · ');
      content.appendChild(metaSection);
    }
    
    wrapper.appendChild(content);
    return wrapper;
  }
  
  private renderBrowserHistoryExpanded(entry: BrowserHistoryEntry, wrapper: HTMLElement): HTMLElement {
    // Clear only the content, keep the close button
    const existingContent = wrapper.querySelector('.expanded-content');
    if (existingContent) {
      existingContent.remove();
    }
    
    const content = createElement('div', {
      className: 'expanded-content space-y-3 text-sm',
    });
    
    // Title
    const title = createElement('div', {
      className: 'font-medium text-base pb-2',
      textContent: entry.title || 'Untitled',
    });
    content.appendChild(title);
    
    // URL
    const urlSection = createElement('div', {
      className: 'text-xs text-muted-foreground break-all font-mono',
    });
    
    try {
      const url = new URL(entry.url);
      urlSection.innerHTML = `
        <div class="mb-1">${escapeHtml(url.protocol)}//${escapeHtml(url.hostname)}</div>
        <div class="text-muted-foreground/70">${escapeHtml(entry.url)}</div>
      `;
    } catch {
      urlSection.textContent = entry.url;
    }
    content.appendChild(urlSection);
    
    wrapper.appendChild(content);
    return wrapper;
  }
  
  private renderTransactionExpanded(transaction: TellerTransaction, wrapper: HTMLElement): HTMLElement {
    // Clear only the content, keep the close button
    const existingContent = wrapper.querySelector('.expanded-content');
    if (existingContent) {
      existingContent.remove();
    }
    
    const content = createElement('div', {
      className: 'expanded-content space-y-3 text-sm',
    });
    
    const amount = parseFloat(transaction.amount);
    const isPositive = amount > 0;
    
    content.innerHTML = `
      <div class="pb-3 border-b border-border">
        <div class="text-lg font-mono ${isPositive ? 'text-status-connected' : 'text-foreground'}">
          ${isPositive ? '+' : ''}$${Math.abs(amount).toFixed(2)}
        </div>
        <div class="text-xs text-muted-foreground font-mono uppercase mt-1">${escapeHtml(transaction.details?.category || 'Uncategorized')}</div>
      </div>
      <div>
        <div class="text-sm font-medium mb-1">${escapeHtml(transaction.description)}</div>
        ${transaction.details?.counterparty?.name ? `<div class="text-xs text-muted-foreground font-mono">Merchant: ${escapeHtml(transaction.details.counterparty.name)}</div>` : ''}
        ${transaction.details?.processing_status ? `<div class="text-xs text-muted-foreground font-mono uppercase mt-1">Status: ${escapeHtml(transaction.details.processing_status)}</div>` : ''}
      </div>
    `;
    
    wrapper.appendChild(content);
    return wrapper;
  }
  
  private renderDefaultExpanded(item: TimelineItem, wrapper: HTMLElement): HTMLElement {
    // Clear only the content, keep the close button
    const existingContent = wrapper.querySelector('.expanded-content');
    if (existingContent) {
      existingContent.remove();
    }
    
    const content = createElement('div', {
      className: 'expanded-content',
    });
    
    content.innerHTML = `
      <div class="text-xs font-mono uppercase text-muted-foreground mb-2">${escapeHtml(item.type)}</div>
      <pre class="text-xs bg-background p-2 border border-border overflow-auto max-h-64 font-mono">${escapeHtml(JSON.stringify(item.data, null, 2))}</pre>
    `;
    
    wrapper.appendChild(content);
    return wrapper;
  }
  
  private async handleConnect(): Promise<void> {
    if (!this.app) return;
    
    const connectButton = this.container.querySelector('[data-connect]') as HTMLElement;
    const originalButtonText = connectButton?.textContent || '';
    
    try {
      // Show loading state
      if (connectButton) {
        connectButton.textContent = 'Connecting...';
        connectButton.setAttribute('disabled', 'true');
        (connectButton as HTMLButtonElement).disabled = true;
      }
      
      // For API-based apps (like Farcaster), we need an API key
      if (this.app.connectionType === 'api') {
        // Check if this app needs API key
        if (this.app.id === 'farcaster') {
          const apiKeyInput = this.container.querySelector('[data-api-key-input]') as HTMLInputElement;
          const fidInput = this.container.querySelector('[data-fid-input]') as HTMLInputElement;
          
          if (!apiKeyInput || !apiKeyInput.value.trim()) {
            alert('Please enter your Neynar API key');
            apiKeyInput?.focus();
            if (connectButton) {
              connectButton.textContent = originalButtonText;
              connectButton.removeAttribute('disabled');
              (connectButton as HTMLButtonElement).disabled = false;
            }
            return;
          }
          
          if (!fidInput || !fidInput.value.trim()) {
            alert('Please enter your Farcaster ID (FID)');
            fidInput?.focus();
            if (connectButton) {
              connectButton.textContent = originalButtonText;
              connectButton.removeAttribute('disabled');
              (connectButton as HTMLButtonElement).disabled = false;
            }
            return;
          }
          
          const apiKey = apiKeyInput.value.trim();
          const fid = fidInput.value.trim();
          
          // Validate FID is a number
          const fidNumber = parseInt(fid, 10);
          if (isNaN(fidNumber) || fidNumber <= 0) {
            alert('Farcaster ID must be a valid positive number');
            fidInput?.focus();
            if (connectButton) {
              connectButton.textContent = originalButtonText;
              connectButton.removeAttribute('disabled');
              (connectButton as HTMLButtonElement).disabled = false;
            }
            return;
          }
          
          if (connectButton) {
            connectButton.textContent = 'Saving connection...';
          }
          
          // Save API key and FID using saveApiKey endpoint
          const result = await api.apps.saveApiKey.mutate({
            appId: this.app.id,
            apiKey: apiKey,
            connectionMetadata: {
              fid: fidNumber.toString(),
            },
          });
          
          console.log('[AppDetail] Connection saved:', result);
          
          // Clear cache and force refresh apps to get updated connection status
          appsCache.clear();
          const refreshedApps = await fetchApps();
          
          // Update app reference
          const currentAppId = this.app?.id;
          if (!currentAppId) {
            throw new Error('App ID not found');
          }
          this.app = refreshedApps.find(a => a.id === currentAppId) || null;
          
          if (!this.app) {
            console.error('[AppDetail] App not found after refresh');
            throw new Error('Failed to refresh app data');
          }
          
          console.log('[AppDetail] Connection status after refresh:', this.app.connection?.status);
          console.log('[AppDetail] App connection:', this.app.connection);
          
          // Set backfill status to running
          this.setBackfillStatus('running', 'Running in background');
          
          // Re-render to show updated status
          this.render();
          
          console.log('[AppDetail] Connection complete, backfill running in background');
          
          // Check for backfill completion after a delay
          // We'll check if new items appear in the timeline
          this.registerTimeout(() => {
            this.checkBackfillStatus();
          }, 5000); // Check after 5 seconds
          
          // Also check periodically (will auto-cleanup on component destroy)
          this.registerInterval(() => {
            this.checkBackfillStatus();
          }, 10000); // Check every 10 seconds
        } else {
          // For other API apps, create connection without API key (if not needed)
          await api.apps.addConnection.mutate({
            serverId: this.app.id,
            serverName: this.app.name,
            transportType: 'http',
            transportConfig: {},
          });
          
          await fetchAppsWithCache();
          this.app = getAppById(this.app.id) || null;
          this.render();
        }
      } else if (this.app.oauth) {
        // TODO: Implement OAuth flow
        console.log('OAuth connection not yet implemented');
        alert('OAuth connections are not yet implemented');
        if (connectButton) {
          connectButton.textContent = originalButtonText;
          connectButton.removeAttribute('disabled');
          (connectButton as HTMLButtonElement).disabled = false;
        }
      } else {
        console.log('Unknown connection type:', this.app.connectionType);
        if (connectButton) {
          connectButton.textContent = originalButtonText;
          connectButton.removeAttribute('disabled');
          (connectButton as HTMLButtonElement).disabled = false;
        }
      }
    } catch (error) {
      console.error('Failed to connect app:', error);
      const appName = this.app?.name || 'app';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to connect ${appName}: ${errorMessage}`);
      
      // Set backfill status to error
      if (this.app) {
        this.setBackfillStatus('error', errorMessage);
      }
      
      if (connectButton) {
        connectButton.textContent = originalButtonText;
        connectButton.removeAttribute('disabled');
        (connectButton as HTMLButtonElement).disabled = false;
      }
    }
  }
  
  private setBackfillStatus(
    status: 'idle' | 'running' | 'success' | 'error',
    message?: string,
    progress?: number
  ): void {
    if (!this.app) return;
    
    const statusMap = store.backfillStatus.get();
    const newMap = new Map(statusMap);
    newMap.set(this.app.id, { status, message, progress });
    store.backfillStatus.set(newMap);
  }
  
  private async checkBackfillStatus(): Promise<void> {
    if (!this.app || this.app.id !== 'farcaster') return;
    
    const currentStatus = store.backfillStatus.get().get(this.app.id);
    if (currentStatus?.status !== 'running') {
      // Only check if backfill is still running
      return;
    }
    
    try {
      // Fetch fresh timeline data to check for new Farcaster items
      // Use a larger limit to get more items
      const result = await fetchTimeline(200); // Fetch more items to check
      const farcasterItems = result.items.filter(item => item.source === 'farcaster');
      
      // Refresh timeline items in store so DATA tab updates automatically
      // Replace all Farcaster items with fresh data from API
      const allItems = store.timelineItems.get();
      const nonFarcasterItems = allItems.filter(item => item.source !== 'farcaster');
      const freshFarcasterItems = result.items.filter(item => item.source === 'farcaster');
      
      // Merge: keep non-Farcaster items, replace Farcaster items with fresh data
      const updatedItems = [...nonFarcasterItems, ...freshFarcasterItems];
      
      // Update store with refreshed timeline data
      store.timelineItems.set(updatedItems);
      
      // If we have items, mark as success
      if (farcasterItems.length > 0) {
        this.setBackfillStatus('success', `Successfully synced ${farcasterItems.length} items`);
        // Re-render to show success state
        if (this.currentTab === 'settings') {
          this.renderTabContent();
        }
      }
      // Keep status as 'running' if no items yet - don't update message to avoid flickering
    } catch (error) {
      console.error('[AppDetail] Error checking backfill status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify backfill status';
      this.setBackfillStatus('error', errorMessage);
      if (this.currentTab === 'settings') {
        this.renderTabContent();
      }
    }
  }
  
  private async handleStopBackfill(): Promise<void> {
    if (!this.app) return;
    
    try {
      // Get FID from connection metadata if it's Farcaster
      const fid = this.app.id === 'farcaster' 
        ? this.app.connection?.connectionMetadata?.fid as string | undefined
        : undefined;
      
      const result = await api.apps.stopBackfill.mutate({
        appId: this.app.id,
        fid,
      });
      
      if (result.success) {
        this.setBackfillStatus('idle');
        // Re-render to update UI
        if (this.currentTab === 'settings') {
          this.renderTabContent();
        }
        console.log('[AppDetail] Backfill stopped');
      } else {
        console.warn('[AppDetail] Failed to stop backfill:', result.message);
      }
    } catch (error) {
      console.error('[AppDetail] Error stopping backfill:', error);
      alert(`Failed to stop backfill: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  private async handleRefresh(): Promise<void> {
    if (!this.app) return;
    
    const refreshButton = this.container.querySelector('[data-refresh]') as HTMLElement;
    if (!refreshButton) return;
    
    // Disable button and show loading state
    refreshButton.setAttribute('disabled', 'true');
    refreshButton.style.opacity = '0.5';
    refreshButton.style.cursor = 'not-allowed';
    
    // Add spinning animation
    const svg = refreshButton.querySelector('svg');
    if (svg) {
      svg.style.animation = 'spin 1s linear infinite';
    }
    
    try {
      // Trigger sync for this app
      const result = await api.sync.triggerSync.mutate({
        appId: this.app.id,
      });
      
      if (result.success) {
        // Show success feedback
        const originalTitle = refreshButton.getAttribute('title');
        refreshButton.setAttribute('title', `Synced ${result.newItems} new items`);
        
        // Refresh apps to get updated lastSyncedAt
        await fetchAppsWithCache();
        this.app = getAppById(this.app.id) || null;
        
        // Refresh timeline if on data tab
        if (this.currentTab === 'data') {
          const { fetchTimeline } = await import('../api');
          const timelineResult = await fetchTimeline(25);
          actions.appendTimelineItems(timelineResult.items);
          actions.setTimelineCursor(timelineResult.nextCursor || null);
        }
        
        // Reset button after 2 seconds
        setTimeout(() => {
          refreshButton.setAttribute('title', originalTitle || 'Refresh data');
        }, 2000);
      } else {
        throw new Error(result.error || 'Sync failed');
      }
    } catch (error) {
      console.error('[AppDetail] Error refreshing:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      refreshButton.setAttribute('title', `Error: ${errorMessage}`);
      
      // Reset after 3 seconds
      setTimeout(() => {
        refreshButton.setAttribute('title', 'Refresh data');
      }, 3000);
    } finally {
      // Re-enable button
      refreshButton.removeAttribute('disabled');
      refreshButton.style.opacity = '1';
      refreshButton.style.cursor = 'pointer';
      
      if (svg) {
        svg.style.animation = '';
      }
    }
  }
  
  private async handleDisconnect(): Promise<void> {
    if (!this.app || !this.app.connection?.id) return;
    
    try {
      // Remove the connection
      await api.apps.removeConnection.mutate({
        id: this.app.connection.id,
      });
      
      // Refresh apps to get updated connection status
      await fetchAppsWithCache();
      
      // Re-render to show updated status
      this.render();
    } catch (error) {
      console.error('Failed to disconnect app:', error);
      alert(`Failed to disconnect ${this.app.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default AppDetail;


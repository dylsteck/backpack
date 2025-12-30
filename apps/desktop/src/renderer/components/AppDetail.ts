/**
 * App Detail Component
 * Shows detailed view of a single app with tabs
 */

import { Component } from './Component';
import { store } from '../store';
import { router } from '../router';
import { fetchAppsWithCache, getAppById, api } from '../api';
import { createElement, clearChildren, escapeHtml } from '../utils/dom';
import type { AppServer, TimelineItem, SourceType } from '../types';

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
      }
    });
    
    // Subscribe to timeline items changes to update Data tab
    this.subscribe(store.timelineItems, () => {
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
      className: 'flex flex-col gap-2 pt-0.5',
    });
    
    const title = createElement('h1', {
      className: 'text-3xl font-mono uppercase tracking-wider text-foreground',
      textContent: this.app?.name || '',
    });
    textInfo.appendChild(title);
    
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
        this.renderData();
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
      actionCard.innerHTML = `
        <h3 class="text-lg font-mono uppercase tracking-wider mb-4">Get Started</h3>
        <p class="text-muted-foreground mb-4">Connect this app to start seeing data in your timeline.</p>
        <button class="px-4 py-2 bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm" data-connect>
          Connect ${this.app.name}
        </button>
      `;
    } else {
      actionCard.innerHTML = `
        <h3 class="text-lg font-mono uppercase tracking-wider mb-4">Manage Connection</h3>
        <p class="text-muted-foreground mb-4">This app is connected and syncing data.</p>
        <button class="px-4 py-2 bg-destructive text-destructive-foreground font-mono uppercase tracking-wider text-sm" data-disconnect>
          Disconnect
        </button>
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
  
  private renderData(): void {
    if (!this.contentContainer || !this.app) return;
    
    // Get all timeline items filtered by this app's source
    // Map app ID to source type (app ID should match source type)
    const sourceType = this.app.id as SourceType;
    
    // Get server timeline items
    const serverItems = store.timelineItems.get();
    let appItems = serverItems.filter(item => item.source === sourceType);
    
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
    
    if (appItems.length === 0) {
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
      <p class="text-sm text-muted-foreground font-mono">${appItems.length} item${appItems.length !== 1 ? 's' : ''} from ${escapeHtml(this.app.name)}</p>
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
  
  private renderDataItem(item: TimelineItem): HTMLElement {
    const card = createElement('div', {
      className: 'p-4 border bg-card',
    });
    
    const timestamp = new Date(item.timestamp);
    const dateStr = timestamp.toLocaleDateString();
    const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Render based on item type
    let content = '';
    
    if (item.type === 'transaction' && typeof item.data === 'object' && item.data !== null) {
      const tx = item.data as { amount?: string; description?: string; details?: { category?: string } };
      const amount = tx.amount ? parseFloat(tx.amount) : 0;
      const isPositive = amount > 0;
      
      content = `
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <p class="font-mono text-sm mb-1">${escapeHtml(tx.description || 'Transaction')}</p>
            <p class="text-xs text-muted-foreground font-mono uppercase">${escapeHtml(tx.details?.category || 'Uncategorized')}</p>
            <p class="text-xs text-muted-foreground font-mono mt-1">${dateStr} · ${timeStr}</p>
          </div>
          <div class="text-right">
            <p class="font-mono text-sm ${isPositive ? 'text-status-connected' : 'text-foreground'}">
              ${isPositive ? '+' : ''}$${Math.abs(amount).toFixed(2)}
            </p>
          </div>
        </div>
      `;
    } else if (item.type === 'cast' && typeof item.data === 'object' && item.data !== null) {
      const cast = item.data as { text?: string; author?: { username?: string; display_name?: string } };
      content = `
        <div>
          <p class="text-xs text-muted-foreground font-mono mb-2">${dateStr} · ${timeStr}</p>
          ${cast.author ? `<p class="text-xs text-muted-foreground font-mono mb-1">@${escapeHtml(cast.author.username || '')}</p>` : ''}
          <p class="text-sm">${escapeHtml(cast.text || '')}</p>
        </div>
      `;
    } else if (item.type === 'browser-history' && typeof item.data === 'object' && item.data !== null) {
      const entry = item.data as { title?: string; url?: string };
      content = `
        <div>
          <p class="text-xs text-muted-foreground font-mono mb-2">${dateStr} · ${timeStr}</p>
          <p class="font-mono text-sm mb-1">${escapeHtml(entry.title || 'Untitled')}</p>
          <p class="text-xs text-muted-foreground font-mono truncate">${escapeHtml(entry.url || '')}</p>
        </div>
      `;
    } else {
      // Generic data display
      content = `
        <div>
          <p class="text-xs text-muted-foreground font-mono mb-2">${dateStr} · ${timeStr}</p>
          <p class="text-xs font-mono uppercase text-muted-foreground mb-1">${escapeHtml(item.type)}</p>
          <pre class="text-xs bg-muted p-2 border border-border overflow-auto max-h-32 font-mono">${escapeHtml(JSON.stringify(item.data, null, 2))}</pre>
        </div>
      `;
    }
    
    card.innerHTML = content;
    return card;
  }
  
  private async handleConnect(): Promise<void> {
    if (!this.app) return;
    
    try {
      // For API-based apps (like Farcaster), we can connect directly
      // For OAuth apps, we'd need to initiate OAuth flow
      if (this.app.connectionType === 'api') {
        // Create a connection using the addConnection endpoint
        await api.apps.addConnection.mutate({
          serverId: this.app.id,
          serverName: this.app.name,
          transportType: 'http', // Default for API connections
          transportConfig: {},
        });
        
        // Refresh apps to get updated connection status
        await fetchAppsWithCache();
        
        // Re-render to show updated status
        this.render();
      } else if (this.app.oauth) {
        // TODO: Implement OAuth flow
        console.log('OAuth connection not yet implemented');
        alert('OAuth connections are not yet implemented');
      } else {
        console.log('Unknown connection type:', this.app.connectionType);
      }
    } catch (error) {
      console.error('Failed to connect app:', error);
      alert(`Failed to connect ${this.app.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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


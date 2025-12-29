/**
 * App Detail Component
 * Shows detailed view of a single app with tabs
 */

import { Component } from './Component';
import { store } from '../store';
import { router } from '../router';
import { fetchAppsWithCache, getAppById } from '../api';
import { createElement, clearChildren, escapeHtml } from '../utils/dom';
import type { AppServer } from '../types';

type TabType = 'overview' | 'settings' | 'timeline';

export class AppDetail extends Component {
  private app: AppServer | null = null;
  private currentTab: TabType = 'overview';
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
          <h2 class="text-2xl font-semibold">App not found</h2>
          <p class="text-muted-foreground">The app you're looking for doesn't exist.</p>
          <button class="px-4 py-2 bg-primary text-primary-foreground rounded-md flex items-center gap-2 mx-auto" data-back>
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
      className: 'border-b bg-background/95 backdrop-blur-sm sticky top-0 z-20',
    });
    
    // Gradient overlay
    const gradient = createElement('div', {
      className: 'absolute inset-0 bg-gradient-to-b from-muted/20 to-transparent pointer-events-none',
    });
    header.appendChild(gradient);
    
    const content = createElement('div', {
      className: 'max-w-7xl mx-auto px-6 py-8 relative',
    });
    
    // Row with back button and app info
    const row = createElement('div', {
      className: 'flex items-start gap-6 mb-4',
    });
    
    // Back button
    const backButton = createElement('button', {
      className: 'shrink-0 mt-1 p-2 hover:bg-muted/80 rounded-md transition-colors',
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
        className: 'h-16 w-16 rounded-2xl bg-muted/50 p-3 flex items-center justify-center shrink-0 border border-border/50 shadow-sm',
      });
      const icon = createElement('img', {
        className: 'h-full w-full rounded-xl object-contain',
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
      className: 'text-3xl font-bold tracking-tight text-foreground',
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
      { value: 'overview', label: 'Overview' },
      { value: 'settings', label: 'Settings' },
      { value: 'timeline', label: 'Timeline' },
    ];
    
    for (const tab of tabs) {
      const button = createElement('button', {
        className: `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
      btn.className = `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
      case 'overview':
        this.renderOverview();
        break;
      case 'settings':
        this.renderSettings();
        break;
      case 'timeline':
        this.renderTimeline();
        break;
    }
  }
  
  private renderOverview(): void {
    if (!this.contentContainer || !this.app) return;
    
    const isConnected = this.app.connection?.status === 'connected';
    
    // Connection status card
    const statusCard = createElement('div', {
      className: 'p-6 rounded-lg border bg-card',
    });
    
    statusCard.innerHTML = `
      <h3 class="text-lg font-semibold mb-4">Connection Status</h3>
      <div class="flex items-center gap-3">
        <div class="w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-muted-foreground/30'}"></div>
        <span class="font-medium">${isConnected ? 'Connected' : 'Not Connected'}</span>
      </div>
      <div class="mt-4 pt-4 border-t">
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-muted-foreground">Connection Type</span>
            <p class="font-medium">${this.app.connectionType}</p>
          </div>
          <div>
            <span class="text-muted-foreground">ID</span>
            <p class="font-medium">${this.app.id}</p>
          </div>
        </div>
      </div>
    `;
    
    this.contentContainer.appendChild(statusCard);
    
    // Connect/Disconnect button
    const actionCard = createElement('div', {
      className: 'mt-6 p-6 rounded-lg border bg-card',
    });
    
    if (!isConnected) {
      actionCard.innerHTML = `
        <h3 class="text-lg font-semibold mb-4">Get Started</h3>
        <p class="text-muted-foreground mb-4">Connect this app to start seeing data in your timeline.</p>
        <button class="px-4 py-2 bg-primary text-primary-foreground rounded-md" data-connect>
          Connect ${this.app.name}
        </button>
      `;
    } else {
      actionCard.innerHTML = `
        <h3 class="text-lg font-semibold mb-4">Manage Connection</h3>
        <p class="text-muted-foreground mb-4">This app is connected and syncing data.</p>
        <button class="px-4 py-2 bg-destructive text-destructive-foreground rounded-md" data-disconnect>
          Disconnect
        </button>
      `;
    }
    
    this.contentContainer.appendChild(actionCard);
  }
  
  private renderSettings(): void {
    if (!this.contentContainer || !this.app) return;
    
    const card = createElement('div', {
      className: 'p-6 rounded-lg border bg-card',
    });
    
    card.innerHTML = `
      <h3 class="text-lg font-semibold mb-4">Settings</h3>
      <p class="text-muted-foreground">Settings for ${escapeHtml(this.app.name)} will appear here.</p>
      ${this.app.connection?.connectionMetadata?.localPath ? `
        <div class="mt-4 pt-4 border-t">
          <label class="text-sm text-muted-foreground">Local Path</label>
          <p class="font-mono text-sm mt-1 p-2 bg-muted rounded">${escapeHtml(this.app.connection.connectionMetadata.localPath)}</p>
        </div>
      ` : ''}
    `;
    
    this.contentContainer.appendChild(card);
  }
  
  private renderTimeline(): void {
    if (!this.contentContainer || !this.app) return;
    
    const card = createElement('div', {
      className: 'p-6 rounded-lg border bg-card',
    });
    
    card.innerHTML = `
      <h3 class="text-lg font-semibold mb-4">Timeline</h3>
      <p class="text-muted-foreground">Recent activity from ${escapeHtml(this.app.name)} will appear here.</p>
      <div class="mt-4 py-8 text-center text-muted-foreground">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="mx-auto mb-4 opacity-40">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>
        <p>No recent activity</p>
      </div>
    `;
    
    this.contentContainer.appendChild(card);
  }
}

export default AppDetail;


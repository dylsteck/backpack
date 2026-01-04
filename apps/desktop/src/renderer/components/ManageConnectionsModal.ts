/**
 * Manage Connections Modal Component
 * Shows connected apps with management options
 */

import { Component } from './Component';
import { store } from '../store';
import { router } from '../router';
import { api, fetchAppsWithCache } from '../api';
import { createElement, clearChildren } from '../utils/dom';
import type { AppServer } from '../types';

export class ManageConnectionsModal extends Component {
  constructor(container: HTMLElement, private onClose: () => void) {
    super(container);
  }

  async init(): Promise<void> {
    this.render();
    
    // Subscribe to apps changes
    this.subscribe(store.apps, () => this.renderConnectionsList());
  }

  render(): void {
    this.container.innerHTML = '';
    
    // Backdrop with blur
    const backdrop = createElement('div', {
      className: 'fixed inset-0 bg-background/80 backdrop-blur-2xl z-[100] flex items-center justify-center p-6 modal-backdrop-enter',
    });
    
    this.addListener(backdrop, 'click', (e: MouseEvent) => {
      if (e.target === backdrop) {
        this.cleanup();
        this.onClose();
      }
    });
    
    // Modal container
    const modal = createElement('div', {
      className: 'glass-panel bg-card border border-border/50 w-full max-w-3xl max-h-[85vh] flex flex-col elevation-3 rounded-3xl modal-enter relative overflow-hidden',
    });
    
    // Header
    const header = createElement('div', {
      className: 'flex items-center justify-between p-6 border-b border-border/50',
    });
    
    const titleSection = createElement('div');
    const title = createElement('h2', {
      className: 'text-xl font-mono uppercase tracking-wider text-foreground',
      textContent: 'Manage Connections',
    });
    const subtitle = createElement('p', {
      className: 'text-sm text-muted-foreground font-mono mt-1',
      textContent: 'View and manage your connected apps',
    });
    titleSection.appendChild(title);
    titleSection.appendChild(subtitle);
    header.appendChild(titleSection);
    
    // Close button
    const closeBtn = createElement('button', {
      className: 'p-2.5 hover:bg-secondary rounded-xl transition-all text-muted-foreground hover:text-foreground',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
      attributes: { 'aria-label': 'Close' }
    });
    this.addListener(closeBtn, 'click', () => {
      this.cleanup();
      this.onClose();
    });
    header.appendChild(closeBtn);
    
    modal.appendChild(header);
    
    // Content area (scrollable)
    const content = createElement('div', {
      className: 'flex-1 overflow-y-auto p-6',
    });
    
    // Connections list container
    const listContainer = createElement('div', {
      className: 'space-y-3',
      id: 'manage-connections-list',
    });
    
    content.appendChild(listContainer);
    modal.appendChild(content);
    
    backdrop.appendChild(modal);
    this.container.appendChild(backdrop);
    
    // Initial render
    this.renderConnectionsList();
    
    // ESC key to close
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.cleanup();
        this.onClose();
      }
    };
    window.addEventListener('keydown', escHandler);
    this.registerCleanup(() => window.removeEventListener('keydown', escHandler));
  }
  
  private renderConnectionsList(): void {
    const listContainer = this.container.querySelector('#manage-connections-list');
    if (!listContainer) return;
    
    const apps = store.apps.get();
    
    // Filter to show only connected apps
    const connectedApps = apps.filter(app => app.connection?.status === 'connected');
    
    clearChildren(listContainer);
    
    if (connectedApps.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-12 px-6">
          <div class="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground">
              <path d="M5 12h14"/>
              <path d="M12 5v14"/>
            </svg>
          </div>
          <p class="text-sm text-muted-foreground font-mono">No connected apps yet</p>
        </div>
      `;
      return;
    }
    
    for (const app of connectedApps) {
      const item = this.createConnectionItem(app);
      listContainer.appendChild(item);
    }
  }
  
  private createConnectionItem(app: AppServer): HTMLElement {
    const item = createElement('div', {
      className: 'glass-panel flex items-center gap-4 p-4 border bg-card hover:bg-accent transition-all rounded-xl',
    });
    
    // Icon
    if (app.iconUrl) {
      const icon = createElement('img', {
        className: 'w-12 h-12 object-contain shrink-0',
        attributes: {
          src: app.iconUrl,
          alt: app.name,
          loading: 'lazy',
        },
      });
      item.appendChild(icon);
    } else {
      const placeholder = createElement('div', {
        className: 'w-12 h-12 bg-muted shrink-0 flex items-center justify-center text-muted-foreground rounded-lg',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
      });
      item.appendChild(placeholder);
    }
    
    // Info section
    const infoSection = createElement('div', {
      className: 'flex-1 min-w-0',
    });
    
    const name = createElement('p', {
      className: 'font-mono uppercase tracking-wider text-sm font-medium',
      textContent: app.name,
    });
    infoSection.appendChild(name);
    
    // Connection status
    const statusRow = createElement('div', {
      className: 'flex items-center gap-2 mt-1',
    });
    
    const statusDot = createElement('div', {
      className: 'w-2 h-2 rounded-full bg-status-connected pulse-slow',
    });
    statusRow.appendChild(statusDot);
    
    const statusText = createElement('span', {
      className: 'text-xs text-muted-foreground font-mono',
      textContent: 'Connected',
    });
    statusRow.appendChild(statusText);
    
    infoSection.appendChild(statusRow);
    item.appendChild(infoSection);
    
    // Actions section
    const actionsSection = createElement('div', {
      className: 'flex items-center gap-2 shrink-0',
    });
    
    // View Details button
    const viewButton = createElement('button', {
      className: 'px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-border hover:bg-secondary transition-colors rounded',
      textContent: 'View Details',
    });
    
    this.addListener(viewButton, 'click', (e) => {
      e.stopPropagation();
      // Close modal and navigate to app detail
      this.cleanup();
      this.onClose();
      router.navigate(`/apps/${app.id}`);
    });
    
    actionsSection.appendChild(viewButton);
    
    // Disconnect button
    const disconnectButton = createElement('button', {
      className: 'px-3 py-1.5 text-xs font-mono uppercase tracking-wider bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors rounded',
      textContent: 'Disconnect',
      dataset: { appId: app.id, connectionId: app.connection?.id || '' },
    });
    
    this.addListener(disconnectButton, 'click', async (e) => {
      e.stopPropagation();
      await this.handleDisconnect(app);
    });
    
    actionsSection.appendChild(disconnectButton);
    item.appendChild(actionsSection);
    
    return item;
  }
  
  private async handleDisconnect(app: AppServer): Promise<void> {
    if (!app.connection?.id) return;
    
    // Confirm disconnect
    const confirmed = confirm(`Are you sure you want to disconnect ${app.name}? This will stop syncing data from this app.`);
    if (!confirmed) return;
    
    try {
      // Find the disconnect button to show loading state
      const disconnectButton = this.container.querySelector(`[data-connection-id="${app.connection.id}"]`) as HTMLButtonElement;
      if (disconnectButton) {
        disconnectButton.disabled = true;
        disconnectButton.textContent = 'Disconnecting...';
      }
      
      // Remove the connection
      await api.apps.removeConnection.mutate({
        id: app.connection.id,
      });
      
      // Refresh apps to get updated connection status
      await fetchAppsWithCache();
      
      // Re-render list (will automatically update via subscription)
    } catch (error) {
      console.error('Failed to disconnect app:', error);
      alert(`Failed to disconnect ${app.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Re-render to restore button state
      this.renderConnectionsList();
    }
  }
  
  private cleanup(): void {
    // Any cleanup needed before closing
  }
}

export default ManageConnectionsModal;


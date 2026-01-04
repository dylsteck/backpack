/**
 * Vault Grid Component
 * Displays connected apps only
 */

import { Component } from './Component';
import { store } from '../store';
import { router } from '../router';
import { fetchAppsWithCache } from '../api';
import { createElement, clearChildren } from '../utils/dom';
import type { AppServer } from '../types';
import { AddAppsModal } from './AddAppsModal';
import { ManageConnectionsModal } from './ManageConnectionsModal';

export class VaultGrid extends Component {
  private gridContainer: HTMLElement | null = null;
  private headerContainer: HTMLElement | null = null;
  
  async init(): Promise<void> {
    this.render();
    
    // Load apps data
    await this.loadApps();
    
    // Subscribe to apps changes
    this.subscribe(store.apps, () => this.renderGrid());
    this.subscribe(store.appsLoading, () => this.updateLoadingState());
  }
  
  render(): void {
    this.container.innerHTML = '';
    
    // Create inner wrapper for vault content
    const wrapper = createElement('div', {
      className: 'flex flex-col w-full p-6',
    });
    
    // Header with title and action buttons
    this.headerContainer = createElement('div', {
      className: 'flex items-center justify-between mb-6',
    });
    
    const titleSection = createElement('div', {
      className: 'flex-1',
    });
    
    const title = createElement('h1', {
      className: 'text-2xl font-mono uppercase tracking-wider text-foreground',
      textContent: 'Vault',
    });
    titleSection.appendChild(title);
    
    const subtitle = createElement('p', {
      className: 'text-sm text-muted-foreground font-mono mt-1',
      textContent: 'Your connected apps',
    });
    titleSection.appendChild(subtitle);
    
    this.headerContainer.appendChild(titleSection);
    
    // Action buttons
    const actionsContainer = createElement('div', {
      className: 'flex items-center gap-3',
    });
    
    // Add Apps button
    const addButton = createElement('button', {
      className: 'flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-all hover-lift',
      attributes: {
        'aria-label': 'Add Apps',
        'title': 'Add Apps',
      },
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
    });
    
    this.addListener(addButton, 'click', () => {
      this.showAddAppsModal();
    });
    
    actionsContainer.appendChild(addButton);
    
    // Manage Connections button
    const manageButton = createElement('button', {
      className: 'flex items-center justify-center w-10 h-10 rounded-full bg-secondary hover:bg-accent text-foreground transition-all hover-lift',
      attributes: {
        'aria-label': 'Manage Connections',
        'title': 'Manage Connections',
      },
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
    });
    
    this.addListener(manageButton, 'click', () => {
      this.showManageConnectionsModal();
    });
    
    actionsContainer.appendChild(manageButton);
    
    this.headerContainer.appendChild(actionsContainer);
    wrapper.appendChild(this.headerContainer);
    
    // Grid container
    this.gridContainer = createElement('div', {
      className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6',
    });
    wrapper.appendChild(this.gridContainer);
    
    this.container.appendChild(wrapper);
    
    // Initial render
    this.renderGrid();
  }
  
  private async loadApps(): Promise<void> {
    try {
      await fetchAppsWithCache();
    } catch (error) {
      console.error('Failed to load apps:', error);
    }
  }
  
  private updateLoadingState(): void {
    const isLoading = store.appsLoading.get();
    
    if (isLoading && this.gridContainer) {
      this.gridContainer.innerHTML = `
        <div class="col-span-full flex items-center justify-center py-12">
          <div class="font-mono uppercase tracking-wider text-sm text-muted-foreground">Loading...</div>
        </div>
      `;
    }
  }
  
  private renderGrid(): void {
    if (!this.gridContainer) return;
    
    const apps = store.apps.get();
    
    // Filter to show only connected apps
    const connectedApps = apps.filter(app => app.connection?.status === 'connected');
    
    clearChildren(this.gridContainer);
    
    if (connectedApps.length === 0) {
      this.renderEmptyState();
      return;
    }
    
    for (const app of connectedApps) {
      const card = this.createAppCard(app);
      this.gridContainer.appendChild(card);
    }
  }
  
  private renderEmptyState(): void {
    if (!this.gridContainer) return;
    
    this.gridContainer.innerHTML = `
      <div class="col-span-full text-center py-16 px-6">
        <div class="max-w-sm mx-auto space-y-4">
          <div class="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground">
              <rect width="7" height="7" x="3" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="14" rx="1"/>
              <rect width="7" height="7" x="3" y="14" rx="1"/>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-mono uppercase tracking-wider text-foreground mb-2">No Connected Apps</h3>
            <p class="text-sm text-muted-foreground">Add apps to your vault to start syncing your data</p>
          </div>
          <button class="px-4 py-2 bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm hover:bg-primary/90 transition-colors mx-auto" data-add-apps>
            Add Apps
          </button>
        </div>
      </div>
    `;
    
    const addButton = this.gridContainer.querySelector('[data-add-apps]');
    if (addButton) {
      this.addListener(addButton as HTMLElement, 'click', () => {
        this.showAddAppsModal();
      });
    }
  }
  
  private createAppCard(app: AppServer): HTMLElement {
    const isConnected = app.connection?.status === 'connected';

    const card = createElement('div', {
      className: 'glass-panel group relative flex flex-col items-center p-8 border bg-card hover:bg-accent transition-all cursor-pointer hover-lift rounded-2xl',
      dataset: { appId: app.id },
    });

    // Connection status indicator
    const statusDot = createElement('div', {
      className: `absolute top-4 right-4 w-2.5 h-2.5 rounded-full ${
        isConnected ? 'bg-status-connected pulse-slow' : 'bg-muted-foreground/30'
      }`,
    });
    card.appendChild(statusDot);
    
    // Icon - larger size
    if (app.iconUrl) {
      const icon = createElement('img', {
        className: 'w-16 h-16 object-contain mb-4',
        attributes: {
          src: app.iconUrl,
          alt: app.name,
          loading: 'lazy',
        },
      });
      card.appendChild(icon);
    } else {
      const placeholder = createElement('div', {
        className: 'w-16 h-16 bg-muted mb-4 flex items-center justify-center text-muted-foreground rounded-lg',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
      });
      card.appendChild(placeholder);
    }
    
    // Name
    const name = createElement('p', {
      className: 'font-mono uppercase tracking-wider text-base text-center font-medium',
      textContent: app.name,
    });
    card.appendChild(name);
    
    // Description (truncated)
    if (app.description) {
      const desc = createElement('p', {
        className: 'text-xs text-muted-foreground text-center mt-2 line-clamp-2 px-2',
        textContent: app.description,
      });
      card.appendChild(desc);
    }
    
    // Click handler
    this.addListener(card, 'click', () => {
      router.navigate(`/apps/${app.id}`);
    });
    
    return card;
  }
  
  private showAddAppsModal(): void {
    const modalContainer = createElement('div', { id: 'add-apps-modal-portal' });
    document.body.appendChild(modalContainer);
    
    const modal = new AddAppsModal(modalContainer, () => {
      modal.destroy();
      modalContainer.remove();
    });
    modal.init();
  }
  
  private showManageConnectionsModal(): void {
    const modalContainer = createElement('div', { id: 'manage-connections-modal-portal' });
    document.body.appendChild(modalContainer);
    
    const modal = new ManageConnectionsModal(modalContainer, () => {
      modal.destroy();
      modalContainer.remove();
    });
    modal.init();
  }
}

export default VaultGrid;


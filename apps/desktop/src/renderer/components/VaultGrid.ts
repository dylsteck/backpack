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
    
    // Main container matching Timeline style
    const mainContainer = createElement('div', {
      className: 'flex flex-col h-full relative bg-gradient-soft',
    });
    
    // Header matching Timeline style
    const header = createElement('header', {
      className: 'page-header content-wrap z-20',
    });
    
    const titleSection = createElement('div', {
      className: 'flex flex-col gap-0.5',
    });
    
    const title = createElement('h1', {
      className: 'text-title',
      textContent: 'Vault',
    });
    titleSection.appendChild(title);
    
    const subtitle = createElement('p', {
      className: 'text-label',
      textContent: 'Connected Apps',
    });
    titleSection.appendChild(subtitle);
    
    header.appendChild(titleSection);
    
    // Action buttons - refined minimal style
    const actionsContainer = createElement('div', {
      className: 'flex items-center gap-2',
    });
    
    // Add Apps button
    const addButton = createElement('button', {
      className: 'btn btn-ghost icon-btn',
      attributes: {
        'aria-label': 'Add Apps',
        'title': 'Add Apps',
        type: 'button',
      },
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
    });
    
    this.addListener(addButton, 'click', () => {
      this.showAddAppsModal();
    });
    
    actionsContainer.appendChild(addButton);
    
    // Manage Connections button
    const manageButton = createElement('button', {
      className: 'btn btn-ghost icon-btn',
      attributes: {
        'aria-label': 'Manage Connections',
        'title': 'Manage Connections',
        type: 'button',
      },
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
    });
    
    this.addListener(manageButton, 'click', () => {
      this.showManageConnectionsModal();
    });
    
    actionsContainer.appendChild(manageButton);
    
    header.appendChild(actionsContainer);
    mainContainer.appendChild(header);
    
    // Scroll area matching Timeline
    const scrollArea = createElement('div', {
      className: 'flex-1 overflow-y-auto min-h-0 pt-2',
    });
    
    // Content wrapper matching Timeline
    const wrapper = createElement('div', {
      className: 'content-wrap pb-20 relative',
    });
    
    // Grid container
    this.gridContainer = createElement('div', {
      className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
    });
    wrapper.appendChild(this.gridContainer);
    
    scrollArea.appendChild(wrapper);
    mainContainer.appendChild(scrollArea);
    
    this.container.appendChild(mainContainer);
    
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
      const loadingState = createElement('div', {
        className: 'col-span-full flex flex-col items-center justify-center min-h-[400px] text-center py-16',
      });
      
      const spinner = createElement('div', {
        className: 'w-8 h-8 rounded-full border-2 border-muted border-t-foreground/30 animate-spin mb-3',
      });
      loadingState.appendChild(spinner);
      
      const text = createElement('div', {
        className: 'text-sm text-muted-foreground',
        textContent: 'Loading apps...',
      });
      loadingState.appendChild(text);
      
      clearChildren(this.gridContainer);
      this.gridContainer.appendChild(loadingState);
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
    
    const emptyState = createElement('div', {
      className: 'col-span-full flex flex-col items-center justify-center min-h-[400px] text-center py-16',
    });
    
    const icon = createElement('div', {
      className: 'w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-3',
    });
    icon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
        <rect width="7" height="7" x="3" y="3" rx="1"/>
        <rect width="7" height="7" x="14" y="3" rx="1"/>
        <rect width="7" height="7" x="14" y="14" rx="1"/>
        <rect width="7" height="7" x="3" y="14" rx="1"/>
      </svg>
    `;
    emptyState.appendChild(icon);
    
    const text = createElement('div', {
      className: 'text-muted-foreground',
    });
    text.innerHTML = `
      <div class="text-sm font-medium mb-1">No Connected Apps</div>
      <div class="text-xs text-muted-foreground/80">Add apps to your vault to start syncing your data</div>
    `;
    emptyState.appendChild(text);
    
    const addButton = createElement('button', {
      className: 'btn btn-primary mt-4',
      attributes: {
        type: 'button',
        'aria-label': 'Add Apps',
      },
      textContent: 'Add Apps',
    });
    this.addListener(addButton, 'click', () => {
      this.showAddAppsModal();
    });
    emptyState.appendChild(addButton);
    
    this.gridContainer.appendChild(emptyState);
  }
  
  private createAppCard(app: AppServer): HTMLElement {
    const isConnected = app.connection?.status === 'connected';

    const card = createElement('div', {
      className: 'card card-hover group relative flex flex-col items-center p-5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      dataset: { appId: app.id },
      attributes: {
        role: 'button',
        tabindex: '0',
        'aria-label': `View ${app.name} details`,
      },
    });

    // Connection status indicator - refined minimal style
    const statusDot = createElement('div', {
      className: `absolute top-3 right-3 w-2 h-2 rounded-full ${
        isConnected ? 'bg-status-connected' : 'bg-muted-foreground/30'
      }`,
    });
    card.appendChild(statusDot);
    
    // Icon - refined size
    if (app.iconUrl) {
      const icon = createElement('img', {
        className: 'w-12 h-12 object-contain mb-3',
        attributes: {
          src: app.iconUrl,
          alt: app.name,
          loading: 'lazy',
        },
      });
      card.appendChild(icon);
    } else {
      const placeholder = createElement('div', {
        className: 'w-12 h-12 bg-muted/40 mb-3 flex items-center justify-center text-muted-foreground rounded-lg',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
      });
      card.appendChild(placeholder);
    }
    
    // Name - refined typography
    const name = createElement('p', {
      className: 'text-sm text-center font-medium',
      textContent: app.name,
    });
    (name as HTMLElement).style.cssText = `
      font-family: var(--font-sans);
      font-weight: 500;
    `;
    card.appendChild(name);
    
    // Description (truncated) - refined style
    if (app.description) {
      const desc = createElement('p', {
        className: 'text-xs text-muted-foreground text-center mt-1.5 line-clamp-2 leading-relaxed',
        textContent: app.description,
      });
      (desc as HTMLElement).style.cssText = 'font-family: var(--font-sans);';
      card.appendChild(desc);
    }
    
    // Click and keyboard handler
    const handleActivate = () => {
      router.navigate(`/apps/${app.id}`);
    };
    
    this.addListener(card, 'click', handleActivate);
    this.addListener(card, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleActivate();
      }
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

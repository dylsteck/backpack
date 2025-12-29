/**
 * Apps Grid Component
 * Displays available apps/servers with filtering
 */

import { Component } from './Component';
import { store, actions } from '../store';
import { router } from '../router';
import { fetchAppsWithCache } from '../api';
import { createElement, clearChildren, escapeHtml } from '../utils/dom';
import type { AppServer, ConnectionType, ConnectionStatus } from '../types';

export class AppsGrid extends Component {
  private gridContainer: HTMLElement | null = null;
  private selectedTypes: ConnectionType[] = [];
  private selectedStatus: ConnectionStatus = 'all';
  
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
    // Don't override container className - it has overflow-y-auto from Layout
    
    // Create inner wrapper for apps content
    const wrapper = createElement('div', {
      className: 'flex flex-col w-full p-6',
    });
    
    // Filter bar
    const filterBar = this.createFilterBar();
    wrapper.appendChild(filterBar);
    
    // Grid container
    this.gridContainer = createElement('div', {
      className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6',
    });
    wrapper.appendChild(this.gridContainer);
    
    this.container.appendChild(wrapper);
    
    // Initial render
    this.renderGrid();
  }
  
  private createFilterBar(): HTMLElement {
    const bar = createElement('div', {
      className: 'flex items-center gap-4',
    });
    
    // Connection type filter
    const typeFilter = this.createTypeFilter();
    bar.appendChild(typeFilter);
    
    // Status filter
    const statusFilter = this.createStatusFilter();
    bar.appendChild(statusFilter);
    
    return bar;
  }
  
  private createTypeFilter(): HTMLElement {
    const wrapper = createElement('div', {
      className: 'flex items-center gap-2',
    });
    
    const label = createElement('span', {
      className: 'text-sm text-muted-foreground',
      textContent: 'Type:',
    });
    wrapper.appendChild(label);
    
    const types: { value: ConnectionType; label: string }[] = [
      { value: 'oauth', label: 'OAuth' },
      { value: 'local', label: 'Local' },
      { value: 'api', label: 'API' },
    ];
    
    for (const type of types) {
      const button = createElement('button', {
        className: `px-3 py-1 text-sm rounded-md transition-colors ${
          this.selectedTypes.includes(type.value)
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        }`,
        textContent: type.label,
      });
      
      this.addListener(button, 'click', () => {
        if (this.selectedTypes.includes(type.value)) {
          this.selectedTypes = this.selectedTypes.filter(t => t !== type.value);
        } else {
          this.selectedTypes.push(type.value);
        }
        this.renderGrid();
        this.updateFilterButtons();
      });
      
      button.dataset.filterType = type.value;
      wrapper.appendChild(button);
    }
    
    return wrapper;
  }
  
  private createStatusFilter(): HTMLElement {
    const wrapper = createElement('div', {
      className: 'flex items-center gap-2',
    });
    
    const label = createElement('span', {
      className: 'text-sm text-muted-foreground',
      textContent: 'Status:',
    });
    wrapper.appendChild(label);
    
    const statuses: { value: ConnectionStatus; label: string }[] = [
      { value: 'all', label: 'All' },
      { value: 'connected', label: 'Connected' },
      { value: 'disconnected', label: 'Disconnected' },
    ];
    
    for (const status of statuses) {
      const button = createElement('button', {
        className: `px-3 py-1 text-sm rounded-md transition-colors ${
          this.selectedStatus === status.value
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        }`,
        textContent: status.label,
      });
      
      this.addListener(button, 'click', () => {
        this.selectedStatus = status.value;
        this.renderGrid();
        this.updateFilterButtons();
      });
      
      button.dataset.filterStatus = status.value;
      wrapper.appendChild(button);
    }
    
    return wrapper;
  }
  
  private updateFilterButtons(): void {
    // Update type filter buttons
    const typeButtons = this.container.querySelectorAll('[data-filter-type]');
    typeButtons.forEach(btn => {
      const type = (btn as HTMLElement).dataset.filterType as ConnectionType;
      const isActive = this.selectedTypes.includes(type);
      btn.className = `px-3 py-1 text-sm rounded-md transition-colors ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      }`;
    });
    
    // Update status filter buttons
    const statusButtons = this.container.querySelectorAll('[data-filter-status]');
    statusButtons.forEach(btn => {
      const status = (btn as HTMLElement).dataset.filterStatus as ConnectionStatus;
      const isActive = this.selectedStatus === status;
      btn.className = `px-3 py-1 text-sm rounded-md transition-colors ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      }`;
    });
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
          <div class="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
        </div>
      `;
    }
  }
  
  private renderGrid(): void {
    if (!this.gridContainer) return;
    
    const apps = store.apps.get();
    const filteredApps = this.filterApps(apps);
    
    clearChildren(this.gridContainer);
    
    if (filteredApps.length === 0) {
      this.gridContainer.innerHTML = `
        <div class="col-span-full text-center py-12 text-muted-foreground">
          No apps match the selected filters
        </div>
      `;
      return;
    }
    
    for (const app of filteredApps) {
      const card = this.createAppCard(app);
      this.gridContainer.appendChild(card);
    }
  }
  
  private filterApps(apps: AppServer[]): AppServer[] {
    return apps.filter(app => {
      // Type filter
      if (this.selectedTypes.length > 0 && !this.selectedTypes.includes(app.connectionType)) {
        return false;
      }
      
      // Status filter
      if (this.selectedStatus !== 'all') {
        const isConnected = app.connection?.status === 'connected';
        if (this.selectedStatus === 'connected' && !isConnected) return false;
        if (this.selectedStatus === 'disconnected' && isConnected) return false;
      }
      
      return true;
    });
  }
  
  private createAppCard(app: AppServer): HTMLElement {
    const isConnected = app.connection?.status === 'connected';
    
    const card = createElement('div', {
      className: 'group relative flex flex-col items-center p-6 rounded-xl border bg-card hover:bg-accent/50 transition-all cursor-pointer',
      dataset: { appId: app.id },
    });
    
    // Connection status indicator
    const statusDot = createElement('div', {
      className: `absolute top-3 right-3 w-2 h-2 rounded-full ${
        isConnected ? 'bg-green-500' : 'bg-muted-foreground/30'
      }`,
    });
    card.appendChild(statusDot);
    
    // Icon
    if (app.iconUrl) {
      const icon = createElement('img', {
        className: 'w-12 h-12 rounded-lg object-contain mb-3',
        attributes: {
          src: app.iconUrl,
          alt: app.name,
          loading: 'lazy',
        },
      });
      card.appendChild(icon);
    } else {
      const placeholder = createElement('div', {
        className: 'w-12 h-12 rounded-lg bg-muted mb-3 flex items-center justify-center text-muted-foreground',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
      });
      card.appendChild(placeholder);
    }
    
    // Name
    const name = createElement('p', {
      className: 'font-medium text-center',
      textContent: app.name,
    });
    card.appendChild(name);
    
    // Description (truncated)
    if (app.description) {
      const desc = createElement('p', {
        className: 'text-xs text-muted-foreground text-center mt-1 line-clamp-2',
        textContent: app.description,
      });
      card.appendChild(desc);
    }
    
    // Connection type badge
    const badge = createElement('span', {
      className: 'mt-2 px-2 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground',
      textContent: app.connectionType,
    });
    card.appendChild(badge);
    
    // Click handler
    this.addListener(card, 'click', () => {
      router.navigate(`/apps/${app.id}`);
    });
    
    return card;
  }
}

export default AppsGrid;


/**
 * Add Apps Modal Component
 * Shows all available apps for adding to vault
 */

import { Component } from './Component';
import { store } from '../store';
import { router } from '../router';
import { fetchAppsWithCache, appsCache } from '../api';
import { createElement, clearChildren } from '../utils/dom';
import type { AppServer } from '../types';

export class AddAppsModal extends Component {
  constructor(container: HTMLElement, private onClose: () => void) {
    super(container);
  }

  async init(): Promise<void> {
    // Render first to show loading state
    this.render();

    // Subscribe to apps and loading changes
    this.subscribe(store.apps, () => {
      console.log('[AddAppsModal] Apps store updated, re-rendering grid');
      this.renderAppsGrid();
    });
    this.subscribe(store.appsLoading, () => {
      console.log('[AddAppsModal] Apps loading state changed:', store.appsLoading.get());
      this.renderAppsGrid();
    });

    // Ensure apps are loaded - don't wait, let it load in background
    this.loadApps().catch(err => {
      console.error('[AddAppsModal] Error loading apps:', err);
      this.renderAppsGrid();
    });
    
    // Also check if apps are already loaded
    const currentApps = store.apps.get();
    if (currentApps.length > 0) {
      console.log('[AddAppsModal] Apps already in store, rendering immediately');
      this.renderAppsGrid();
    }
  }

  private async loadApps(): Promise<void> {
    try {
      console.log('[AddAppsModal] Loading apps...');
      // Clear cache to ensure fresh data
      appsCache.clear();
      const apps = await fetchAppsWithCache();
      console.log('[AddAppsModal] Loaded apps:', apps.length, apps.map(a => ({ id: a.id, name: a.name, connection: a.connection?.status })));
      // Force re-render after loading
      this.renderAppsGrid();
    } catch (error) {
      console.error('[AddAppsModal] Failed to load apps:', error);
      // Even on error, renderAppsGrid will use fallback apps
      this.renderAppsGrid();
    }
  }

  render(): void {
    this.container.innerHTML = '';
    
    // Backdrop with blur
    const backdrop = createElement('div', {
      className: 'fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 modal-backdrop-enter',
    });
    
    this.addListener(backdrop, 'click', (e: MouseEvent) => {
      if (e.target === backdrop) {
        this.cleanup();
        this.onClose();
      }
    });
    
    // Modal container
    const modal = createElement('div', {
      className: 'modal-shell w-full max-w-5xl max-h-[85vh] flex flex-col elevation-2 modal-enter relative overflow-hidden',
    });
    
    // Header
    const header = createElement('div', {
      className: 'modal-header',
    });
    
    const titleSection = createElement('div');
    const title = createElement('h2', {
      className: 'text-section',
      textContent: 'Add Apps',
    });
    const subtitle = createElement('p', {
      className: 'text-muted mt-1',
      textContent: 'Browse and connect apps to your vault',
    });
    titleSection.appendChild(title);
    titleSection.appendChild(subtitle);
    header.appendChild(titleSection);
    
    // Close button
    const closeBtn = createElement('button', {
      className: 'btn btn-ghost icon-btn',
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
      className: 'flex-1 overflow-y-auto modal-body',
    });
    
    // Apps grid container
    const gridContainer = createElement('div', {
      className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
      id: 'add-apps-grid',
    });
    
    content.appendChild(gridContainer);
    modal.appendChild(content);
    
    backdrop.appendChild(modal);
    this.container.appendChild(backdrop);
    
    // Initial render
    this.renderAppsGrid();
    
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
  
  private renderAppsGrid(): void {
    const gridContainer = this.container.querySelector('#add-apps-grid');
    if (!gridContainer) return;

    const apps = store.apps.get();
    console.log('[AddAppsModal] Apps in store:', apps.length, apps.map(a => ({ id: a.id, name: a.name, connection: a.connection?.status })));
    
    // Filter to show only unconnected apps (connection is null or status is not 'connected')
    const unconnectedApps = apps.filter(app => {
      const connectionStatus = app.connection?.status;
      const isUnconnected = connectionStatus !== 'connected';
      console.log(`[AddAppsModal] App ${app.id}: connection=${connectionStatus}, isUnconnected=${isUnconnected}`);
      return isUnconnected;
    });

    console.log('[AddAppsModal] Unconnected apps:', unconnectedApps.length);

    clearChildren(gridContainer);

    if (store.appsLoading.get()) {
      // Apps are loading - show loading state
      gridContainer.innerHTML = `
        <div class="col-span-full text-center py-12 text-muted-foreground font-semibold uppercase tracking-wider text-xs">
          <div class="flex items-center justify-center gap-2">
            <div class="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin"></div>
            Loading apps...
          </div>
        </div>
      `;
      return;
    }

    if (apps.length === 0) {
      // No apps available - show error state
      console.warn('[AddAppsModal] No apps in store');
      gridContainer.innerHTML = `
        <div class="col-span-full text-center py-12 px-6">
          <div class="w-14 h-14 mx-auto bg-secondary rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p class="text-sm text-muted-foreground">No apps available. Please try again.</p>
        </div>
      `;
      return;
    }

    if (unconnectedApps.length === 0) {
      console.log('[AddAppsModal] All apps are connected');
      gridContainer.innerHTML = `
        <div class="col-span-full text-center py-12 px-6">
          <div class="w-14 h-14 mx-auto bg-secondary rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-primary">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p class="text-sm text-muted-foreground">All available apps are connected!</p>
        </div>
      `;
      return;
    }

    // Render unconnected apps
    console.log('[AddAppsModal] Rendering', unconnectedApps.length, 'unconnected apps');
    for (const app of unconnectedApps) {
      const card = this.createAppCard(app);
      gridContainer.appendChild(card);
    }
  }
  
  private createAppCard(app: AppServer): HTMLElement {
    const isConnected = app.connection?.status === 'connected';

    const card = createElement('div', {
      className: `card-modern group relative flex flex-col items-center p-5 border transition-all cursor-pointer rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        isConnected 
          ? 'bg-secondary/70 border-border/70' 
          : 'bg-card hover:bg-secondary/60 hover-lift'
      }`,
      dataset: { appId: app.id },
      attributes: {
        role: 'button',
        tabindex: '0',
        'aria-label': isConnected ? `${app.name} - Already connected` : `Add ${app.name} to vault`,
      },
    });

    // Connection status indicator or checkmark
    if (isConnected) {
      const checkmark = createElement('div', {
        className: 'absolute top-3 right-3 w-6 h-6 rounded-full bg-secondary flex items-center justify-center border border-border/60',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><polyline points="20 6 9 17 4 12"/></svg>`,
      });
      card.appendChild(checkmark);
    } else {
      const plusIcon = createElement('div', {
        className: 'absolute top-3 right-3 w-6 h-6 rounded-full bg-secondary/70 border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
      });
      card.appendChild(plusIcon);
    }
    
    // Icon
    if (app.iconUrl) {
      const icon = createElement('img', {
        className: 'w-10 h-10 object-contain mb-3',
        attributes: {
          src: app.iconUrl,
          alt: app.name,
          loading: 'lazy',
        },
      });
      card.appendChild(icon);
    } else {
      const placeholder = createElement('div', {
        className: 'w-10 h-10 bg-muted mb-3 flex items-center justify-center text-muted-foreground rounded-lg',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
      });
      card.appendChild(placeholder);
    }
    
    // Name
    const name = createElement('p', {
      className: 'text-sm text-center font-semibold tracking-tight',
      textContent: app.name,
    });
    (name as HTMLElement).style.cssText = 'font-family: var(--font-sans);';
    card.appendChild(name);
    
    // Description (truncated)
    if (app.description) {
      const desc = createElement('p', {
        className: 'text-xs text-muted-foreground text-center mt-1 line-clamp-2',
        textContent: app.description,
      });
      (desc as HTMLElement).style.cssText = 'font-family: var(--font-sans);';
      card.appendChild(desc);
    }
    
    // Connection status badge
    if (isConnected) {
      const statusBadge = createElement('span', {
        className: 'mt-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-secondary text-foreground rounded border border-border/60',
        textContent: 'Connected',
      });
      (statusBadge as HTMLElement).style.cssText = 'font-family: var(--font-sans); letter-spacing: 0.08em;';
      card.appendChild(statusBadge);
    } else {
      const statusBadge = createElement('span', {
        className: 'mt-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider border border-border text-muted-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity',
        textContent: 'Click to Add',
      });
      (statusBadge as HTMLElement).style.cssText = 'font-family: var(--font-sans); letter-spacing: 0.08em;';
      card.appendChild(statusBadge);
    }
    
    // Click and keyboard handler
    const handleActivate = () => {
      // Close modal and navigate to app detail
      this.cleanup();
      this.onClose();
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
  
  private cleanup(): void {
    // Any cleanup needed before closing
  }
}

export default AddAppsModal;

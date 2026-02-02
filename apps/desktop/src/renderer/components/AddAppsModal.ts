/**
 * Add Apps Modal Component
 * Shows all available apps for adding to vault
 */

import { Component } from './Component';
import { store } from '../store';
import { router } from '../router';
import { fetchAppsWithCache } from '../api';
import { createElement, clearChildren } from '../utils/dom';
import type { AppServer } from '../types';

export class AddAppsModal extends Component {
  constructor(container: HTMLElement, private onClose: () => void) {
    super(container);
  }

  async init(): Promise<void> {
    this.render();

    // Subscribe to apps changes
    this.subscribe(store.apps, () => this.renderAppsGrid());

    // Ensure apps are loaded
    await this.loadApps();
  }

  private async loadApps(): Promise<void> {
    try {
      await fetchAppsWithCache();
    } catch (error) {
      console.error('Failed to load apps:', error);
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
      className: 'bg-card border border-border/60 w-full max-w-5xl max-h-[85vh] flex flex-col elevation-2 rounded-2xl modal-enter relative overflow-hidden',
    });
    
    // Header
    const header = createElement('div', {
      className: 'flex items-center justify-between p-5 border-b border-border/60',
    });
    
    const titleSection = createElement('div');
    const title = createElement('h2', {
      className: 'text-[17px] text-foreground',
      textContent: 'Add Apps',
    });
    (title as HTMLElement).style.cssText = `
      font-family: var(--font-display, 'Fraunces', serif);
      font-weight: 600;
      letter-spacing: -0.01em;
    `;
    const subtitle = createElement('p', {
      className: 'text-[13px] text-muted-foreground mt-1',
      textContent: 'Browse and connect apps to your vault',
    });
    (subtitle as HTMLElement).style.cssText = `
      font-family: var(--font-sans, 'Manrope', sans-serif);
    `;
    titleSection.appendChild(title);
    titleSection.appendChild(subtitle);
    header.appendChild(titleSection);
    
    // Close button
    const closeBtn = createElement('button', {
      className: 'p-2 hover:bg-secondary/70 rounded-lg transition-all text-muted-foreground hover:text-foreground',
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
      className: 'flex-1 overflow-y-auto p-5',
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
    // Filter to show only unconnected apps
    const unconnectedApps = apps.filter(app => app.connection?.status !== 'connected');

    clearChildren(gridContainer);

    if (apps.length === 0) {
      // Apps haven't loaded yet - show loading state
      gridContainer.innerHTML = `
        <div class="col-span-full text-center py-12 text-muted-foreground font-semibold uppercase tracking-[0.18em] text-[11px]">
          <div class="flex items-center justify-center gap-2">
            <div class="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin"></div>
            Loading apps...
          </div>
        </div>
      `;
      return;
    }

    if (unconnectedApps.length === 0) {
      gridContainer.innerHTML = `
        <div class="col-span-full text-center py-12 px-6">
          <div class="w-14 h-14 mx-auto bg-secondary rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-primary">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p class="text-[13px] text-muted-foreground">All available apps are connected!</p>
        </div>
      `;
      return;
    }

    for (const app of unconnectedApps) {
      const card = this.createAppCard(app);
      gridContainer.appendChild(card);
    }
  }
  
  private createAppCard(app: AppServer): HTMLElement {
    const isConnected = app.connection?.status === 'connected';

    const card = createElement('div', {
      className: `card-modern group relative flex flex-col items-center p-5 border transition-all cursor-pointer rounded-xl ${
        isConnected 
          ? 'bg-secondary/70 border-border/70' 
          : 'bg-card hover:bg-secondary/60 hover-lift'
      }`,
      dataset: { appId: app.id },
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
      className: 'text-[13px] text-center font-semibold tracking-tight',
      textContent: app.name,
    });
    card.appendChild(name);
    
    // Description (truncated)
    if (app.description) {
      const desc = createElement('p', {
        className: 'text-[11px] text-muted-foreground text-center mt-1 line-clamp-2',
        textContent: app.description,
      });
      card.appendChild(desc);
    }
    
    // Connection status badge
    if (isConnected) {
      const statusBadge = createElement('span', {
        className: 'mt-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] bg-secondary text-foreground rounded border border-border/60',
        textContent: 'Connected',
      });
      card.appendChild(statusBadge);
    } else {
      const statusBadge = createElement('span', {
        className: 'mt-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] border border-border text-muted-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity',
        textContent: 'Click to Add',
      });
      card.appendChild(statusBadge);
    }
    
    // Click handler
    this.addListener(card, 'click', () => {
      // Close modal and navigate to app detail
      this.cleanup();
      this.onClose();
      router.navigate(`/apps/${app.id}`);
    });
    
    return card;
  }
  
  private cleanup(): void {
    // Any cleanup needed before closing
  }
}

export default AddAppsModal;


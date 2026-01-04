/**
 * DetailModal Component
 * Detailed modal for timeline items - Modern design
 */

import { Component } from './Component';
import { createElement, formatFullDate, formatTime, escapeHtml } from '../utils/dom';
import type { TimelineItem, FarcasterCast, TellerTransaction, BrowserHistoryEntry } from '../types';
import { api } from '../api';
import { store } from '../store';
import { parseMarkdown, setupMarkdownInteractivity } from '../utils/markdown';

export class DetailModal extends Component {
  private actionsOpen = false;
  private dropdownId = `actions-dropdown-${Math.random().toString(36).substring(2, 9)}`;
  private triggerId = `actions-trigger-${Math.random().toString(36).substring(2, 9)}`;
  private _closeDropdownHandler?: EventListener;
  private _escHandler?: EventListener;

  constructor(container: HTMLElement, private item: TimelineItem, private onClose: () => void) {
    super(container);
  }

  async init(): Promise<void> {
    this.render();
  }

  render(): void {
    this.container.innerHTML = '';
    
    // Hide app sidebar when modal is open
    const appSidebar = document.querySelector('[data-sidebar]');
    if (appSidebar) appSidebar.classList.add('hidden');
    
    // Backdrop with enhanced blur
    const backdrop = createElement('div', {
      className: 'fixed inset-0 bg-background/80 backdrop-blur-2xl z-[100] flex items-center justify-center p-6 md:p-12 animate-in fade-in duration-300',
    });
    
    this.addListener(backdrop, 'click', (e: MouseEvent) => {
      if (e.target === backdrop) {
        this.cleanup();
        this.onClose();
      }
    });
    
    // Modal container with glass morphism
    const modal = createElement('div', {
      className: 'glass-panel bg-card border border-border/50 w-full max-w-5xl h-full max-h-[85vh] flex flex-col md:flex-row overflow-hidden elevation-3 rounded-3xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 relative',
    });
    
    // Close button
    const closeBtn = createElement('button', {
      className: 'absolute top-4 right-4 p-2.5 hover:bg-secondary rounded-xl transition-all z-[200] text-muted-foreground hover:text-foreground',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
      attributes: { 'aria-label': 'Close' }
    });
    this.addListener(closeBtn, 'click', (e) => {
      e.stopPropagation();
      this.cleanup();
      this.onClose();
    });
    modal.appendChild(closeBtn);

    // LEFT: Content Area
    const contentArea = createElement('div', {
      className: 'flex-1 h-full overflow-y-auto bg-gradient-soft flex items-center justify-center p-8 md:p-12',
    });
    
    const content = this.renderMainContent();
    contentArea.appendChild(content);
    modal.appendChild(contentArea);
    
    // RIGHT: Sidebar
    const sidebarPanel = createElement('aside', {
      className: 'w-full md:w-[360px] h-full border-l border-border/50 bg-card flex flex-col relative',
    });
    
    // Sidebar Header
    const sidebarHeader = createElement('div', {
      className: 'p-6 border-b border-border/50 space-y-4 pr-14', 
    });
    
    // Type badge
    const typeBadge = createElement('div', {
      className: 'inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium',
      textContent: this.getTypeLabel(),
    });
    sidebarHeader.appendChild(typeBadge);
    
    const title = createElement('h2', {
      className: 'text-xl font-semibold leading-tight',
      textContent: this.getItemTitle(),
    });
    sidebarHeader.appendChild(title);
    
    // Actions Row
    const actionRow = createElement('div', {
      className: 'flex gap-2 pt-2 relative',
    });
    
    const connectBtn = createElement('button', {
      className: 'flex-1 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:opacity-90 transition-opacity',
      textContent: 'Connect',
    });
    actionRow.appendChild(connectBtn);
    
    const actionsBtn = createElement('button', {
      className: 'px-4 py-2.5 bg-secondary text-sm font-medium rounded-xl hover:bg-secondary/80 transition-all flex items-center gap-2 cursor-pointer relative z-[20]',
      innerHTML: `<span>Actions</span> <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>`,
      attributes: { 'id': this.triggerId },
    });
    this.addListener(actionsBtn, 'click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleActions();
    });
    actionRow.appendChild(actionsBtn);
    
    // Actions Dropdown
    const actionsDropdown = createElement('div', {
      className: 'absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg z-[100] hidden flex-col overflow-hidden',
      attributes: { 'id': this.dropdownId },
    });
    
    const deleteBtn = createElement('button', {
      className: 'w-full px-4 py-3 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-3 border-none bg-transparent cursor-pointer',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Delete Item`,
    });
    this.addListener(deleteBtn, 'click', (e) => {
      e.stopPropagation();
      this.handleDelete();
    });
    actionsDropdown.appendChild(deleteBtn);
    actionRow.appendChild(actionsDropdown);
    
    sidebarHeader.appendChild(actionRow);
    sidebarPanel.appendChild(sidebarHeader);
    
    // Metadata Area
    const metadata = createElement('div', {
      className: 'flex-1 overflow-y-auto p-6 space-y-6',
    });
    
    metadata.appendChild(this.createMetaSection('Date', formatFullDate(this.item.timestamp)));
    metadata.appendChild(this.createMetaSection('Time', formatTime(this.item.timestamp)));
    metadata.appendChild(this.createMetaSection('Source', this.item.source.charAt(0).toUpperCase() + this.item.source.slice(1)));
    
    if (this.item.type === 'transaction') {
      const tx = this.item.data as TellerTransaction;
      metadata.appendChild(this.createMetaSection('Amount', `$${Math.abs(parseFloat(tx.amount)).toFixed(2)}`));
      metadata.appendChild(this.createMetaSection('Category', tx.details.category || 'N/A'));
    } else if (this.item.type === 'cast') {
      const cast = this.item.data as FarcasterCast;
      metadata.appendChild(this.createMetaSection('Author', `@${cast.author.username}`));
    }
    
    sidebarPanel.appendChild(metadata);

    // Connections section
    const connectionsSection = createElement('div', {
      className: 'mt-auto border-t border-border/50 p-6 bg-card',
    });
    
    const connectionsHeader = createElement('div', {
      className: 'text-sm font-medium text-muted-foreground mb-4',
      textContent: 'Connections (0)',
    });
    connectionsSection.appendChild(connectionsHeader);
    
    connectionsSection.innerHTML += `
      <div class="flex flex-col items-center justify-center py-8 text-center space-y-3">
        <div class="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
        <span class="text-sm text-muted-foreground">No connections yet</span>
      </div>
    `;
    
    sidebarPanel.appendChild(connectionsSection);
    
    modal.appendChild(sidebarPanel);
    backdrop.appendChild(modal);
    this.container.appendChild(backdrop);

    // Close dropdown on click outside
    setTimeout(() => {
      const closeDropdownHandler = (e: MouseEvent) => {
        const dropdown = document.getElementById(this.dropdownId);
        const triggerBtn = document.getElementById(this.triggerId);
        const target = e.target as Node;
        
        if (this.actionsOpen && dropdown && triggerBtn) {
          if (!dropdown.contains(target) && !triggerBtn.contains(target)) {
            this.toggleActions(false);
          }
        }
      };
      document.addEventListener('click', closeDropdownHandler);
      this._closeDropdownHandler = closeDropdownHandler as EventListener;
    }, 0);

    // Escape key listener
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.cleanup();
        this.onClose();
      }
    };
    window.addEventListener('keydown', escHandler as EventListener);
    this._escHandler = escHandler as EventListener;
  }
  
  private cleanup(): void {
    const appSidebar = document.querySelector('[data-sidebar]');
    if (appSidebar) appSidebar.classList.remove('hidden');
    
    if (this._closeDropdownHandler) {
      document.removeEventListener('click', this._closeDropdownHandler);
    }
    if (this._escHandler) {
      window.removeEventListener('keydown', this._escHandler);
    }
  }

  private toggleActions(open?: boolean): void {
    this.actionsOpen = open !== undefined ? open : !this.actionsOpen;
    const dropdown = document.getElementById(this.dropdownId);
    const triggerBtn = document.getElementById(this.triggerId);
    
    if (dropdown && triggerBtn) {
      if (this.actionsOpen) {
        dropdown.classList.remove('hidden');
        dropdown.style.display = 'flex';
      } else {
        dropdown.classList.add('hidden');
        dropdown.style.display = 'none';
      }
    }
  }

  private async handleDelete(): Promise<void> {
    const confirmed = confirm('Are you sure you want to delete this item?');
    if (!confirmed) return;

    try {
      await api.timeline.deleteItem.mutate({ id: this.item.id });
      
      store.timelineItems.update(current => current.filter(i => i.id !== this.item.id));
      
      this.cleanup();
      this.onClose();
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('Failed to delete item.');
    }
  }

  private createMetaSection(label: string, value: string): HTMLElement {
    const section = createElement('div', { className: 'space-y-1' });
    section.innerHTML = `
      <div class="text-xs text-muted-foreground">${label}</div>
      <div class="text-sm font-medium">${escapeHtml(value)}</div>
    `;
    return section;
  }

  private getTypeLabel(): string {
    switch (this.item.type) {
      case 'obsidian-note': return 'Obsidian Note';
      case 'cast': return 'Post';
      case 'transaction': return 'Transaction';
      case 'browser-history': return 'Web Page';
      default: return 'Item';
    }
  }

  private getItemTitle(): string {
    switch (this.item.type) {
      case 'obsidian-note': return (this.item.data as { title: string }).title;
      case 'cast': return (this.item.data as FarcasterCast).author.display_name;
      case 'transaction': return (this.item.data as TellerTransaction).description;
      case 'browser-history': return (this.item.data as BrowserHistoryEntry).title || 'Web Page';
      default: return 'Timeline Item';
    }
  }

  private renderMainContent(): HTMLElement {
    const wrapper = createElement('div', {
      className: 'w-full max-w-2xl',
    });

    switch (this.item.type) {
      case 'obsidian-note': {
        const note = this.item.data as { title: string; body: string; path: string; tags?: string[] };
        wrapper.className = 'w-full max-w-2xl';

        // Create card structure
        const card = createElement('div', { className: 'space-y-6 card-modern p-8' });

        // Header with icon and title
        const header = createElement('div', { className: 'flex items-center gap-4' });
        header.innerHTML = `
          <div class="p-3 bg-purple-500/10 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-purple-500">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <div class="font-semibold text-lg">${escapeHtml(note.title)}</div>
            <div class="text-muted-foreground text-sm">${escapeHtml(note.path)}</div>
          </div>
        `;
        card.appendChild(header);

        // Body with markdown rendering
        const bodyContainer = createElement('div', { className: 'markdown-content prose prose-sm max-w-none' });
        bodyContainer.innerHTML = parseMarkdown(note.body);
        setupMarkdownInteractivity(bodyContainer);
        card.appendChild(bodyContainer);

        // Tags
        if (note.tags?.length) {
          const tagsContainer = createElement('div', { className: 'flex flex-wrap gap-2 pt-4 border-t border-border/50' });
          tagsContainer.innerHTML = note.tags.map(t => `<span class="px-3 py-1 bg-purple-500/10 text-purple-500 text-xs rounded-full">#${escapeHtml(t)}</span>`).join('');
          card.appendChild(tagsContainer);
        }

        wrapper.appendChild(card);
        break;
      }
        
      case 'cast': {
        const cast = this.item.data as FarcasterCast;
        wrapper.innerHTML = `
          <div class="space-y-6 card-modern p-8">
            <div class="flex items-center gap-4">
              <img src="${cast.author.pfp_url}" class="w-14 h-14 rounded-full" />
              <div>
                <div class="font-semibold text-lg">${escapeHtml(cast.author.display_name)}</div>
                <div class="text-muted-foreground">@${escapeHtml(cast.author.username)}</div>
              </div>
            </div>
            <p class="text-xl leading-relaxed whitespace-pre-wrap">${escapeHtml(cast.text)}</p>
            ${cast.embeds?.length ? `
              <div class="grid grid-cols-1 gap-4 mt-4">
                ${cast.embeds.map(e => e.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? `<img src="${e.url}" class="rounded-xl max-h-[400px] object-contain" />` : '').join('')}
              </div>
            ` : ''}
            <div class="flex items-center gap-6 pt-4 text-muted-foreground">
              <span class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                ${cast.reactions?.likes_count || 0}
              </span>
              <span class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
                ${cast.reactions?.recasts_count || 0}
              </span>
            </div>
          </div>
        `;
        break;
      }

      case 'transaction': {
        const tx = this.item.data as TellerTransaction;
        const amount = parseFloat(tx.amount);
        wrapper.innerHTML = `
          <div class="text-center space-y-8 card-modern p-12">
            <div class="text-5xl font-semibold ${amount > 0 ? 'text-green-500' : 'text-foreground'}">
              ${amount > 0 ? '+' : '-'}$${Math.abs(amount).toFixed(2)}
            </div>
            <div class="space-y-2">
              <h2 class="text-2xl font-semibold">${escapeHtml(tx.description)}</h2>
              <p class="text-muted-foreground">${escapeHtml(tx.details.category || 'Uncategorized')}</p>
            </div>
            <div class="p-6 bg-secondary/30 rounded-xl text-sm text-left grid grid-cols-2 gap-4">
              <div class="text-muted-foreground">Account</div><div>${escapeHtml(tx.account_id || 'Primary')}</div>
              <div class="text-muted-foreground">Status</div><div class="text-green-500">Completed</div>
              <div class="text-muted-foreground">Date</div><div>${formatFullDate(this.item.timestamp)}</div>
            </div>
          </div>
        `;
        break;
      }

      case 'browser-history': {
        const entry = this.item.data as BrowserHistoryEntry;
        let faviconUrl = '';
        try {
          const url = new URL(entry.url);
          faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
        } catch {
          // Intentionally empty
        }
        
        wrapper.innerHTML = `
          <div class="text-center space-y-6 card-modern p-12">
            <div class="inline-flex p-5 bg-secondary rounded-2xl">
              ${faviconUrl ? `<img src="${faviconUrl}" class="w-14 h-14" />` : '<div class="w-14 h-14 bg-muted rounded-full"></div>'}
            </div>
            <div class="space-y-4">
              <h2 class="text-2xl font-semibold max-w-xl mx-auto">${escapeHtml(entry.title || 'Untitled Page')}</h2>
              <a href="${entry.url}" target="_blank" class="text-primary hover:underline truncate block max-w-lg mx-auto text-sm">
                ${escapeHtml(entry.url)}
              </a>
            </div>
          </div>
        `;
        break;
      }

      default:
        wrapper.innerHTML = `
          <div class="p-8 card-modern overflow-auto max-h-[60vh]">
            <pre class="text-xs">${escapeHtml(JSON.stringify(this.item.data, null, 2))}</pre>
          </div>
        `;
    }

    return wrapper;
  }
}

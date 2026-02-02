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
import '../styles/chat-theme.css';

export class DetailModal extends Component {
  private actionsOpen = false;
  private isFullscreen = false;
  private sidebarOpen = false;
  private dropdownId = `actions-dropdown-${Math.random().toString(36).substring(2, 9)}`;
  private triggerId = `actions-trigger-${Math.random().toString(36).substring(2, 9)}`;
  private _closeDropdownHandler?: EventListener;
  private _escHandler?: EventListener;

  constructor(container: HTMLElement, private item: TimelineItem, private onClose: () => void) {
    super(container);
  }

  async init(): Promise<void> {
    this.render();
    
    // For Obsidian notes, fetch full content if needed
    if (this.item.type === 'obsidian-note') {
      await this.fetchFullNoteContent();
    }
  }

  private async fetchFullNoteContent(): Promise<void> {
    try {
      const note = this.item.data as { path: string; body: string };
      // Always fetch full content for Obsidian notes to ensure completeness
      console.log('[DetailModal] Fetching full note content for:', note.path);
      const result = await window.obsidianVault.readNote(note.path);
      if (result.success && result.note) {
        // Update item data with full body
        this.item.data = {
          ...(this.item.data as Record<string, unknown>),
          body: result.note.body,
          tags: result.note.tags,
        };
        // Re-render only if the modal is still open (container has children)
        if (this.container.children.length > 0) {
          this.render();
        }
      }
    } catch (error) {
      console.error('[DetailModal] Failed to fetch full note content:', error);
    }
  }

  render(): void {
    this.container.innerHTML = '';
    
    // Hide app sidebar when modal is open
    const appSidebar = document.querySelector('[data-sidebar]');
    if (appSidebar) appSidebar.classList.add('hidden');
    
    // Backdrop - cleaner, less blur
    const backdrop = createElement('div', {
      className: 'fixed inset-0 bg-background/75 backdrop-blur-[8px] z-[100] flex items-center justify-center p-4 md:p-8 modal-backdrop-enter',
    });
    
    this.addListener(backdrop, 'click', (e: MouseEvent) => {
      if (e.target === backdrop) {
        this.cleanup();
        this.onClose();
      }
    });
    
    // Modal container - cleaner, editorial minimal
    const modal = createElement('div', {
      className: `bg-card border border-border/70 transition-all duration-300 ease-out flex flex-col md:flex-row elevation-2 rounded-xl modal-enter relative ${this.isFullscreen ? 'w-full max-w-[98vw] h-[98vh] max-h-[98vh] overflow-hidden' : 'w-full max-w-5xl h-full max-h-[88vh] overflow-visible'}`,
    });
    // Ensure visibility and proper positioning for sidebar
    (modal as HTMLElement).style.cssText = `
      opacity: 1;
      position: relative;
    `;
    
    // Top Right Controls Container - cleaner alignment
    const controlsContainer = createElement('div', {
      className: 'absolute top-5 right-5 flex items-center gap-2 z-[200]',
    });

    // Sidebar Toggle Button (Info button) - cleaner
    const sidebarToggleBtn = createElement('button', {
      className: 'p-2 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-secondary/70 group',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
      attributes: { 'aria-label': 'Toggle info sidebar', 'aria-expanded': String(this.sidebarOpen) }
    });
    (sidebarToggleBtn as HTMLElement).style.cssText = `
      background: ${this.sidebarOpen ? 'hsl(var(--secondary))' : 'transparent'};
      color: ${this.sidebarOpen ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'};
    `;
    this.addListener(sidebarToggleBtn, 'click', (e) => {
      e.stopPropagation();
      this.toggleSidebar();
      sidebarToggleBtn.setAttribute('aria-expanded', String(this.sidebarOpen));
      (sidebarToggleBtn as HTMLElement).style.background = this.sidebarOpen ? 'hsl(var(--secondary))' : 'transparent';
      (sidebarToggleBtn as HTMLElement).style.color = this.sidebarOpen ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))';
    });
    controlsContainer.appendChild(sidebarToggleBtn);

    // Fullscreen Button - cleaner
    const fullscreenBtn = createElement('button', {
      className: 'p-2 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-secondary/70 group',
      innerHTML: this.isFullscreen 
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 3 6 6m0-6-6 6M9 21l-6-6m0 6 6-6M21 3h-6m6 0v6M3 21h6m-6 0v-6"/></svg>`,
      attributes: { 'aria-label': this.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }
    });
    this.addListener(fullscreenBtn, 'click', (e) => {
      e.stopPropagation();
      this.toggleFullscreen();
    });
    controlsContainer.appendChild(fullscreenBtn);

    // Close button - cleaner
    const closeBtn = createElement('button', {
      className: 'p-2 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-secondary/70 group',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
      attributes: { 'aria-label': 'Close' }
    });
    this.addListener(closeBtn, 'click', (e) => {
      e.stopPropagation();
      this.cleanup();
      this.onClose();
    });
    controlsContainer.appendChild(closeBtn);
    modal.appendChild(controlsContainer);

    // MAIN: Content Area (full width when sidebar closed)
    const contentArea = createElement('div', {
      className: 'modal-content-area flex-1 min-h-0 overflow-y-auto modal-content-spacing modal-scrollbar transition-all duration-300 modal-content-enter',
    });
    (contentArea as HTMLElement).style.cssText = `
      height: 100%;
      ${!this.isFullscreen ? 'max-height: 90vh;' : ''}
      background: hsl(var(--card));
      color: hsl(var(--foreground));
      transition: margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      margin-right: ${this.sidebarOpen ? '380px' : '0'};
    `;

    const content = this.renderMainContent();
    contentArea.appendChild(content);
    modal.appendChild(contentArea);

    // RIGHT: Collapsible Sidebar
    if (!this.isFullscreen) {
      const sidebarPanel = createElement('aside', {
        className: 'modal-sidebar-premium w-[380px] h-full flex flex-col shrink-0 relative transition-all duration-300',
      });
      (sidebarPanel as HTMLElement).style.cssText = `
        position: absolute;
        top: 0;
        right: ${this.sidebarOpen ? '0' : '-400px'};
        width: 380px;
        height: 100%;
        background: hsl(var(--secondary) / 0.7);
        backdrop-filter: blur(10px);
        border-left: 1px solid hsl(var(--border) / 0.35);
        transition: right 0.3s ease;
        z-index: 10;
      `;
      
      // Sidebar Header - cleaner, more compact
      const sidebarHeader = createElement('div', {
        className: 'modal-content-spacing space-y-5 pt-12 pr-12', 
      });
      
      // Type badge - smaller, cleaner
      const typeBadge = createElement('div', {
        className: 'inline-flex items-center px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/15 text-primary text-[9px] font-semibold uppercase tracking-wider',
        textContent: this.getTypeLabel(),
      });
      (typeBadge as HTMLElement).style.cssText = `
        font-family: var(--font-sans);
        letter-spacing: 0.08em;
      `;
      sidebarHeader.appendChild(typeBadge);
      
      const metaTitle = createElement('h2', {
        className: 'modal-title text-xl text-foreground',
        textContent: this.getItemTitle(),
      });
      (metaTitle as HTMLElement).style.cssText = `
        font-family: var(--font-sans);
        font-weight: 600;
        line-height: 1.3;
        letter-spacing: -0.01em;
        color: hsl(var(--foreground));
      `;
      sidebarHeader.appendChild(metaTitle);
      
      // Actions Row - cleaner, more compact
      const actionRow = createElement('div', {
        className: 'flex gap-2 pt-3 relative',
      });
      
      const connectBtn = createElement('button', {
        className: 'flex-1 h-10 text-primary-foreground rounded-lg flex items-center justify-center gap-2 font-medium text-sm bg-primary hover:bg-primary/90 transition-colors',
        innerHTML: `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span>Connect</span>
        `,
        attributes: { 'aria-label': 'Connect item' }
      });
      actionRow.appendChild(connectBtn);
      
      const actionsBtn = createElement('button', {
        className: 'w-10 h-10 p-0 flex items-center justify-center text-muted-foreground rounded-lg hover:bg-secondary/70 transition-colors relative z-[20]',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
        attributes: { 'id': this.triggerId, 'aria-label': 'More actions' },
      });
      this.addListener(actionsBtn, 'click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.toggleActions();
      });
      actionRow.appendChild(actionsBtn);
      
      // Actions Dropdown - cleaner styling
      const actionsDropdown = createElement('div', {
        className: 'absolute right-0 top-full mt-2 w-52 bg-card border border-border/60 rounded-lg shadow-lg z-[100] hidden flex-col overflow-hidden p-1',
        attributes: { 'id': this.dropdownId },
      });
      
      const deleteBtn = createElement('button', {
        className: 'w-full px-3 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors rounded-md flex items-center gap-2.5 border-none bg-transparent cursor-pointer font-medium',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Delete Item`,
        attributes: { 'aria-label': 'Delete item' }
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
        className: 'modal-visual-hierarchy flex-1 overflow-y-auto modal-scrollbar modal-content-spacing',
      });
      (metadata as HTMLElement).style.cssText = `
        background: transparent;
        color: hsl(var(--foreground));
      `;
      
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

      // Connections section - cleaner
      const connectionsSection = createElement('div', {
        className: 'mt-auto border-t border-border/20 pt-6 pb-6 px-6',
      });
      
      const connectionsHeader = createElement('div', {
        className: 'text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-4',
        textContent: 'Connections (0)',
      });
      (connectionsHeader as HTMLElement).style.cssText = `
        font-family: var(--font-sans);
        letter-spacing: 0.08em;
      `;
      connectionsSection.appendChild(connectionsHeader);
      
      const emptyConnections = createElement('div', {
        className: 'flex flex-col items-center justify-center py-6 text-center space-y-4 opacity-50',
      });
      emptyConnections.innerHTML = `
        <div class="w-12 h-12 rounded-lg bg-secondary/40 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
        <span class="text-xs font-medium text-muted-foreground" style="font-family: var(--font-sans);">No connections</span>
      `;
      connectionsSection.appendChild(emptyConnections);
      
      sidebarPanel.appendChild(connectionsSection);
      modal.appendChild(sidebarPanel);
    }
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
    
    if (dropdown) {
      if (this.actionsOpen) {
        dropdown.classList.remove('hidden');
        dropdown.style.display = 'flex';
      } else {
        dropdown.classList.add('hidden');
        dropdown.style.display = 'none';
      }
    }
  }

  private toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    // Update sidebar position without full re-render
    const sidebar = this.container.querySelector('.modal-sidebar-premium') as HTMLElement;
    const contentArea = this.container.querySelector('.modal-content-area') as HTMLElement;
    if (sidebar) {
      sidebar.style.right = this.sidebarOpen ? '0' : '-400px';
    }
    if (contentArea) {
      contentArea.style.marginRight = this.sidebarOpen ? '380px' : '0';
    }
  }

  private toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    this.render();
  }

  private async handleDelete(): Promise<void> {
    const confirmed = confirm('Are you sure you want to delete this item?');
    if (!confirmed) return;

    try {
      if (this.item.type === 'obsidian-note') {
        const note = this.item.data as { path: string };
        const result = await window.obsidianVault.deleteNote(note.path);
        if (!result.success) throw new Error(result.error || 'Failed to delete note');
        store.obsidianNotes.update(current => current.filter(n => n.path !== note.path));
      } else {
        await api.timeline.deleteItem.mutate({ id: this.item.id });
      }

      store.timelineItems.update(current => current.filter(i => i.id !== this.item.id));
      this.cleanup();
      this.onClose();
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('Failed to delete item.');
    }
  }

  private createMetaSection(label: string, value: string): HTMLElement {
    const section = createElement('div', {
      className: 'p-4 rounded-lg bg-secondary/30 border border-border/30 space-y-1.5',
    });
    section.innerHTML = `
      <div class="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider" style="font-family: var(--font-sans); letter-spacing: 0.08em;">${label}</div>
      <div class="text-sm font-medium text-foreground transition-colors" style="font-family: var(--font-sans);">${escapeHtml(value)}</div>
    `;
    return section;
  }

  private getTypeLabel(): string {
    switch (this.item.type) {
      case 'obsidian-note': return 'Obsidian Note';
      case 'cast': return 'Farcaster Cast';
      case 'transaction': return 'Transaction';
      case 'browser-history': return 'Web Page';
      default: return 'Cortex Item';
    }
  }

  private getItemTitle(): string {
    switch (this.item.type) {
      case 'obsidian-note': return (this.item.data as { title: string }).title;
      case 'cast': return `@${(this.item.data as FarcasterCast).author.username}`;
      case 'transaction': return (this.item.data as TellerTransaction).description;
      case 'browser-history': return (this.item.data as BrowserHistoryEntry).title || 'Web Page';
      default: return 'Details';
    }
  }

  private renderMainContent(): HTMLElement {
    const wrapper = createElement('div', {
      className: 'w-full max-w-4xl mx-auto',
    });
    (wrapper as HTMLElement).style.cssText = `
      color: hsl(var(--foreground));
      background: transparent;
    `;

    switch (this.item.type) {
      case 'obsidian-note': {
        const note = this.item.data as { title: string; body: string; path: string; tags?: string[] };
        
        const article = createElement('article', { className: `modal-visual-hierarchy ${this.isFullscreen ? 'py-12' : ''}` });

        const header = createElement('header', { className: 'modal-section-spacing space-y-5 pb-8 border-b border-border/15' });
        header.innerHTML = `
          <div class="space-y-4">
            <h1 class="text-foreground leading-tight tracking-tight font-bold" style="font-family: var(--font-sans); font-size: clamp(2rem, 3.5vw, 3rem); line-height: 1.2; letter-spacing: -0.02em;">${escapeHtml(note.title)}</h1>
            <div class="flex items-center gap-2.5 text-muted-foreground text-xs bg-secondary/30 px-3 py-1.5 rounded-md w-fit border border-border/15 overflow-hidden max-w-full" style="font-family: var(--font-sans);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-60 shrink-0"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span class="truncate">${escapeHtml(note.path)}</span>
            </div>
          </div>
        `;
        article.appendChild(header);

        // Content - ensure no frontmatter leaks
        const cleanBody = note.body.replace(/^---\n[\s\S]*?\n---\n?/, '');

        const bodyContainer = createElement('div', {
          className: 'markdown-content modal-content-readable',
        });
        (bodyContainer as HTMLElement).style.cssText = `
          color: hsl(var(--foreground));
          font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
          font-size: 1.0625rem;
          line-height: 1.8;
          letter-spacing: -0.003em;
          max-width: 100%;
        `;
        bodyContainer.innerHTML = parseMarkdown(cleanBody);
        setupMarkdownInteractivity(bodyContainer);

        article.appendChild(bodyContainer);

        if (note.tags?.length) {
          const tagsContainer = createElement('div', {
            className: 'modal-section-spacing flex flex-wrap gap-2 pt-8'
          });
          tagsContainer.innerHTML = note.tags.map(t =>
            `<span class="px-3 py-1.5 bg-primary/10 border border-primary/15 text-primary text-xs font-medium rounded-md hover:bg-primary/15 transition-colors cursor-pointer" style="font-family: var(--font-sans);">#${escapeHtml(t)}</span>`
          ).join('');
          article.appendChild(tagsContainer);
        }

        wrapper.appendChild(article);
        break;
      }
        
      case 'cast': {
        const cast = this.item.data as FarcasterCast;
        const article = createElement('article', { className: 'max-w-2xl mx-auto modal-visual-hierarchy' });

        article.innerHTML = `
          <header class="flex items-center gap-3 pb-6">
            <img src="${cast.author.pfp_url}" class="w-12 h-12 rounded-lg border border-border/20" />
            <div>
              <div class="text-lg text-foreground" style="font-family: var(--font-sans); font-weight: 600; line-height: 1.3;">${escapeHtml(cast.author.display_name)}</div>
              <div class="text-muted-foreground text-xs" style="font-family: var(--font-sans);">@${escapeHtml(cast.author.username)}</div>
            </div>
          </header>

          <div class="modal-section-spacing">
            <p class="text-foreground text-lg leading-relaxed whitespace-pre-wrap font-normal" style="font-family: var(--font-sans); line-height: 1.7; letter-spacing: -0.005em;">${escapeHtml(cast.text)}</p>
          </div>

          ${cast.embeds?.length ? `
            <div class="modal-section-spacing grid grid-cols-1 gap-3">
              ${cast.embeds.map(e => e.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ?
                `<img src="${e.url}" class="w-full rounded-lg border border-border/20" />` : ''
              ).join('')}
            </div>
          ` : ''}

          <div class="flex gap-6 pt-6 border-t border-border/15">
            <div class="flex items-center gap-2.5">
              <span class="text-lg font-semibold text-primary" style="font-family: var(--font-sans);">${cast.reactions?.likes_count || 0}</span>
              <span class="text-[9px] font-medium uppercase tracking-wider text-muted-foreground" style="font-family: var(--font-sans); letter-spacing: 0.08em;">Likes</span>
            </div>
            <div class="flex items-center gap-2.5">
              <span class="text-lg font-semibold text-foreground" style="font-family: var(--font-sans);">${cast.reactions?.recasts_count || 0}</span>
              <span class="text-[9px] font-medium uppercase tracking-wider text-muted-foreground" style="font-family: var(--font-sans); letter-spacing: 0.08em;">Recasts</span>
            </div>
          </div>
        `;

        wrapper.appendChild(article);
        break;
      }

      case 'transaction': {
        const tx = this.item.data as TellerTransaction;
        const amount = parseFloat(tx.amount);
        const isPositive = amount > 0;
        wrapper.innerHTML = `
          <div class="h-full flex flex-col items-center justify-center text-center px-6">
            <div class="space-y-6 w-full max-w-2xl">
              <!-- Category Badge -->
              <div class="flex justify-center">
                <div class="inline-flex items-center px-3 py-1.5 rounded-md ${isPositive ? 'bg-green-500/10 border border-green-500/20 text-green-700' : 'bg-amber-500/10 border border-amber-500/20 text-amber-700'} text-xs font-semibold uppercase tracking-wider" style="font-family: var(--font-sans); letter-spacing: 0.1em;">
                  ${escapeHtml(tx.details.category || 'Transaction')}
                </div>
              </div>
              
              <!-- Amount -->
              <div class="text-foreground leading-none" style="font-family: var(--font-sans); font-size: clamp(2.5rem, 6vw, 5rem); font-weight: 700; letter-spacing: -0.02em;">
                <span class="opacity-40 text-[clamp(1rem, 2vw, 1.75rem)] align-top mr-1.5 mt-3 inline-block font-light">$</span>${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              
              <!-- Merchant Name -->
              <div class="space-y-2">
                <h2 class="text-2xl text-foreground" style="font-family: var(--font-sans); font-weight: 600; line-height: 1.3; letter-spacing: -0.01em;">${escapeHtml(tx.description)}</h2>
                <p class="text-muted-foreground text-sm" style="font-family: var(--font-sans);">${formatFullDate(this.item.timestamp)}</p>
              </div>

              <!-- Details Card -->
              <div class="w-full max-w-md mx-auto grid grid-cols-2 gap-6 p-6 bg-card border border-border/30 rounded-lg mt-8">
                <div class="text-left space-y-1.5">
                  <div class="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider" style="font-family: var(--font-sans); letter-spacing: 0.1em;">Account</div>
                  <div class="text-foreground font-medium text-sm break-all" style="font-family: var(--font-sans); line-height: 1.5;">${escapeHtml(tx.account_id || 'Checking Account')}</div>
                </div>
                <div class="text-left space-y-1.5">
                  <div class="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider" style="font-family: var(--font-sans); letter-spacing: 0.1em;">Status</div>
                  <div class="text-green-600 font-medium text-sm flex items-center gap-2" style="font-family: var(--font-sans); line-height: 1.5;">
                    <div class="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></div>
                    <span>Cleared</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
        break;
      }

      case 'browser-history': {
        const entry = this.item.data as BrowserHistoryEntry;
        const url = new URL(entry.url);
        const favicon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`;

        wrapper.innerHTML = `
          <div class="h-full flex flex-col items-center justify-center text-center modal-visual-hierarchy">
            <div class="relative mb-6">
              <div class="absolute inset-0 bg-primary/10 blur-2xl rounded-full scale-150 opacity-40"></div>
              <div class="relative z-10 w-20 h-20 rounded-xl p-4 flex items-center justify-center bg-card border border-border/20">
                <img src="${favicon}" class="w-full h-full object-contain" />
              </div>
            </div>

            <div class="max-w-xl space-y-4 relative z-10">
              <h1 class="text-3xl text-foreground" style="font-family: var(--font-sans); font-weight: 700; line-height: 1.2;">${escapeHtml(entry.title || 'Web Discovery')}</h1>
              <a href="${entry.url}" target="_blank" class="inline-flex items-center gap-2.5 text-primary hover:text-primary/80 transition-colors text-sm px-3 py-2 rounded-lg border border-border/20 hover:bg-secondary/30" style="font-family: var(--font-sans);">
                <span class="truncate max-w-xs">${url.hostname}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          </div>
        `;
        break;
      }

      default:
        wrapper.innerHTML = `
          <div class="p-8 bg-secondary/20 border border-border/40 rounded-3xl">
            <pre class="font-mono text-xs text-muted-foreground overflow-auto">${escapeHtml(JSON.stringify(this.item.data, null, 2))}</pre>
          </div>
        `;
    }

    return wrapper;
  }
}

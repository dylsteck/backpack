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
    
    // Backdrop with enhanced blur
    const backdrop = createElement('div', {
      className: 'fixed inset-0 bg-background/85 backdrop-blur-[32px] saturate-180 z-[100] flex items-center justify-center p-6 md:p-12 modal-backdrop-enter',
    });
    
    this.addListener(backdrop, 'click', (e: MouseEvent) => {
      if (e.target === backdrop) {
        this.cleanup();
        this.onClose();
      }
    });
    
    // Modal container
    const modal = createElement('div', {
      className: `modal-container-premium bg-card/80 border border-border/30 transition-all duration-500 ease-in-out flex flex-col md:flex-row elevation-4 rounded-[2rem] modal-enter relative ${this.isFullscreen ? 'w-full max-w-[98vw] h-[98vh] max-h-[98vh] overflow-hidden' : 'w-full max-w-6xl h-full max-h-[90vh] overflow-visible'}`,
    });
    // Ensure visibility and proper positioning for sidebar
    (modal as HTMLElement).style.cssText = `
      opacity: 1;
      position: relative;
    `;
    
    // Top Right Controls Container
    const controlsContainer = createElement('div', {
      className: 'absolute top-8 right-8 flex items-center gap-3 z-[200]',
    });

    // Sidebar Toggle Button (Info button)
    const sidebarToggleBtn = createElement('button', {
      className: 'modal-button-secondary p-3 rounded-2xl transition-all text-muted-foreground hover:text-foreground group',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:scale-110 transition-transform"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
      attributes: { 'aria-label': 'Toggle info sidebar', 'aria-expanded': String(this.sidebarOpen) }
    });
    (sidebarToggleBtn as HTMLElement).style.cssText = `
      background: ${this.sidebarOpen ? 'hsl(var(--primary) / 0.15)' : 'transparent'};
      color: ${this.sidebarOpen ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'};
    `;
    this.addListener(sidebarToggleBtn, 'click', (e) => {
      e.stopPropagation();
      this.toggleSidebar();
      sidebarToggleBtn.setAttribute('aria-expanded', String(this.sidebarOpen));
      (sidebarToggleBtn as HTMLElement).style.background = this.sidebarOpen ? 'hsl(var(--primary) / 0.15)' : 'transparent';
      (sidebarToggleBtn as HTMLElement).style.color = this.sidebarOpen ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';
    });
    controlsContainer.appendChild(sidebarToggleBtn);

    // Fullscreen Button
    const fullscreenBtn = createElement('button', {
      className: 'modal-button-secondary p-3 rounded-2xl transition-all text-muted-foreground hover:text-foreground group',
      innerHTML: this.isFullscreen 
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="group-hover:scale-110 transition-transform"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="group-hover:scale-110 transition-transform"><path d="m15 3 6 6m0-6-6 6M9 21l-6-6m0 6 6-6M21 3h-6m6 0v6M3 21h6m-6 0v-6"/></svg>`,
      attributes: { 'aria-label': this.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }
    });
    this.addListener(fullscreenBtn, 'click', (e) => {
      e.stopPropagation();
      this.toggleFullscreen();
    });
    controlsContainer.appendChild(fullscreenBtn);

    // Close button
    const closeBtn = createElement('button', {
      className: 'modal-button-secondary p-3 rounded-2xl transition-all text-muted-foreground hover:text-foreground group',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="group-hover:scale-110 transition-transform"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
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
      background: hsl(var(--background));
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
        background: hsl(var(--muted) / 0.3);
        backdrop-filter: blur(12px);
        border-left: 1px solid hsl(var(--border) / 0.3);
        transition: right 0.3s ease;
        z-index: 10;
      `;
      
      // Sidebar Header
      const sidebarHeader = createElement('div', {
        className: 'modal-content-spacing space-y-6 pt-16 pr-16', 
      });
      
      // Type badge
      const typeBadge = createElement('div', {
        className: 'inline-flex items-center px-4 py-2 rounded-full bg-primary/15 border border-primary/20 text-primary text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm',
        textContent: this.getTypeLabel(),
      });
      (typeBadge as HTMLElement).style.cssText = `
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
        letter-spacing: 0.1em;
      `;
      sidebarHeader.appendChild(typeBadge);
      
      const metaTitle = createElement('h2', {
        className: 'modal-title text-2xl text-foreground',
        textContent: this.getItemTitle(),
      });
      (metaTitle as HTMLElement).style.cssText = `
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: -0.02em;
        color: hsl(var(--foreground));
      `;
      sidebarHeader.appendChild(metaTitle);
      
      // Actions Row
      const actionRow = createElement('div', {
        className: 'flex gap-3 pt-2 relative',
      });
      
      const connectBtn = createElement('button', {
        className: 'modal-button-primary flex-1 h-13 text-primary-foreground rounded-2xl flex items-center justify-center gap-2 font-semibold',
        innerHTML: `
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span>Connect</span>
        `,
      });
      actionRow.appendChild(connectBtn);
      
      const actionsBtn = createElement('button', {
        className: 'modal-button-secondary w-12 h-12 p-0 flex items-center justify-center text-secondary-foreground rounded-2xl relative z-[20]',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
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
        className: 'absolute right-0 top-full mt-3 w-56 modal-container-premium p-2 rounded-2xl elevation-4 z-[100] hidden flex-col overflow-hidden',
        attributes: { 'id': this.dropdownId },
      });
      
      const deleteBtn = createElement('button', {
        className: 'w-full px-4 py-3 text-left text-sm text-destructive hover:bg-destructive/10 transition-all rounded-xl flex items-center gap-3 border-none bg-transparent cursor-pointer font-medium',
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

      // Connections section
      const connectionsSection = createElement('div', {
        className: 'mt-auto border-t border-border/30 modal-content-spacing bg-muted/10 backdrop-blur-sm',
      });
      
      const connectionsHeader = createElement('div', {
        className: 'text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-8',
        textContent: 'Connections (0)',
      });
      (connectionsHeader as HTMLElement).style.cssText = `
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
      `;
      connectionsSection.appendChild(connectionsHeader);
      
      connectionsSection.innerHTML += `
        <div class="flex flex-col items-center justify-center py-8 text-center space-y-6 opacity-60">
          <div class="modal-metadata-card w-16 h-16 rounded-3xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <span class="text-sm font-medium text-muted-foreground">No graph connections available</span>
        </div>
      `;
      
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
      className: 'modal-metadata-card p-5 rounded-2xl space-y-2',
    });
    section.innerHTML = `
      <div class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">${label}</div>
      <div class="text-sm font-semibold text-foreground transition-colors">${escapeHtml(value)}</div>
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

        const header = createElement('header', { className: 'modal-section-spacing space-y-6 pb-10 border-b border-border/20' });
        header.innerHTML = `
          <div class="space-y-5">
            <h1 class="text-foreground leading-tight tracking-tight font-bold" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif); font-size: clamp(2.25rem, 4vw, 3.5rem); line-height: 1.2; letter-spacing: -0.02em;">${escapeHtml(note.title)}</h1>
            <div class="flex items-center gap-3 text-muted-foreground font-sans text-xs bg-secondary/40 px-4 py-2 rounded-lg w-fit border border-border/20 overflow-hidden max-w-full" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-70 shrink-0"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
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
            className: 'modal-section-spacing flex flex-wrap gap-3 pt-10'
          });
          tagsContainer.innerHTML = note.tags.map(t =>
            `<span class="px-4 py-2 bg-primary/12 border border-primary/25 text-primary text-xs font-semibold rounded-full hover:bg-primary/20 transition-all cursor-pointer backdrop-blur-sm" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);">#${escapeHtml(t)}</span>`
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
          <header class="flex items-center gap-4 pb-8">
            <img src="${cast.author.pfp_url}" class="w-16 h-16 rounded-2xl elevation-2 border border-border/30" />
            <div>
              <div class="modal-subtitle text-xl text-foreground" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif); font-weight: 600; line-height: 1.3;">${escapeHtml(cast.author.display_name)}</div>
              <div class="text-muted-foreground text-sm font-sans" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);">@${escapeHtml(cast.author.username)}</div>
            </div>
          </header>

          <div class="modal-section-spacing">
            <p class="modal-content-readable text-foreground text-xl leading-relaxed whitespace-pre-wrap font-normal" style="font-family: var(--font-sans); line-height: 1.75; letter-spacing: -0.01em;">${escapeHtml(cast.text)}</p>
          </div>

          ${cast.embeds?.length ? `
            <div class="modal-section-spacing grid grid-cols-1 gap-4">
              ${cast.embeds.map(e => e.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ?
                `<img src="${e.url}" class="w-full rounded-2xl elevation-2 border border-border/30" />` : ''
              ).join('')}
            </div>
          ` : ''}

          <div class="flex gap-8 pt-8 border-t border-border/20">
            <div class="flex items-center gap-3">
              <span class="text-xl font-bold text-primary animated-counter" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);">${cast.reactions?.likes_count || 0}</span>
              <span class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif); letter-spacing: 0.1em;">Likes</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xl font-bold text-secondary-foreground animated-counter" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);">${cast.reactions?.recasts_count || 0}</span>
              <span class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif); letter-spacing: 0.1em;">Recasts</span>
            </div>
          </div>
        `;

        wrapper.appendChild(article);
        break;
      }

      case 'transaction': {
        const tx = this.item.data as TellerTransaction;
        const amount = parseFloat(tx.amount);
        wrapper.innerHTML = `
          <div class="h-full flex flex-col items-center justify-center text-center modal-visual-hierarchy">
            <div class="space-y-6">
              <div class="inline-flex items-center px-5 py-2 rounded-full ${amount > 0 ? 'bg-green-500/12 border border-green-500/25 text-green-500' : 'bg-amber-500/12 border border-amber-500/25 text-amber-500'} text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                ${tx.details.category || 'Transaction'}
              </div>
              <div class="modal-title text-foreground leading-none" style="font-size: clamp(4rem, 8vw, 7rem);">
                <span class="opacity-30 text-[clamp(1.5rem, 3vw, 2.5rem)] align-top mr-2 mt-6 inline-block font-sans font-light">$</span>${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            
            <div class="max-w-xl space-y-4">
              <h2 class="modal-subtitle text-2xl text-foreground" style="font-family: var(--font-sans); font-weight: 600; line-height: 1.3; letter-spacing: -0.01em;">${escapeHtml(tx.description)}</h2>
              <p class="text-muted-foreground text-base font-sans" style="font-family: var(--font-sans);">${formatFullDate(this.item.timestamp)}</p>
            </div>

            <div class="w-full max-w-sm grid grid-cols-2 gap-6 p-8 modal-metadata-card rounded-3xl">
              <div class="text-left space-y-2">
                <div class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif); letter-spacing: 0.08em;">Account</div>
                <div class="text-foreground font-medium text-base" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif); line-height: 1.5;">${escapeHtml(tx.account_id || 'Checking Account')}</div>
              </div>
              <div class="text-left space-y-2">
                <div class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif); letter-spacing: 0.08em;">Status</div>
                <div class="text-green-500 font-medium text-base flex items-center gap-2" style="font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif); line-height: 1.5;">
                  <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  Cleared
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
            <div class="relative mb-8">
              <div class="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 opacity-60"></div>
              <div class="modal-container-premium relative z-10 w-28 h-28 rounded-3xl p-6 flex items-center justify-center">
                <img src="${favicon}" class="w-full h-full object-contain" />
              </div>
            </div>

            <div class="max-w-xl space-y-6 relative z-10">
              <h1 class="modal-title text-4xl text-foreground">${escapeHtml(entry.title || 'Web Discovery')}</h1>
              <a href="${entry.url}" target="_blank" class="inline-flex items-center gap-3 text-primary hover:text-primary/80 transition-colors font-mono text-base modal-button-secondary px-4 py-2 rounded-xl">
                <span class="truncate max-w-xs">${url.hostname}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
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

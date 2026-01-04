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
    
    // Backdrop with enhanced blur and staggered entrance
    const backdrop = createElement('div', {
      className: 'fixed inset-0 bg-background/80 backdrop-blur-2xl z-[100] flex items-center justify-center p-6 md:p-12 modal-backdrop-enter',
    });
    
    this.addListener(backdrop, 'click', (e: MouseEvent) => {
      if (e.target === backdrop) {
        this.cleanup();
        this.onClose();
      }
    });
    
    // Modal container with glass morphism and spring entrance
    const modal = createElement('div', {
      className: 'cc-glass w-full max-w-6xl h-full max-h-[90vh] flex flex-col md:flex-row rounded-[2.5rem] modal-enter relative overflow-hidden',
    });
    (modal as HTMLElement).style.cssText = `
      animation: cc-slideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    `;
    
    // Close button - floating top right
    const closeBtn = createElement('button', {
      className: 'absolute top-6 right-6 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all z-[200] text-cc-text-secondary hover:text-white group',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="group-hover:scale-110 transition-transform"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
      attributes: { 'aria-label': 'Close' }
    });
    this.addListener(closeBtn, 'click', (e) => {
      e.stopPropagation();
      this.cleanup();
      this.onClose();
    });
    modal.appendChild(closeBtn);

    // LEFT: Content Area (Main editorial view)
    const contentArea = createElement('div', {
      className: 'flex-1 min-h-0 overflow-y-auto cc-scrollbar bg-linear-to-br from-white/[0.02] to-transparent p-8 md:p-16',
    });
    (contentArea as HTMLElement).style.cssText = `
      max-height: 90vh;
      scrollbar-gutter: stable;
    `;

    const content = this.renderMainContent();
    contentArea.appendChild(content);
    modal.appendChild(contentArea);

    // RIGHT: Sidebar (Metadata & Actions)
    const sidebarPanel = createElement('aside', {
      className: 'w-full md:w-[380px] h-full border-l border-white/5 bg-cc-void/40 backdrop-blur-3xl flex flex-col shrink-0',
    });
    
    // Sidebar Header
    const sidebarHeader = createElement('div', {
      className: 'p-8 space-y-6 pt-12 pr-16', 
    });
    
    // Type badge with gradient
    const typeBadge = createElement('div', {
      className: 'cc-badge cc-badge-success',
      textContent: this.getTypeLabel(),
    });
    (typeBadge as HTMLElement).style.cssText = `
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
      border: 1px solid rgba(99, 102, 241, 0.2);
      color: var(--cc-primary);
    `;
    sidebarHeader.appendChild(typeBadge);
    
    const metaTitle = createElement('h2', {
      className: 'text-2xl font-bold leading-tight tracking-tight text-cc-text-primary',
      textContent: this.getItemTitle(),
    });
    (metaTitle as HTMLElement).style.fontFamily = 'var(--cc-font-display)';
    sidebarHeader.appendChild(metaTitle);
    
    // Actions Row
    const actionRow = createElement('div', {
      className: 'flex gap-3 pt-2 relative',
    });
    
    const connectBtn = createElement('button', {
      className: 'cc-button flex-1 h-12 rounded-2xl flex items-center justify-center gap-2',
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <span>Connect App</span>
      `,
    });
    actionRow.appendChild(connectBtn);
    
    const actionsBtn = createElement('button', {
      className: 'cc-button cc-button-secondary w-12 h-12 p-0 flex items-center justify-center rounded-2xl relative z-[20]',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
      attributes: { 'id': this.triggerId },
    });
    this.addListener(actionsBtn, 'click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleActions();
    });
    actionRow.appendChild(actionsBtn);
    
    // Actions Dropdown - Apple-style glass dropdown
    const actionsDropdown = createElement('div', {
      className: 'cc-glass absolute right-0 top-full mt-3 w-56 p-2 rounded-2xl shadow-2xl z-[100] hidden flex-col overflow-hidden',
      attributes: { 'id': this.dropdownId },
    });
    (actionsDropdown as HTMLElement).style.background = 'rgba(26, 26, 38, 0.95)';
    
    const deleteBtn = createElement('button', {
      className: 'w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 transition-all rounded-xl flex items-center gap-3 border-none bg-transparent cursor-pointer font-medium',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Delete Note`,
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
      className: 'flex-1 overflow-y-auto cc-scrollbar p-8 space-y-6',
    });
    
    metadata.appendChild(this.createMetaSection('Date Published', formatFullDate(this.item.timestamp)));
    metadata.appendChild(this.createMetaSection('Time Indexed', formatTime(this.item.timestamp)));
    metadata.appendChild(this.createMetaSection('Content Source', this.item.source.charAt(0).toUpperCase() + this.item.source.slice(1)));
    
    if (this.item.type === 'transaction') {
      const tx = this.item.data as TellerTransaction;
      metadata.appendChild(this.createMetaSection('Transaction Amount', `$${Math.abs(parseFloat(tx.amount)).toFixed(2)}`));
      metadata.appendChild(this.createMetaSection('Financial Category', tx.details.category || 'N/A'));
    } else if (this.item.type === 'cast') {
      const cast = this.item.data as FarcasterCast;
      metadata.appendChild(this.createMetaSection('Author Handle', `@${cast.author.username}`));
    }
    
    sidebarPanel.appendChild(metadata);

    // Connections section - minimal integrated design
    const connectionsSection = createElement('div', {
      className: 'mt-auto border-t border-white/5 p-8 bg-linear-to-b from-transparent to-cc-void/20',
    });
    
    const connectionsHeader = createElement('div', {
      className: 'text-xs font-bold text-cc-text-muted uppercase tracking-widest mb-6',
      textContent: 'Connections (0)',
    });
    connectionsSection.appendChild(connectionsHeader);
    
    connectionsSection.innerHTML += `
      <div class="flex flex-col items-center justify-center py-6 text-center space-y-4">
        <div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-cc-text-muted">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
        <span class="text-xs font-medium text-cc-text-muted">Explore knowledge graph connections</span>
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
      // Handle Obsidian notes differently - use IPC
      if (this.item.type === 'obsidian-note') {
        const note = this.item.data as { path: string };
        const result = await window.obsidianVault.deleteNote(note.path);
        if (!result.success) {
          throw new Error(result.error || 'Failed to delete note');
        }
        // Remove from local obsidian notes store
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
      className: 'p-5 rounded-[1.25rem] bg-white/[0.03] border border-white/[0.05] space-y-2 transition-all hover:bg-white/[0.05] hover:border-white/[0.08] group',
    });
    section.innerHTML = `
      <div style="font-family: var(--cc-font-body); font-weight: 600; font-size: 0.625rem; letter-spacing: 0.12em;" class="text-cc-text-muted uppercase">${label}</div>
      <div style="font-family: var(--cc-font-body); font-weight: 500; font-size: 0.9375rem;" class="text-cc-text-primary group-hover:text-white transition-colors">${escapeHtml(value)}</div>
    `;
    return section;
  }

  private getTypeLabel(): string {
    switch (this.item.type) {
      case 'obsidian-note': return 'Knowledge Note';
      case 'cast': return 'Social Post';
      case 'transaction': return 'Financal Record';
      case 'browser-history': return 'Web Discovery';
      default: return 'Cortex Item';
    }
  }

  private getItemTitle(): string {
    switch (this.item.type) {
      case 'obsidian-note': return (this.item.data as { title: string }).title;
      case 'cast': return `@${(this.item.data as FarcasterCast).author.username}`;
      case 'transaction': return (this.item.data as TellerTransaction).description;
      case 'browser-history': return (this.item.data as BrowserHistoryEntry).title || 'Untitled Web Page';
      default: return 'Item Details';
    }
  }

  private renderMainContent(): HTMLElement {
    const wrapper = createElement('div', {
      className: 'w-full max-w-4xl mx-auto min-h-0',
    });

    switch (this.item.type) {
      case 'obsidian-note': {
        const note = this.item.data as { title: string; body: string; path: string; tags?: string[] };
        
        const article = createElement('article', { className: 'space-y-12 cc-animate-slideIn' });

        // Editorial header
        const header = createElement('header', { className: 'space-y-8 pb-12 border-b border-white/[0.08]' });
        header.innerHTML = `
          <div class="space-y-4">
            <h1 class="text-cc-text-primary leading-[1.05] tracking-tight" style="font-family: var(--cc-font-display); font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 700;">${escapeHtml(note.title)}</h1>
            <div class="flex items-center gap-4 text-cc-text-muted font-mono text-[10px] tracking-wider uppercase bg-white/[0.03] px-4 py-2 rounded-full w-fit">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>${escapeHtml(note.path)}</span>
            </div>
          </div>
        `;
        article.appendChild(header);

        // Content
        const bodyContainer = createElement('div', {
          className: 'markdown-content editorial-prose text-cc-text-secondary leading-relaxed cc-animate-fadeIn',
        });
        (bodyContainer as HTMLElement).style.animationDelay = '100ms';
        (bodyContainer as HTMLElement).style.fontFamily = 'var(--cc-font-body)';
        (bodyContainer as HTMLElement).style.fontSize = '1.125rem';
        bodyContainer.innerHTML = parseMarkdown(note.body);
        setupMarkdownInteractivity(bodyContainer);

        article.appendChild(bodyContainer);

        // Tags
        if (note.tags?.length) {
          const tagsContainer = createElement('div', {
            className: 'flex flex-wrap gap-3 pt-12 cc-animate-fadeIn'
          });
          (tagsContainer as HTMLElement).style.animationDelay = '200ms';
          tagsContainer.innerHTML = note.tags.map(t =>
            `<span class="px-4 py-2 bg-white/[0.03] border border-white/[0.06] text-cc-primary text-xs font-semibold rounded-full hover:bg-white/[0.06] transition-all cursor-pointer">#${escapeHtml(t)}</span>`
          ).join('');
          article.appendChild(tagsContainer);
        }

        wrapper.appendChild(article);
        break;
      }
        
      case 'cast': {
        const cast = this.item.data as FarcasterCast;
        const article = createElement('article', { className: 'max-w-2xl mx-auto space-y-10' });

        article.innerHTML = `
          <header class="flex items-center gap-5">
            <img src="${cast.author.pfp_url}" class="w-16 h-16 rounded-2xl shadow-2xl ring-2 ring-white/10" />
            <div>
              <div class="font-bold text-cc-text-primary text-xl tracking-tight" style="font-family: var(--cc-font-display)">${escapeHtml(cast.author.display_name)}</div>
              <div class="text-cc-text-muted font-medium">@${escapeHtml(cast.author.username)}</div>
            </div>
          </header>

          <div class="relative py-4">
            <div class="absolute -left-8 top-0 text-white/5 font-display font-black text-9xl select-none">“</div>
            <p class="text-cc-text-primary text-2xl leading-snug whitespace-pre-wrap relative z-10" style="font-family: var(--cc-font-body); font-weight: 450;">${escapeHtml(cast.text)}</p>
          </div>

          ${cast.embeds?.length ? `
            <div class="grid grid-cols-1 gap-6">
              ${cast.embeds.map(e => e.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ?
                `<img src="${e.url}" class="w-full rounded-[2rem] shadow-2xl border border-white/10" />` : ''
              ).join('')}
            </div>
          ` : ''}

          <div class="flex gap-8 pt-8 border-t border-white/[0.08]">
            <div class="flex items-center gap-2 text-cc-text-secondary">
              <span class="text-xl font-bold font-mono text-cc-primary">${cast.reactions?.likes_count || 0}</span>
              <span class="text-xs font-bold uppercase tracking-widest text-cc-text-muted">Likes</span>
            </div>
            <div class="flex items-center gap-2 text-cc-text-secondary">
              <span class="text-xl font-bold font-mono text-cc-secondary">${cast.reactions?.recasts_count || 0}</span>
              <span class="text-xs font-bold uppercase tracking-widest text-cc-text-muted">Recasts</span>
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
          <div class="h-full flex flex-col items-center justify-center text-center space-y-12">
            <div class="space-y-4">
              <div class="cc-badge ${amount > 0 ? 'cc-badge-success' : 'cc-badge-warning'} px-6 py-2 text-sm">${tx.details.category || 'Payment'}</div>
              <div class="text-cc-text-primary leading-none tracking-tighter" style="font-family: var(--cc-font-display); font-size: 8rem; font-weight: 800;">
                <span class="opacity-30 text-4xl align-top mr-2 mt-8 inline-block font-body">$</span>${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            
            <div class="max-w-xl space-y-2">
              <h2 class="text-3xl font-bold text-cc-text-primary tracking-tight" style="font-family: var(--cc-font-display)">${escapeHtml(tx.description)}</h2>
              <p class="text-cc-text-muted text-lg">${formatFullDate(this.item.timestamp)}</p>
            </div>

            <div class="w-full max-w-md grid grid-cols-2 gap-4 p-8 bg-white/[0.02] border border-white/[0.05] rounded-[2rem]">
              <div class="text-left space-y-1">
                <div class="text-[10px] font-bold text-cc-text-muted uppercase tracking-widest">Account</div>
                <div class="text-cc-text-primary font-medium">${escapeHtml(tx.account_id || 'Checking')}</div>
              </div>
              <div class="text-left space-y-1">
                <div class="text-[10px] font-bold text-cc-text-muted uppercase tracking-widest">Status</div>
                <div class="text-cc-success font-medium flex items-center gap-1.5">
                  <div class="w-1.5 h-1.5 rounded-full bg-cc-success animate-pulse"></div>
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
          <div class="h-full flex flex-col items-center justify-center text-center space-y-10">
            <div class="relative group">
              <div class="absolute inset-0 bg-cc-primary/20 blur-3xl rounded-full scale-150 group-hover:bg-cc-primary/30 transition-all"></div>
              <img src="${favicon}" class="w-32 h-32 rounded-3xl shadow-2xl relative z-10 border border-white/10 p-4 bg-cc-surface/50 backdrop-blur-xl" />
            </div>

            <div class="max-w-2xl space-y-4 relative z-10">
              <h1 class="text-4xl font-bold text-cc-text-primary leading-tight tracking-tight" style="font-family: var(--cc-font-display)">${escapeHtml(entry.title || 'Knowledge Discovery')}</h1>
              <a href="${entry.url}" target="_blank" class="inline-flex items-center gap-2 text-cc-primary hover:text-cc-secondary transition-colors font-mono text-sm bg-cc-primary/10 px-4 py-2 rounded-full">
                <span>${url.hostname}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          </div>
        `;
        break;
      }

      default:
        wrapper.innerHTML = `
          <div class="p-8 bg-white/[0.02] border border-white/[0.05] rounded-3xl">
            <pre class="cc-code-block">${escapeHtml(JSON.stringify(this.item.data, null, 2))}</pre>
          </div>
        `;
    }

    return wrapper;
  }
}

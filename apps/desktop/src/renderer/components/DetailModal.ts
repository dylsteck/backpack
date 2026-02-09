/**
 * DetailModal Component
 * Focused detail modal for timeline items — Mercury/Linear-inspired reading experience.
 * Narrow 640px layout, single close pill, clean per-type content.
 */

import { Component } from './Component';
import { createElement, formatFullDate, escapeHtml } from '../utils/dom';
import type { TimelineItem, FarcasterCast, TellerTransaction, BrowserHistoryEntry } from '../types';
import { parseMarkdown, setupMarkdownInteractivity } from '../utils/markdown';
import '../styles/chat-theme.css';

export class DetailModal extends Component {
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
      const result = await window.obsidianVault.readNote(note.path);
      if (result.success && result.note) {
        this.item.data = {
          ...(this.item.data as Record<string, unknown>),
          body: result.note.body,
          tags: result.note.tags,
        };
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

    const typeLabel = this.getTypeLabel();

    // Backdrop
    const backdrop = createElement('div', {
      className: 'fixed inset-0 bg-background/70 backdrop-blur-[6px] z-[100] flex items-center justify-center p-4 md:p-8 modal-backdrop-enter',
    });

    this.addListener(backdrop, 'click', (e: MouseEvent) => {
      if (e.target === backdrop) {
        this.cleanup();
        this.onClose();
      }
    });

    // Modal shell — narrow, focused
    const modal = createElement('div', {
      className: 'modal-shell modal-shell-detail flex flex-col elevation-2 modal-fade-scale-enter relative w-full max-w-[640px] max-h-[90vh] overflow-hidden',
      attributes: {
        'role': 'dialog',
        'aria-modal': 'true',
        'aria-label': `${typeLabel} detail`,
      },
    });

    // Close pill — floating, semi-transparent
    const closeBtn = createElement('button', {
      className: 'modal-close-pill',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
      attributes: { 'aria-label': 'Close' },
    });
    this.addListener(closeBtn, 'click', (e) => {
      e.stopPropagation();
      this.cleanup();
      this.onClose();
    });
    modal.appendChild(closeBtn);

    // Content area
    const contentArea = createElement('div', {
      className: 'flex-1 min-h-0 overflow-y-auto modal-scrollbar modal-content-enter',
    });

    const content = this.renderMainContent();
    contentArea.appendChild(content);
    modal.appendChild(contentArea);

    backdrop.appendChild(modal);
    this.container.appendChild(backdrop);

    // Auto-focus close button for keyboard users
    requestAnimationFrame(() => closeBtn.focus());

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

    if (this._escHandler) {
      window.removeEventListener('keydown', this._escHandler);
    }
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

  private renderMainContent(): HTMLElement {
    const wrapper = createElement('div', { className: 'w-full' });

    switch (this.item.type) {
      case 'obsidian-note': {
        const note = this.item.data as { title: string; body: string; path: string; tags?: string[] };

        const article = createElement('article', { className: 'py-10 px-8' });

        const header = createElement('header', { className: 'space-y-4 pb-8 border-b border-border/15' });
        header.innerHTML = `
          <h1 class="text-foreground leading-tight tracking-tight font-bold" style="font-family: var(--font-sans); font-size: clamp(1.5rem, 3vw, 2rem); line-height: 1.2; letter-spacing: -0.02em;">${escapeHtml(note.title)}</h1>
          <div class="text-muted-foreground text-xs flex items-center gap-2" style="font-family: var(--font-sans);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="opacity-60 shrink-0"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span class="truncate">${escapeHtml(note.path)}</span>
          </div>
        `;
        article.appendChild(header);

        // Content — strip frontmatter
        const cleanBody = note.body.replace(/^---\n[\s\S]*?\n---\n?/, '');

        const bodyContainer = createElement('div', {
          className: 'markdown-content modal-content-readable mt-8',
        });
        (bodyContainer as HTMLElement).style.cssText = `
          font-family: var(--font-sans);
          font-size: 0.9375rem;
          line-height: 1.8;
          letter-spacing: -0.003em;
        `;
        bodyContainer.innerHTML = parseMarkdown(cleanBody);
        setupMarkdownInteractivity(bodyContainer);
        article.appendChild(bodyContainer);

        if (note.tags?.length) {
          const tagsContainer = createElement('div', {
            className: 'flex flex-wrap gap-2 pt-8 mt-8 border-t border-border/15',
          });
          tagsContainer.innerHTML = note.tags.map(t =>
            `<span class="px-3 py-1.5 bg-primary/10 border border-primary/15 text-primary text-xs font-medium rounded-full hover:bg-primary/15 transition-colors cursor-pointer" style="font-family: var(--font-sans);">#${escapeHtml(t)}</span>`
          ).join('');
          article.appendChild(tagsContainer);
        }

        wrapper.appendChild(article);
        break;
      }

      case 'cast': {
        const cast = this.item.data as FarcasterCast;
        const article = createElement('article', { className: 'max-w-lg mx-auto py-10 px-6' });

        article.innerHTML = `
          <header class="flex items-center gap-3 pb-6">
            <img src="${cast.author.pfp_url}" class="w-12 h-12 rounded-full border border-border/20" alt="${escapeHtml(cast.author.display_name)}" />
            <div>
              <div class="text-lg text-foreground" style="font-family: var(--font-sans); font-weight: 600; line-height: 1.3;">${escapeHtml(cast.author.display_name)}</div>
              <div class="text-muted-foreground text-xs" style="font-family: var(--font-sans);">@${escapeHtml(cast.author.username)}</div>
            </div>
          </header>

          <div class="pb-6">
            <p class="text-foreground whitespace-pre-wrap font-normal" style="font-family: var(--font-sans); font-size: 15px; line-height: 1.75; letter-spacing: -0.005em;">${escapeHtml(cast.text)}</p>
          </div>

          ${cast.embeds?.length ? `
            <div class="grid grid-cols-1 gap-3 pb-6">
              ${cast.embeds.map(e => e.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ?
                `<img src="${e.url}" class="w-full rounded-lg border border-border/20" alt="Embedded image" />` : ''
              ).join('')}
            </div>
          ` : ''}

          <div class="flex gap-6 pt-4 border-t border-border/15">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-primary tabular-nums" style="font-family: var(--font-sans);">${cast.reactions?.likes_count || 0}</span>
              <span class="text-xs text-muted-foreground" style="font-family: var(--font-sans);">Likes</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-foreground tabular-nums" style="font-family: var(--font-sans);">${cast.reactions?.recasts_count || 0}</span>
              <span class="text-xs text-muted-foreground" style="font-family: var(--font-sans);">Recasts</span>
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
          <div class="flex flex-col items-center justify-center text-center py-16 px-8 space-y-8 max-w-md mx-auto">
            <!-- Category Badge -->
            <div class="inline-flex items-center px-3 py-1.5 rounded-full ${isPositive ? 'bg-green-500/10 border border-green-500/20 text-green-700' : 'bg-amber-500/10 border border-amber-500/20 text-amber-700'} text-[10px] font-semibold uppercase tracking-wider" style="font-family: var(--font-sans); letter-spacing: 0.1em;">
              ${escapeHtml(tx.details.category || 'Transaction')}
            </div>

            <!-- Amount -->
            <div class="text-foreground leading-none" style="font-family: var(--font-sans); font-size: clamp(2.5rem, 8vw, 4rem); font-weight: 700; letter-spacing: -0.02em;">
              <span class="opacity-40 text-[0.45em] align-top mr-1 mt-2 inline-block font-light">$</span>${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>

            <!-- Merchant Name -->
            <div class="space-y-2">
              <h2 class="text-lg text-foreground font-semibold" style="font-family: var(--font-sans); line-height: 1.3; letter-spacing: -0.01em;">${escapeHtml(tx.description)}</h2>
              <p class="text-sm text-muted-foreground" style="font-family: var(--font-sans);">${formatFullDate(this.item.timestamp)}</p>
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
          <div class="flex flex-col items-center justify-center text-center py-16 px-8 max-w-md mx-auto space-y-6">
            <div class="w-16 h-16 rounded-xl flex items-center justify-center bg-card border border-border/20">
              <img src="${favicon}" class="w-8 h-8 object-contain" alt="${escapeHtml(url.hostname)} favicon" />
            </div>

            <div class="space-y-3">
              <h1 class="text-xl text-foreground font-semibold" style="font-family: var(--font-sans); line-height: 1.3;">${escapeHtml(entry.title || 'Web Page')}</h1>
              <p class="text-sm text-muted-foreground" style="font-family: var(--font-sans);">${formatFullDate(this.item.timestamp)}</p>
            </div>

            <a href="${entry.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors text-sm" style="font-family: var(--font-sans);">
              <span class="truncate max-w-xs">${escapeHtml(url.hostname)}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        `;
        break;
      }

      default:
        wrapper.innerHTML = `
          <div class="p-8">
            <pre class="font-mono text-xs text-muted-foreground overflow-auto">${escapeHtml(JSON.stringify(this.item.data, null, 2))}</pre>
          </div>
        `;
    }

    return wrapper;
  }
}

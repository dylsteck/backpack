/**
 * DetailModal Component
 * Detailed modal for timeline items
 */

import { Component } from './Component';
import { createElement, formatFullDate, formatTime, escapeHtml, clearChildren } from '../utils/dom';
import type { TimelineItem, FarcasterCast, TellerTransaction, BrowserHistoryEntry, Comment } from '../types';
import { api } from '../api';
import { store } from '../store';

export class DetailModal extends Component {
  private activeTab: 'connections' | 'comments' = 'connections';
  private comments: Comment[] = [];
  private isLoadingComments = false;
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
    await this.loadComments();
  }

  private async loadComments(): Promise<void> {
    this.isLoadingComments = true;
    try {
      const result = await api.comments.listByItem.query({ itemId: this.item.id });
      this.comments = result.comments.map((c: { id: string; content: string; createdAt: string | Date; itemId: string }) => ({
        ...c,
        createdAt: new Date(c.createdAt),
      }));
      if (this.activeTab === 'comments') {
        this.renderTabContent();
      }
      this.updateCommentCount();
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      this.isLoadingComments = false;
    }
  }

  private updateCommentCount(): void {
    const commTab = this.container.querySelector('#comments-tab-btn');
    if (commTab) {
      commTab.textContent = `Comments (${this.comments.length})`;
    }
  }

  render(): void {
    this.container.innerHTML = '';
    
    // Hide app sidebar when modal is open
    const appSidebar = document.querySelector('[data-sidebar]');
    if (appSidebar) appSidebar.classList.add('hidden');
    
    // Backdrop
    const backdrop = createElement('div', {
      className: 'fixed inset-0 bg-background/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200',
    });
    
    // Close on backdrop click (if clicking precisely the backdrop)
    this.addListener(backdrop, 'click', (e: MouseEvent) => {
      if (e.target === backdrop) {
        this.cleanup();
        this.onClose();
      }
    });
    
    // Modal container
    const modal = createElement('div', {
      className: 'bg-background border border-border w-full max-w-6xl h-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl rounded-lg animate-in zoom-in-95 duration-200 relative',
    });
    
    // Close button
    const closeBtn = createElement('button', {
      className: 'absolute top-4 right-4 p-2 hover:bg-accent rounded-full transition-colors z-[200] text-muted-foreground hover:text-foreground',
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
      className: 'flex-1 h-full overflow-y-auto bg-card/30 flex items-center justify-center p-8 md:p-12',
    });
    
    const content = this.renderMainContent();
    contentArea.appendChild(content);
    modal.appendChild(contentArea);
    
    // RIGHT: Sidebar
    const sidebarPanel = createElement('aside', {
      className: 'w-full md:w-[380px] h-full border-l border-border bg-background flex flex-col relative',
    });
    
    // Sidebar Header
    const sidebarHeader = createElement('div', {
      className: 'p-6 border-b border-border space-y-4 pr-14', 
    });
    
    // Title/Type
    const typeLabel = createElement('div', {
      className: 'text-[10px] font-mono uppercase tracking-[0.2em] text-primary',
      textContent: this.item.type,
    });
    sidebarHeader.appendChild(typeLabel);
    
    const title = createElement('h2', {
      className: 'text-xl font-medium leading-tight',
      textContent: this.getItemTitle(),
    });
    sidebarHeader.appendChild(title);
    
    // Stats/Actions Row
    const actionRow = createElement('div', {
      className: 'flex gap-2 pt-2 relative',
    });
    
    // Only show connect button for non-user items
    if (this.item.source !== 'user') {
      const connectBtn = createElement('button', {
        className: 'flex-1 px-4 py-2 bg-foreground text-background text-xs font-mono uppercase tracking-wider rounded-sm hover:opacity-90 transition-opacity',
        textContent: 'Connect →',
      });
      actionRow.appendChild(connectBtn);
    }
    
    const actionsBtn = createElement('button', {
      className: `px-4 py-2 border border-border text-[11px] font-mono uppercase tracking-[0.1em] rounded-sm hover:bg-accent transition-all flex items-center gap-2 cursor-pointer bg-transparent relative z-[20] ${this.item.source === 'user' ? 'w-full justify-center py-3' : ''}`,
      innerHTML: `<span>Actions</span> <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>`,
      attributes: { 'id': this.triggerId },
    });
    this.addListener(actionsBtn, 'click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleActions();
    });
    actionRow.appendChild(actionsBtn);
    
    // Actions Dropdown - Inside actionRow but absolute
    const actionsDropdown = createElement('div', {
      className: 'absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-amber-500/50 rounded-md shadow-[0_20px_50px_rgba(0,0,0,1)] z-[100] hidden flex-col overflow-hidden',
      attributes: { 'id': this.dropdownId },
    });
    
    const deleteBtn = createElement('button', {
      className: 'w-full px-4 py-3 text-left text-[10px] font-mono uppercase tracking-wider text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2 border-none bg-transparent cursor-pointer',
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Delete Item`,
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
      className: 'flex-1 overflow-y-auto p-6 space-y-8',
    });
    
    metadata.appendChild(this.createMetaSection('Added', formatFullDate(this.item.timestamp)));
    metadata.appendChild(this.createMetaSection('Time', formatTime(this.item.timestamp)));
    metadata.appendChild(this.createMetaSection('Source', this.item.source));
    
    if (this.item.type === 'transaction') {
      const tx = this.item.data as TellerTransaction;
      metadata.appendChild(this.createMetaSection('Amount', `$${Math.abs(parseFloat(tx.amount)).toFixed(2)}`));
      metadata.appendChild(this.createMetaSection('Category', tx.details.category || 'N/A'));
    } else if (this.item.type === 'cast') {
      const cast = this.item.data as FarcasterCast;
      metadata.appendChild(this.createMetaSection('Author', `@${cast.author.username}`));
    }
    
    sidebarPanel.appendChild(metadata);

    // Tabs (Connections/Comments)
    const tabs = createElement('div', {
      className: 'mt-auto border-t border-border flex flex-col h-1/2 bg-background',
    });
    
    const tabHeaders = createElement('div', {
      className: 'flex border-b border-border px-6',
    });
    
    const connTab = createElement('button', {
      className: `py-4 text-[10px] font-mono uppercase tracking-wider px-4 -mb-px transition-colors ${this.activeTab === 'connections' ? 'border-b-2 border-foreground text-foreground' : 'text-muted-foreground'}`,
      textContent: 'Connections (0)',
      attributes: { 'id': 'connections-tab-btn' },
    });
    this.addListener(connTab, 'click', () => this.setTab('connections'));
    tabHeaders.appendChild(connTab);
    
    const commTab = createElement('button', {
      className: `py-4 text-[10px] font-mono uppercase tracking-wider px-4 -mb-px transition-colors ${this.activeTab === 'comments' ? 'border-b-2 border-foreground text-foreground' : 'text-muted-foreground'}`,
      textContent: `Comments (${this.comments.length})`,
      attributes: { 'id': 'comments-tab-btn' },
    });
    this.addListener(commTab, 'click', () => this.setTab('comments'));
    tabHeaders.appendChild(commTab);
    
    tabs.appendChild(tabHeaders);
    
    const tabContent = createElement('div', {
      className: 'flex-1 overflow-y-auto p-6 min-h-0',
      attributes: { 'id': 'tab-content' },
    });
    tabs.appendChild(tabContent);
    
    sidebarPanel.appendChild(tabs);
    
    modal.appendChild(sidebarPanel);
    backdrop.appendChild(modal);
    this.container.appendChild(backdrop);
    
    this.renderTabContent();

    // Close dropdown on click outside - use setTimeout to avoid immediate trigger
    setTimeout(() => {
      const closeDropdownHandler = (e: MouseEvent) => {
        const dropdown = document.getElementById(this.dropdownId);
        const triggerBtn = document.getElementById(this.triggerId);
        const target = e.target as Node;
        
        if (this.actionsOpen && dropdown && triggerBtn) {
          // Check if click is outside both the dropdown and the button
          if (!dropdown.contains(target) && !triggerBtn.contains(target)) {
            this.toggleActions(false);
          }
        }
      };
      document.addEventListener('click', closeDropdownHandler);
      
      // Store handler for cleanup
      this._closeDropdownHandler = closeDropdownHandler as EventListener;
    }, 0);

    // Add escape key listener
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
    // Restore app sidebar
    const appSidebar = document.querySelector('[data-sidebar]');
    if (appSidebar) appSidebar.classList.remove('hidden');
    
    // Remove document handlers
    if (this._closeDropdownHandler) {
      document.removeEventListener('click', this._closeDropdownHandler);
    }
    if (this._escHandler) {
      window.removeEventListener('keydown', this._escHandler);
    }
  }

  private setTab(tab: 'connections' | 'comments'): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    
    // Update button styles
    const connTab = this.container.querySelector('#connections-tab-btn');
    const commTab = this.container.querySelector('#comments-tab-btn');
    
    if (connTab) connTab.className = `py-4 text-[10px] font-mono uppercase tracking-wider px-4 -mb-px transition-colors ${tab === 'connections' ? 'border-b-2 border-foreground text-foreground' : 'text-muted-foreground'}`;
    if (commTab) commTab.className = `py-4 text-[10px] font-mono uppercase tracking-wider px-4 -mb-px transition-colors ${tab === 'comments' ? 'border-b-2 border-foreground text-foreground' : 'text-muted-foreground'}`;
    
    this.renderTabContent();
  }

  private renderTabContent(): void {
    const container = this.container.querySelector('#tab-content');
    if (!container) return;
    clearChildren(container as HTMLElement);

    if (this.activeTab === 'connections') {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-40">
          <div class="w-1.5 h-1.5 bg-border rounded-full"></div>
          <span class="text-[10px] font-mono uppercase tracking-wider">No connections found</span>
        </div>
      `;
    } else {
      // Comments Tab
      const wrapper = createElement('div', { className: 'flex flex-col h-full space-y-4' });
      
      // Comments List
      const list = createElement('div', { className: 'flex-1 space-y-4 min-h-0' });
      if (this.comments.length === 0) {
        list.innerHTML = `<div class="text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-center py-4">No comments yet</div>`;
      } else {
        for (const comment of this.comments) {
          const commentEl = createElement('div', { className: 'space-y-1' });
          commentEl.innerHTML = `
            <div class="flex justify-between items-center">
              <span class="text-[10px] font-mono text-muted-foreground">${formatTime(comment.createdAt instanceof Date ? comment.createdAt : new Date(comment.createdAt))}</span>
            </div>
            <div class="text-xs bg-card border border-border p-3 rounded-sm leading-relaxed">${escapeHtml(comment.content)}</div>
          `;
          list.appendChild(commentEl);
        }
      }
      wrapper.appendChild(list);
      
      // Add Comment Input
      const inputWrapper = createElement('div', { className: 'pt-4 border-t border-border mt-auto' });
      const input = createElement('textarea', {
        className: 'w-full bg-card border border-border rounded-sm p-3 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none',
        attributes: { placeholder: 'Write a comment...', rows: '2' },
      }) as HTMLTextAreaElement;
      
      this.addListener(input, 'keydown', async (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const content = input.value.trim();
          if (content) {
            await this.handleAddComment(content);
            input.value = '';
          }
        }
      });
      
      inputWrapper.appendChild(input);
      wrapper.appendChild(inputWrapper);
      container.appendChild(wrapper);
    }
  }

  private async handleAddComment(content: string): Promise<void> {
    try {
      const result = await api.comments.create.mutate({ itemId: this.item.id, content });
      if (result.success) {
        this.comments.push({
          ...result.comment,
          createdAt: new Date(result.comment.createdAt),
        });
        this.renderTabContent();
        this.updateCommentCount();
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
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
        triggerBtn.classList.add('bg-accent');
      } else {
        dropdown.classList.add('hidden');
        dropdown.style.display = 'none';
        triggerBtn.classList.remove('bg-accent');
      }
    }
  }

  private async handleDelete(): Promise<void> {
    const confirmed = confirm('Are you sure you want to delete this item?');
    if (!confirmed) return;

    try {
      if (this.item.source === 'user') {
        await api.notes.delete.mutate({ id: this.item.id });
      } else {
        // Generic delete for items table
        await api.timeline.deleteItem.mutate({ id: this.item.id });
      }
      
      // Update local store
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
      <div class="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">${label}</div>
      <div class="text-sm font-mono">${escapeHtml(value)}</div>
    `;
    return section;
  }

  private getItemTitle(): string {
    switch (this.item.type) {
      case 'note': return 'User Note';
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
      case 'note': {
        const note = this.item.data as { body: string };
        wrapper.className = 'w-full max-w-2xl h-full flex flex-col items-center justify-center p-8';
        
        const editorContainer = createElement('div', {
          className: 'w-full flex flex-col items-center space-y-8 p-12 rounded-3xl bg-card/30 border border-transparent hover:border-border transition-all duration-300 group',
        });

        const iconWrapper = createElement('div', {
          className: 'inline-flex p-6 bg-amber-500/10 rounded-3xl transition-transform group-hover:scale-110 duration-500',
          innerHTML: `
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" class="text-amber-500">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              <path d="m15 5 4 4"/>
            </svg>
          `
        });
        editorContainer.appendChild(iconWrapper);

        const editor = createElement('textarea', {
          className: 'w-full bg-transparent text-2xl md:text-3xl font-medium leading-relaxed text-foreground text-center focus:outline-none resize-none overflow-hidden h-auto py-4 placeholder:text-muted-foreground/20 selection:bg-amber-500/30',
          textContent: note.body,
          attributes: { spellcheck: 'false', placeholder: 'Start typing...' }
        }) as HTMLTextAreaElement;
        
        // Auto-resize textarea
        const adjustHeight = () => {
          editor.style.height = 'auto';
          editor.style.height = `${editor.scrollHeight}px`;
        };
        
        this.addListener(editor, 'input', () => {
          adjustHeight();
        });

        this.addListener(editor, 'blur', async () => {
          const newBody = editor.value.trim();
          if (newBody && newBody !== note.body) {
            try {
              note.body = newBody;
              await api.notes.create.mutate({ body: newBody });
            } catch (error) {
              console.error('Failed to save note update:', error);
            }
          }
        });

        editorContainer.appendChild(editor);
        wrapper.appendChild(editorContainer);
        
        setTimeout(adjustHeight, 0);
        break;
      }
        
      case 'cast': {
        const cast = this.item.data as FarcasterCast;
        wrapper.innerHTML = `
          <div class="space-y-6">
            <div class="flex items-center gap-4">
              <img src="${cast.author.pfp_url}" class="w-12 h-12 rounded-full border-2 border-border" />
              <div>
                <div class="font-medium text-lg">${escapeHtml(cast.author.display_name)}</div>
                <div class="text-muted-foreground font-mono">@${escapeHtml(cast.author.username)}</div>
              </div>
            </div>
            <p class="text-xl md:text-2xl leading-relaxed whitespace-pre-wrap">${escapeHtml(cast.text)}</p>
            ${cast.embeds?.length ? `
              <div class="grid grid-cols-1 gap-4 mt-4">
                ${cast.embeds.map(e => e.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? `<img src="${e.url}" class="rounded-lg border border-border max-h-[400px] object-contain" />` : '').join('')}
              </div>
            ` : ''}
          </div>
        `;
        break;
      }

      case 'transaction': {
        const tx = this.item.data as TellerTransaction;
        const amount = parseFloat(tx.amount);
        wrapper.innerHTML = `
          <div class="text-center space-y-8">
            <div class="text-6xl font-mono ${amount > 0 ? 'text-status-connected' : 'text-foreground'}">
              ${amount > 0 ? '+' : '-'}$${Math.abs(amount).toFixed(2)}
            </div>
            <div class="space-y-2">
              <h2 class="text-3xl font-medium">${escapeHtml(tx.description)}</h2>
              <p class="text-muted-foreground font-mono uppercase tracking-widest">${escapeHtml(tx.details.category || 'Uncategorized')}</p>
            </div>
            <div class="p-6 bg-card border border-border rounded-xl font-mono text-sm text-left grid grid-cols-2 gap-4">
              <div class="text-muted-foreground">Account</div><div>${escapeHtml(tx.account_id || 'Primary')}</div>
              <div class="text-muted-foreground">Status</div><div class="text-status-connected">Completed</div>
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
          // ignore
        }
        
        wrapper.innerHTML = `
          <div class="text-center space-y-8">
            <div class="inline-flex p-6 bg-card border border-border rounded-3xl">
              ${faviconUrl ? `<img src="${faviconUrl}" class="w-16 h-16" />` : '<div class="w-16 h-16 bg-muted rounded-full"></div>'}
            </div>
            <div class="space-y-4">
              <h2 class="text-3xl font-medium max-w-xl mx-auto">${escapeHtml(entry.title || 'Untitled Page')}</h2>
              <a href="${entry.url}" target="_blank" class="text-primary hover:underline font-mono truncate block max-w-lg mx-auto">
                ${escapeHtml(entry.url)}
              </a>
            </div>
          </div>
        `;
        break;
      }

      default:
        wrapper.innerHTML = `
          <div class="p-8 bg-card border border-border rounded-xl overflow-auto max-h-[60vh]">
            <pre class="text-xs font-mono">${escapeHtml(JSON.stringify(this.item.data, null, 2))}</pre>
          </div>
        `;
    }

    return wrapper;
  }
}

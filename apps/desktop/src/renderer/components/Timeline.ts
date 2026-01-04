/**
 * Timeline Component
 * Main timeline view with dual view modes (Timeline/Overview)
 * Highly refined modern design inspired by iPad aesthetic
 */

import { Component } from './Component';
import { store, actions } from '../store';
import { fetchTimeline, loadMoreTimeline, fetchAppsWithCache } from '../api';
import { createElement, clearChildren, formatTime, formatFullDate, groupByDate, escapeHtml } from '../utils/dom';
import type { TimelineItem, SourceType, FarcasterCast, TellerTransaction, BrowserHistoryEntry } from '../types';
import { DetailModal } from './DetailModal';
import { parseMarkdown, isMarkdown, setupMarkdownInteractivity } from '../utils/markdown';

type ViewMode = 'timeline' | 'overview';

interface DayGroup {
  date: Date;
  label: string;
  items: TimelineItem[];
  sources: Set<SourceType>;
  previewImages: string[];
  previewTexts: string[];
}

export class Timeline extends Component {
  private itemsContainer: HTMLElement | null = null;
  private loadMoreRef: HTMLElement | null = null;
  private observer: IntersectionObserver | null = null;
  private isLoadingMore = false;
  private iconUrls: Record<string, string | undefined> = {};
  
  // View mode state
  private viewMode: ViewMode = 'overview';
  private viewToggleContainer: HTMLElement | null = null;
  
  
  async init(): Promise<void> {
    const savedViewMode = localStorage.getItem('cortex-view-mode') as ViewMode;
    if (savedViewMode) this.viewMode = savedViewMode;
    
    this.render();
    this.setupEventDelegation();
    await this.loadAppsData();
    await this.loadInitialData();
    this.setupInfiniteScroll();
    
    // Subscriptions
    this.subscribe(store.timelineItems, () => this.renderItems());
    this.subscribe(store.selectedSources, () => this.renderItems());
    this.subscribe(store.obsidianNotes, () => this.renderItems());
    this.subscribe(store.timelineLoading, (loading) => {
      if (loading && store.timelineItems.get().length === 0) this.renderSkeleton();
      else if (!loading) this.renderItems();
    });
    
    this.loadBrowserHistory();
  }
  
  render(): void {
    this.container.innerHTML = '';
    
    const mainContainer = createElement('div', {
      className: 'flex flex-col h-full relative bg-gradient-soft',
    });
    
    // Header
    const header = this.createHeader();
    mainContainer.appendChild(header);
    
    // Scroll area
    const scrollArea = createElement('div', {
      className: 'flex-1 overflow-y-auto min-h-0 pt-4',
    });
    
    // Content wrapper
    const wrapper = createElement('div', {
      className: 'max-w-5xl mx-auto pb-32 px-6 md:px-10 relative w-full',
    });
    
    this.itemsContainer = createElement('div', {
      className: 'timeline-items relative',
    });
    wrapper.appendChild(this.itemsContainer);
    
    // Load more trigger
    this.loadMoreRef = createElement('div', { className: 'h-8' });
    wrapper.appendChild(this.loadMoreRef);
    
    scrollArea.appendChild(wrapper);
    mainContainer.appendChild(scrollArea);
    
    this.container.appendChild(mainContainer);
  }
  
  private createHeader(): HTMLElement {
    const header = createElement('header', {
      className: 'flex items-center justify-between px-8 py-6 z-20',
    });
    
    const leftSide = createElement('div', { className: 'flex flex-col gap-1' });
    
    const greeting = createElement('h1', {
      className: 'text-3xl font-semibold tracking-tight text-foreground/90',
      textContent: this.getGreeting(),
    });
    leftSide.appendChild(greeting);
    
    const subGreeting = createElement('p', {
      className: 'text-sm text-muted-foreground font-medium',
      textContent: 'What would you like to explore today?',
    });
    leftSide.appendChild(subGreeting);
    
    header.appendChild(leftSide);
    
    // View Toggle with glass morphism
    this.viewToggleContainer = createElement('div', {
      className: 'glass-panel flex items-center gap-1.5 p-1.5 rounded-2xl',
    });
    
    const modes: Array<{ id: ViewMode; icon: string }> = [
      { 
        id: 'overview', 
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>` 
      },
      { 
        id: 'timeline', 
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>` 
      }
    ];
    
    for (const mode of modes) {
      const btn = createElement('button', {
        className: `p-2.5 rounded-xl transition-all duration-300 ${this.viewMode === mode.id ? 'bg-card shadow-md text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`,
        innerHTML: mode.icon,
        attributes: { 'data-view': mode.id },
      });
      this.addListener(btn, 'click', () => this.setViewMode(mode.id));
      this.viewToggleContainer.appendChild(btn);
    }
    
    header.appendChild(this.viewToggleContainer);
    return header;
  }
  
  private getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
  
  private setViewMode(mode: ViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    localStorage.setItem('cortex-view-mode', mode);
    
    this.viewToggleContainer?.querySelectorAll('[data-view]').forEach(btn => {
      const isMatch = (btn as HTMLElement).dataset.view === mode;
      btn.className = `p-2.5 rounded-xl transition-all duration-300 ${isMatch ? 'bg-card shadow-md text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`;
    });
    
    this.renderItems();
  }
  
  private renderItems(): void {
    if (!this.itemsContainer) return;
    
    const allItems = this.getAllItems();
    const selectedSources = store.selectedSources.get();
    const filteredItems = selectedSources.includes('all') 
      ? allItems 
      : allItems.filter(i => selectedSources.includes(i.source));
    
    clearChildren(this.itemsContainer);
    
    if (filteredItems.length === 0) {
      this.renderEmptyState();
      return;
    }
    
    if (this.viewMode === 'overview') {
      this.renderOverview(filteredItems);
    } else {
      this.renderTimeline(filteredItems);
    }
  }
  
  // ============================================
  // OVERVIEW RENDERING
  // ============================================
  
  private renderOverview(items: TimelineItem[]): void {
    const groups = this.groupItemsByDay(items);
    const container = createElement('div', { className: 'space-y-12' });
    
    for (const group of groups) {
      const section = createElement('div', { className: 'overview-section' });
      
      const header = createElement('div', {
        className: 'flex items-center gap-2 mb-6 group cursor-pointer w-fit',
      });
      header.innerHTML = `
        <h2 class="text-2xl font-semibold text-foreground/80">${group.label}</h2>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/60 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1">
          <path d="M7 7h10v10"/><path d="M7 17 17 7"/>
        </svg>
      `;
      section.appendChild(header);
      
      const grid = createElement('div', {
        className: 'grid grid-cols-1 md:grid-cols-2 gap-6',
      });
      
      const mainCard = this.renderOverviewCard(group);
      grid.appendChild(mainCard);
      
      if (group.items.length > 2) {
        const secondaryCard = this.renderItemsOverviewCard(group);
        grid.appendChild(secondaryCard);
      }
      
      section.appendChild(grid);
      container.appendChild(section);
    }
    
    this.itemsContainer?.appendChild(container);
  }
  
  private renderOverviewCard(group: DayGroup): HTMLElement {
    const card = createElement('div', {
      className: 'card-modern card-elevated hover-float flex flex-col gap-4 min-h-[360px] cursor-pointer',
    });
    
    const content = createElement('div', { className: 'flex-1' });
    
    if (group.previewImages.length > 0) {
      const stack = this.renderImageStack(group.previewImages);
      content.appendChild(stack);
    } else {
      const textPreview = createElement('div', {
        className: 'bg-secondary/30 rounded-2xl p-5 space-y-3',
      });
      group.previewTexts.slice(0, 3).forEach(text => {
        textPreview.appendChild(createElement('p', {
          className: 'text-sm text-muted-foreground line-clamp-2',
          textContent: text,
        }));
      });
      content.appendChild(textPreview);
    }
    
    card.appendChild(content);
    
    const footer = createElement('div', { className: 'mt-auto' });
    footer.innerHTML = `
      <h3 class="text-lg font-semibold mb-1">${this.generateDayTitle(group)}</h3>
      <div class="flex items-center gap-3 mt-4 pt-4 border-t border-border/40">
        <div class="flex -space-x-2">
          ${Array.from(group.sources).map(s => this.getSourceIconSmall(s)).join('')}
        </div>
        <span class="text-xs text-muted-foreground font-medium">${group.items.length} items from ${this.formatSourceNames(group.sources)}</span>
      </div>
    `;
    
    card.appendChild(footer);
    this.addListener(card, 'click', () => this.openItemDetail(group.items[0]));
    
    return card;
  }
  
  private renderItemsOverviewCard(group: DayGroup): HTMLElement {
    const card = createElement('div', {
      className: 'card-modern bg-secondary/20 border-transparent p-0 overflow-hidden flex flex-col',
    });
    
    const header = createElement('div', {
      className: 'p-6 pb-2 flex items-center justify-between',
    });
    header.innerHTML = `
      <h3 class="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">Recent Activity</h3>
      <span class="text-xs font-mono text-muted-foreground/50">${group.items.length} items</span>
    `;
    card.appendChild(header);
    
    const scroll = createElement('div', {
      className: 'flex overflow-x-auto p-6 pt-2 gap-4 scrollbar-hide',
    });
    
    group.items.slice(1, 6).forEach(item => {
      const itemCard = createElement('div', {
        className: 'min-w-[200px] bg-card border border-border/40 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer',
      });
      
      const title = this.extractPreviewText(item) || 'Untitled';
      itemCard.innerHTML = `
        <div class="flex items-center gap-2 mb-3">
          ${this.getSourceIconSmall(item.source)}
          <span class="text-[10px] uppercase font-bold text-muted-foreground/60">${item.type}</span>
        </div>
        <p class="text-sm font-medium line-clamp-3 leading-relaxed">${escapeHtml(title)}</p>
        <p class="text-[10px] text-muted-foreground mt-3">${formatTime(item.timestamp)}</p>
      `;
      
      this.addListener(itemCard, 'click', (e) => {
        e.stopPropagation();
        this.openItemDetail(item);
      });
      scroll.appendChild(itemCard);
    });
    
    card.appendChild(scroll);
    return card;
  }
  
  // ============================================
  // TIMELINE RENDERING
  // ============================================
  
  private renderTimeline(items: TimelineItem[]): void {
    const grouped = groupByDate(items);
    const container = createElement('div', { className: 'space-y-10' });
    
    for (const [dateKey, dayItems] of grouped) {
      const dayWrapper = createElement('div', { className: 'relative' });
      
      const dateHeader = createElement('div', {
        className: 'flex items-center gap-4 mb-8',
      });
      dateHeader.innerHTML = `
        <span class="text-sm font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">${formatFullDate(new Date(dateKey))}</span>
        <div class="flex-1 h-[1.5px] bg-border/30"></div>
      `;
      dayWrapper.appendChild(dateHeader);
      
      const itemsList = createElement('div', { className: 'space-y-12 relative' });
      
      dayItems.forEach((item, index) => {
        const entry = createElement('div', {
          className: 'timeline-entry relative pl-16 min-h-[80px]',
          dataset: { entryId: item.id },
        });
        
        if (index < dayItems.length - 1) {
          const line = createElement('div', { className: 'timeline-line' });
          entry.appendChild(line);
        }
        
        const dot = createElement('div', { className: 'timeline-dot hover:glow-primary transition-all' });
        dot.innerHTML = this.getSourceIconLarge(item.source);
        entry.appendChild(dot);

        const card = createElement('div', {
          className: 'card-modern card-elevated hover-lift group cursor-pointer transition-smooth',
          dataset: { clickable: 'true' },
        });
        
        const header = createElement('div', { className: 'flex items-center justify-between mb-4' });
        header.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-primary uppercase tracking-wider">${item.type}</span>
            <span class="text-muted-foreground/30">•</span>
            <span class="text-xs font-medium text-muted-foreground">${formatTime(item.timestamp)}</span>
          </div>
          <div class="opacity-0 group-hover:opacity-100 transition-opacity">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </div>
        `;
        card.appendChild(header);
        
        const content = this.renderItemContent(item);
        card.appendChild(content);
        
        entry.appendChild(card);
        itemsList.appendChild(entry);
      });
      
      dayWrapper.appendChild(itemsList);
      container.appendChild(dayWrapper);
    }
    
    this.itemsContainer?.appendChild(container);
  }
  
  // ============================================
  // HELPERS
  // ============================================
  
  private getSourceIconSmall(source: SourceType): string {
    const url = this.iconUrls[source];
    return url ? `<img src="${url}" class="w-5 h-5 rounded-md" />` : `<div class="w-5 h-5 bg-muted rounded-md"></div>`;
  }
  
  private getSourceIconLarge(source: SourceType): string {
    const url = this.iconUrls[source];
    return url ? `<img src="${url}" class="w-6 h-6 rounded-lg" />` : `<div class="w-6 h-6 bg-muted rounded-lg"></div>`;
  }
  
  private formatSourceNames(sources: Set<SourceType>): string {
    const names = Array.from(sources).map(s => s.charAt(0).toUpperCase() + s.slice(1));
    if (names.length <= 2) return names.join(' and ');
    return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
  }
  
  private async loadAppsData(): Promise<void> {
    try {
      const apps = await fetchAppsWithCache();
      this.iconUrls = {
        farcaster: apps.find(a => a.id === 'farcaster')?.iconUrl,
        chrome: apps.find(a => a.id === 'chrome')?.iconUrl,
        brave: apps.find(a => a.id === 'brave')?.iconUrl,
        teller: apps.find(a => a.id === 'teller')?.iconUrl,
        obsidian: apps.find(a => a.id === 'obsidian')?.iconUrl,
      };
    } catch {
      // Ignore
    }
  }
  
  private async loadInitialData(): Promise<void> {
    try {
      const result = await fetchTimeline(25);
      actions.appendTimelineItems(result.items);
      actions.setTimelineCursor(result.nextCursor || null);
      this.renderItems();
    } catch {
      // Ignore
    }
  }
  
  private getAllItems(): TimelineItem[] {
    const server = store.timelineItems.get();
    const chrome = (store.chromeHistory.get() || []) as BrowserHistoryEntry[];
    const brave = (store.braveHistory.get() || []) as BrowserHistoryEntry[];
    const obsidian = store.obsidianNotes.get() || [];
    
    const chromeItems: TimelineItem[] = chrome.map(e => ({
      id: `chrome-${e.url}-${e.timestamp}`,
      timestamp: new Date(e.timestamp),
      source: 'chrome' as SourceType,
      type: 'browser-history',
      data: e,
    }));
    
    const braveItems: TimelineItem[] = brave.map(e => ({
      id: `brave-${e.url}-${e.timestamp}`,
      timestamp: new Date(e.timestamp),
      source: 'brave' as SourceType,
      type: 'browser-history',
      data: e,
    }));
    
    const obsidianItems: TimelineItem[] = obsidian.map(n => ({
      id: `obsidian-${n.path}`,
      timestamp: new Date(n.mtime),
      source: 'obsidian' as SourceType,
      type: 'obsidian-note',
      data: n,
    }));
    
    return [...server, ...chromeItems, ...braveItems, ...obsidianItems].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  private groupItemsByDay(items: TimelineItem[]): DayGroup[] {
    const groups = new Map<string, DayGroup>();
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    for (const item of items) {
      const date = new Date(item.timestamp);
      const key = date.toDateString();
      if (!groups.has(key)) {
        const labelText = key === today ? 'Today' : key === yesterday ? 'Yesterday' : date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        groups.set(key, { date, label: labelText, items: [], sources: new Set(), previewImages: [], previewTexts: [] });
      }
      const g = groups.get(key)!;
      g.items.push(item);
      g.sources.add(item.source);
      if (g.previewImages.length < 3) {
        const img = this.extractImageUrl(item);
        if (img) g.previewImages.push(img);
      }
      if (g.previewTexts.length < 3) {
        const text = this.extractPreviewText(item);
        if (text) g.previewTexts.push(text);
      }
    }
    return Array.from(groups.values());
  }
  
  private extractImageUrl(item: TimelineItem): string | null {
    if (item.type === 'cast') return (item.data as FarcasterCast).author.pfp_url || null;
    return null;
  }
  
  private extractPreviewText(item: TimelineItem): string | null {
    if (item.type === 'cast') return (item.data as FarcasterCast).text.slice(0, 100);
    if (item.type === 'browser-history') return (item.data as BrowserHistoryEntry).title || (item.data as BrowserHistoryEntry).url;
    if (item.type === 'transaction') return (item.data as TellerTransaction).description;
    if (item.type === 'obsidian-note') return (item.data as { title: string; body: string }).body.slice(0, 100);
    return null;
  }
  
  private renderImageStack(images: string[]): HTMLElement {
    const stack = createElement('div', { className: 'h-40 relative w-full overflow-hidden rounded-2xl bg-secondary/30' });
    images.slice(0, 3).forEach((url, i) => {
      const img = createElement('img', {
        className: 'absolute rounded-xl shadow-lg border border-border/40 object-cover w-32 h-40 transition-transform duration-500 hover:scale-105',
        attributes: { src: url, style: `left: ${i * 40 + 20}px; top: ${i * 10 + 10}px; transform: rotate(${i * 3 - 3}deg); z-index: ${3-i};` },
      });
      stack.appendChild(img);
    });
    return stack;
  }
  
  private generateDayTitle(group: DayGroup): string {
    const counts: Record<string, number> = {};
    group.items.forEach(i => counts[i.type] = (counts[i.type] || 0) + 1);
    const parts = [];
    if (counts['cast']) parts.push(`${counts['cast']} post${counts['cast'] !== 1 ? 's' : ''}`);
    if (counts['transaction']) parts.push(`${counts['transaction']} tx`);
    if (counts['obsidian-note']) parts.push(`${counts['obsidian-note']} note${counts['obsidian-note'] !== 1 ? 's' : ''}`);
    return parts.length ? parts.slice(0, 2).join(', ') : `${group.items.length} items`;
  }
  
  private renderItemContent(item: TimelineItem): HTMLElement {
    const text = this.extractPreviewText(item) || 'No preview available';

    // Check if content is markdown (for Obsidian notes)
    if (item.type === 'obsidian-note' && isMarkdown(text)) {
      const wrapper = createElement('div', { className: 'markdown-content text-sm leading-relaxed' });
      // Limit to first 200 chars for preview
      const preview = text.length > 200 ? text.substring(0, 200) + '...' : text;
      wrapper.innerHTML = parseMarkdown(preview);
      // Setup interactivity for wikilinks and hashtags
      setupMarkdownInteractivity(wrapper);
      return wrapper;
    }

    // Regular text content
    const wrapper = createElement('div', { className: 'text-sm leading-relaxed' });
    wrapper.textContent = text;
    return wrapper;
  }
  
  private renderSkeleton(): void {
    if (!this.itemsContainer) return;
    clearChildren(this.itemsContainer);
    for (let i = 0; i < 3; i++) {
      const s = createElement('div', { className: 'mb-10 space-y-4' });
      s.innerHTML = `<div class="skeleton h-8 w-40 rounded-xl"></div><div class="card-modern skeleton h-64 w-full"></div>`;
      this.itemsContainer.appendChild(s);
    }
  }
  
  private renderEmptyState(): void {
    if (!this.itemsContainer) return;
    this.itemsContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center py-32 text-center opacity-50">
        <div class="w-24 h-24 rounded-full bg-secondary mb-6 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <h3 class="text-xl font-semibold">Your timeline is quiet</h3>
        <p class="text-sm mt-2 max-w-xs">Connect more apps to see your day unfold here.</p>
      </div>
    `;
  }
  
  private openItemDetail(item: TimelineItem): void {
    const modalContainer = createElement('div', { attributes: { id: 'detail-modal-portal' } });
    document.body.appendChild(modalContainer);
    const modal = new DetailModal(modalContainer, item, () => {
      modal.destroy();
      modalContainer.remove();
    });
    modal.init();
  }
  
  private async loadBrowserHistory(): Promise<void> {
    const apps = store.apps.get();
    const chrome = apps.find(a => a.id === 'chrome');
    if (chrome?.connection?.status === 'connected' && chrome.connection.connectionMetadata?.localPath) {
      const res = await window.chromeHistory.readHistory(chrome.connection.connectionMetadata.localPath);
      if (res.success && res.data) actions.setChromeHistory(res.data);
    }
    const brave = apps.find(a => a.id === 'brave');
    if (brave?.connection?.status === 'connected' && brave.connection.connectionMetadata?.localPath) {
      const res = await window.braveHistory.readHistory(brave.connection.connectionMetadata.localPath);
      if (res.success && res.data) actions.setBraveHistory(res.data);
    }
    
    // Load Obsidian notes if connected
    const obsidian = apps.find(a => a.id === 'obsidian');
    if (obsidian?.connection?.status === 'connected' && obsidian.connection.connectionMetadata?.localPath) {
      const res = await window.obsidianVault.readVault(obsidian.connection.connectionMetadata.localPath);
      if (res.success && res.notes) actions.setObsidianNotes(res.notes);
    }
  }
  
  private setupInfiniteScroll(): void {
    if (!this.loadMoreRef) return;
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !this.isLoadingMore && store.timelineCursor.get()) {
        this.isLoadingMore = true;
        loadMoreTimeline().finally(() => this.isLoadingMore = false);
      }
    }, { rootMargin: '400px' });
    this.observer.observe(this.loadMoreRef);
    this.registerCleanup(() => this.observer?.disconnect());
  }
  
  protected setupEventDelegation(): void {
    this.addListener(this.container, 'click', (e) => {
      const target = e.target as HTMLElement;
      const clickable = target.closest('[data-clickable]');
      if (clickable) {
        const entry = clickable.closest('[data-entry-id]') as HTMLElement;
        if (entry?.dataset.entryId) {
          const item = this.getAllItems().find(i => i.id === entry.dataset.entryId);
          if (item) this.openItemDetail(item);
        }
      }
    }, { capture: true });
  }
}

export default Timeline;

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
      className: 'card-modern card-elevated hover-float flex flex-col gap-6 min-h-[400px] cursor-pointer border-l-4 border-l-primary/30 relative overflow-hidden',
    });

    // Subtle gradient overlay
    const gradientOverlay = createElement('div', {
      className: 'absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none',
    });
    card.appendChild(gradientOverlay);

    const content = createElement('div', { className: 'flex-1 relative z-10' });

    if (group.previewImages.length > 0) {
      const stack = this.renderImageStack(group.previewImages);
      content.appendChild(stack);
    } else {
      const textPreview = createElement('div', {
        className: 'bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-2xl p-6 space-y-4 border border-border/30',
      });
      group.previewTexts.slice(0, 3).forEach((text, index) => {
        textPreview.appendChild(createElement('p', {
          className: `text-sm ${index === 0 ? 'text-foreground/90 font-medium' : 'text-muted-foreground'} line-clamp-2 leading-relaxed`,
          textContent: text,
        }));
      });
      content.appendChild(textPreview);
    }

    card.appendChild(content);

    const footer = createElement('div', { className: 'mt-auto relative z-10' });
    footer.innerHTML = `
      <h3 class="text-xl font-semibold mb-2 tracking-tight">${this.generateDayTitle(group)}</h3>
      <div class="flex items-center gap-3 mt-5 pt-5 border-t border-border/50">
        <div class="flex -space-x-2.5">
          ${Array.from(group.sources).map(s => `<div class="w-7 h-7 rounded-lg border-2 border-card overflow-hidden shadow-sm">${this.getSourceIconSmall(s)}</div>`).join('')}
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-xs font-semibold text-foreground">${group.items.length} items</span>
          <span class="text-[10px] text-muted-foreground/70 uppercase tracking-wider">${this.formatSourceNames(group.sources)}</span>
        </div>
      </div>
    `;

    card.appendChild(footer);
    this.addListener(card, 'click', () => this.openItemDetail(group.items[0]));

    return card;
  }
  
  private renderItemsOverviewCard(group: DayGroup): HTMLElement {
    const card = createElement('div', {
      className: 'card-modern bg-gradient-to-br from-secondary/30 to-secondary/10 border border-border/40 p-0 overflow-hidden flex flex-col relative',
    });

    // Subtle accent line
    const accentLine = createElement('div', {
      className: 'absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-primary/40 via-primary/20 to-transparent',
    });
    card.appendChild(accentLine);

    const header = createElement('div', {
      className: 'p-6 pb-3 flex items-center justify-between relative z-10',
    });
    header.innerHTML = `
      <h3 class="text-xs font-bold uppercase tracking-[0.15em] text-foreground/70">Recent Activity</h3>
      <div class="px-2 py-1 bg-primary/10 rounded-lg">
        <span class="text-[10px] font-bold text-primary">${group.items.length}</span>
      </div>
    `;
    card.appendChild(header);

    const scroll = createElement('div', {
      className: 'flex overflow-x-auto p-6 pt-3 gap-4 scrollbar-hide relative z-10',
    });

    group.items.slice(1, 6).forEach(item => {
      const itemCard = createElement('div', {
        className: 'min-w-[220px] bg-card border border-border/60 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:scale-[1.03] hover:border-primary/30 transition-all cursor-pointer group',
      });

      const title = this.extractPreviewText(item) || 'Untitled';
      itemCard.innerHTML = `
        <div class="flex items-center gap-2.5 mb-4">
          <div class="w-6 h-6 rounded-lg overflow-hidden shadow-sm ring-1 ring-border/50">
            ${this.getSourceIconSmall(item.source)}
          </div>
          <span class="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/60 bg-muted/50 px-2 py-1 rounded-md">${item.type}</span>
        </div>
        <p class="text-sm font-semibold line-clamp-3 leading-relaxed mb-3 group-hover:text-primary transition-colors">${escapeHtml(title)}</p>
        <div class="flex items-center gap-1.5">
          <div class="w-1 h-1 rounded-full bg-primary/40"></div>
          <p class="text-[10px] text-muted-foreground/80 font-medium">${formatTime(item.timestamp)}</p>
        </div>
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
        className: 'flex flex-col gap-3 mb-10',
      });
      dateHeader.innerHTML = `
        <h2 style="font-family: var(--font-display); font-weight: 700; font-size: 2.5rem; letter-spacing: -0.02em; line-height: 1.1;" class="text-foreground">${formatFullDate(new Date(dateKey))}</h2>
        <div class="flex items-center gap-4">
          <div class="flex-1 h-[2px] bg-linear-to-r from-primary/40 via-primary/20 to-transparent"></div>
          <span class="text-xs uppercase tracking-[0.15em] text-muted-foreground/50 font-medium" style="font-family: var(--font-sans);">${dayItems.length} ${dayItems.length === 1 ? 'item' : 'items'}</span>
        </div>
      `;
      dayWrapper.appendChild(dateHeader);
      
      const itemsList = createElement('div', { className: 'space-y-12 relative' });
      
      dayItems.forEach((item, index) => {
        // Determine pattern variation (cycle through 3 patterns)
        const patternIndex = index % 3;
        const patternClass = `timeline-entry-pattern-${['a', 'b', 'c'][patternIndex]}`;

        // Determine source type for contextual styling
        const sourceType = item.source === 'farcaster' ? 'social' :
                          item.source === 'obsidian' ? 'notes' :
                          item.source === 'teller' ? 'financial' : 'browser';

        const entry = createElement('div', {
          className: `timeline-entry relative pl-16 min-h-[80px] ${patternClass} stagger-item`,
          dataset: {
            entryId: item.id,
            index: index.toString(),
            sourceType: sourceType
          },
        });

        // Timeline connecting line with gradient fade
        if (index < dayItems.length - 1) {
          const line = createElement('div', { className: 'timeline-line' });
          entry.appendChild(line);
        }

        // Enhanced timeline dot with contextual styling
        const dotClasses = `timeline-dot timeline-dot-${sourceType} hover:glow-primary transition-all shadow-lg shadow-primary/20 relative ring-pulse`;
        const dot = createElement('div', { className: dotClasses });
        dot.innerHTML = this.getSourceIconLarge(item.source);
        entry.appendChild(dot);

        // Timeline card with editorial lift effect
        const card = createElement('div', {
          className: 'card-modern card-elevated hover-editorial group cursor-pointer transition-smooth relative texture-noise',
          dataset: { clickable: 'true' },
        });

        // Card header with enhanced typography
        const header = createElement('div', { className: 'flex items-center justify-between mb-5' });
        header.innerHTML = `
          <div class="flex items-center gap-3">
            <span class="font-body text-xs font-bold text-primary uppercase tracking-[0.12em] px-2 py-1 bg-primary/10 rounded-lg">${item.type}</span>
            <span class="text-muted-foreground/40">•</span>
            <span class="font-body text-xs font-medium text-muted-foreground">${formatTime(item.timestamp)}</span>
          </div>
          <div class="opacity-0 group-hover:opacity-100 transition-opacity">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </div>
        `;
        card.appendChild(header);

        // Content with pattern-specific layout
        const contentWrapper = createElement('div', { className: 'timeline-content' });
        const content = this.renderItemContent(item);
        contentWrapper.appendChild(content);
        card.appendChild(contentWrapper);

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

/**
 * Timeline Component
 * Main timeline view with infinite scroll and virtual scrolling for performance
 * Following the performance guide patterns
 */

import { Component } from './Component';
import { store, actions } from '../store';
import { fetchTimeline, loadMoreTimeline, fetchAppsWithCache } from '../api';
import { createElement, clearChildren, formatTime, formatDate, formatFullDate, groupByDate, escapeHtml } from '../utils/dom';
import type { TimelineItem, SourceType, FarcasterCast, TellerTransaction, BrowserHistoryEntry } from '../types';

export class Timeline extends Component {
  private itemsContainer: HTMLElement | null = null;
  private loadMoreRef: HTMLElement | null = null;
  private observer: IntersectionObserver | null = null;
  private isLoadingMore = false;
  private iconUrls: Record<string, string | undefined> = {};
  
  async init(): Promise<void> {
    this.render();
    
    // Set up event delegation for clicks FIRST - before any async operations
    // This ensures clicks work even if items render via subscriptions
    this.setupEventDelegation();
    
    // Load apps data for icon URLs
    await this.loadAppsData();
    
    // Load initial timeline data
    await this.loadInitialData();
    
    // Set up infinite scroll
    this.setupInfiniteScroll();
    
    // Subscribe to store changes
    this.subscribe(store.timelineItems, () => this.renderItems());
    this.subscribe(store.expandedItemId, () => this.updateExpandedStates());
    this.subscribe(store.selectedSources, () => this.renderItems());
    
    // Load browser history via IPC
    this.loadBrowserHistory();
  }
  
  render(): void {
    this.container.innerHTML = '';
    // Don't override container className - it has overflow-y-auto from Layout
    
    // Create inner wrapper for timeline content
    const wrapper = createElement('div', {
      className: 'max-w-3xl mx-auto pb-3 px-3 space-y-6 relative w-full',
    });
    
    // Vertical timeline line
    const timelineLine = createElement('div', {
      className: 'timeline-line absolute left-[calc(0.75rem+9.5px)] top-[calc(0.25rem+0.375rem+0.25rem+9.5px)] bottom-0 w-0.5 bg-border z-0 hidden',
    });
    wrapper.appendChild(timelineLine);
    
    // Items container (with small top padding)
    this.itemsContainer = createElement('div', {
      className: 'timeline-items space-y-6 pt-2',
    });
    wrapper.appendChild(this.itemsContainer);
    
    // Load more trigger element
    this.loadMoreRef = createElement('div', {
      className: 'h-4',
    });
    wrapper.appendChild(this.loadMoreRef);
    
    // Loading indicator
    const loadingIndicator = createElement('div', {
      className: 'loading-more hidden text-sm text-muted-foreground text-center py-4 font-mono uppercase tracking-wider',
      textContent: 'Loading more...',
    });
    wrapper.appendChild(loadingIndicator);
    
    this.container.appendChild(wrapper);
  }
  
  private async loadAppsData(): Promise<void> {
    try {
      const apps = await fetchAppsWithCache();
      this.iconUrls = {
        farcaster: apps.find(a => a.id === 'farcaster')?.iconUrl,
        chrome: apps.find(a => a.id === 'chrome')?.iconUrl,
        brave: apps.find(a => a.id === 'brave')?.iconUrl,
        teller: apps.find(a => a.id === 'teller')?.iconUrl,
      };
    } catch (error) {
      console.error('Failed to load apps data:', error);
    }
  }
  
  private async loadInitialData(): Promise<void> {
    // Show loading state
    if (this.itemsContainer) {
      this.itemsContainer.innerHTML = `
        <div class="text-sm text-muted-foreground py-8 text-center font-mono uppercase tracking-wider">
          Loading timeline...
        </div>
      `;
    }
    
    try {
      const result = await fetchTimeline(25);
      actions.appendTimelineItems(result.items);
      actions.setTimelineCursor(result.nextCursor || null);
    } catch {
      if (this.itemsContainer) {
        this.itemsContainer.innerHTML = `
          <div class="flex items-center justify-center py-12">
            <div class="text-status-error font-mono uppercase tracking-wider text-sm">Failed to load timeline</div>
          </div>
        `;
      }
    }
  }
  
  private loadBrowserHistory(): void {
    // Chrome history
    const chromeApp = store.apps.get().find(a => a.id === 'chrome');
    if (chromeApp?.connection?.status === 'connected' && chromeApp.connection.connectionMetadata?.localPath) {
      this.loadHistoryWithRetry('chrome', chromeApp.connection.connectionMetadata.localPath);
    }
    
    // Brave history
    const braveApp = store.apps.get().find(a => a.id === 'brave');
    if (braveApp?.connection?.status === 'connected' && braveApp.connection.connectionMetadata?.localPath) {
      this.loadHistoryWithRetry('brave', braveApp.connection.connectionMetadata.localPath);
    }
  }
  
  private async loadHistoryWithRetry(browser: 'chrome' | 'brave', localPath: string): Promise<void> {
    const api = browser === 'chrome' ? window.chromeHistory : window.braveHistory;
    
    if (!api || typeof api.readHistory !== 'function') {
      // Retry with polling
      let attempts = 0;
      const maxAttempts = 15;
      
      this.registerInterval(() => {
        attempts++;
        const currentApi = browser === 'chrome' ? window.chromeHistory : window.braveHistory;
        
        if (currentApi && typeof currentApi.readHistory === 'function') {
          this.readBrowserHistory(browser, localPath);
        } else if (attempts >= maxAttempts) {
          console.warn(`[Timeline] ${browser} history API not available after ${maxAttempts} attempts`);
        }
      }, 2000);
      
      return;
    }
    
    await this.readBrowserHistory(browser, localPath);
  }
  
  private async readBrowserHistory(browser: 'chrome' | 'brave', localPath: string): Promise<void> {
    try {
      const api = browser === 'chrome' ? window.chromeHistory : window.braveHistory;
      const result = await api.readHistory(localPath);
      
      if (result.success && result.data) {
        if (browser === 'chrome') {
          actions.setChromeHistory(result.data);
        } else {
          actions.setBraveHistory(result.data);
        }
        this.renderItems();
      }
    } catch (error) {
      console.error(`Error reading ${browser} history:`, error);
    }
  }
  
  private setupInfiniteScroll(): void {
    if (!this.loadMoreRef) return;
    
    this.observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && !this.isLoadingMore) {
          this.loadMore();
        }
      },
      {
        root: null,
        rootMargin: '200px',
      }
    );
    
    this.observer.observe(this.loadMoreRef);
    
    this.registerCleanup(() => {
      this.observer?.disconnect();
    });
  }
  
  private async loadMore(): Promise<void> {
    if (this.isLoadingMore || !store.timelineCursor.get()) return;
    
    this.isLoadingMore = true;
    this.showLoadingMore(true);
    
    try {
      await loadMoreTimeline();
    } finally {
      this.isLoadingMore = false;
      this.showLoadingMore(false);
    }
  }
  
  private showLoadingMore(show: boolean): void {
    const indicator = this.container.querySelector('.loading-more');
    if (indicator) {
      indicator.classList.toggle('hidden', !show);
    }
  }
  
  private renderItems(): void {
    if (!this.itemsContainer) return;
    
    // Get all items including browser history
    const allItems = this.getAllItems();
    const selectedSources = store.selectedSources.get();
    
    // Filter by selected sources
    const filteredItems = selectedSources.includes('all')
      ? allItems
      : allItems.filter(item => selectedSources.includes(item.source));
    
    // Show/hide timeline line
    const timelineLine = this.container.querySelector('.timeline-line');
    if (timelineLine) {
      timelineLine.classList.toggle('hidden', filteredItems.length === 0);
    }
    
    // Clear and re-render
    clearChildren(this.itemsContainer);
    
    if (filteredItems.length === 0) {
      this.renderEmptyState(allItems.length > 0);
      return;
    }
    
    // Group by date
    const groupedItems = groupByDate(filteredItems);
    
    // Render each date group
    for (const [dateKey, items] of groupedItems) {
      const dateSection = this.renderDateSection(new Date(dateKey), items);
      this.itemsContainer.appendChild(dateSection);
    }
  }
  
  private getAllItems(): TimelineItem[] {
    const serverItems = store.timelineItems.get();
    const chromeHistory = store.chromeHistory.get();
    const braveHistory = store.braveHistory.get();
    
    // Convert browser history to timeline items
    const chromeItems: TimelineItem[] = chromeHistory.map(entry => ({
      id: `chrome-${entry.url}-${entry.timestamp}`,
      timestamp: new Date(entry.timestamp),
      source: 'chrome' as SourceType,
      type: 'browser-history',
      data: entry,
    }));
    
    const braveItems: TimelineItem[] = braveHistory.map(entry => ({
      id: `brave-${entry.url}-${entry.timestamp}`,
      timestamp: new Date(entry.timestamp),
      source: 'brave' as SourceType,
      type: 'browser-history',
      data: entry,
    }));
    
    // Combine and sort by timestamp descending
    return [...serverItems, ...chromeItems, ...braveItems].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }
  
  private renderEmptyState(hasFiltered: boolean): void {
    if (!this.itemsContainer) return;
    
    const message = hasFiltered
      ? 'No items match the selected filters.'
      : 'No content available';
    
    this.itemsContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 min-h-[60vh]">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/40 mb-4">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>
        <p class="text-muted-foreground font-mono uppercase tracking-wider text-sm">${message}</p>
      </div>
    `;
  }
  
  private renderDateSection(date: Date, items: TimelineItem[]): HTMLElement {
    const section = createElement('div');
    
    // Date separator (text only, no lines)
    const dateSeparator = createElement('div', {
      className: 'flex items-center justify-center py-2',
    });
    
    const dateLabel = createElement('span', {
      className: 'text-xs font-mono text-muted-foreground uppercase tracking-wider',
      textContent: formatFullDate(date),
    });
    
    dateSeparator.appendChild(dateLabel);
    section.appendChild(dateSeparator);
    
    // Items container
    const itemsWrapper = createElement('div', {
      className: 'space-y-6 mt-4',
    });
    
    for (const item of items) {
      const entry = this.renderTimelineEntry(item);
      itemsWrapper.appendChild(entry);
    }
    
    section.appendChild(itemsWrapper);
    return section;
  }
  
  private renderTimelineEntry(item: TimelineItem): HTMLElement {
    const isExpanded = store.expandedItemId.get() === item.id;
    const time = formatTime(item.timestamp);
    const date = formatDate(item.timestamp);
    const iconUrl = this.iconUrls[item.source];
    
    const entry = createElement('div', {
      className: 'timeline-entry relative pl-8',
      dataset: { entryId: item.id },
    });
    
    // Timeline dot with icon
    const dot = createElement('div', {
      className: 'absolute left-0 top-1 w-5 h-5 bg-background border-2 border-border flex items-center justify-center z-10',
    });
    
    if (iconUrl) {
      dot.innerHTML = `<img src="${iconUrl}" alt="" class="w-3 h-3" />`;
    }
    entry.appendChild(dot);
    
    // Time label
    const timeLabel = createElement('div', {
      className: 'text-xs text-muted-foreground mb-1 font-mono',
      textContent: `${time} · ${date}`,
    });
    entry.appendChild(timeLabel);
    
    // Content based on type
    const content = this.renderItemContent(item);
    content.classList.add('cursor-pointer');
    
    // Click handler for expansion (using event delegation pattern)
    content.dataset.clickable = 'true';
    
    entry.appendChild(content);
    
    // Expanded view
    if (isExpanded) {
      const expandedView = this.renderExpandedView(item);
      entry.appendChild(expandedView);
    }
    
    return entry;
  }
  
  private renderItemContent(item: TimelineItem): HTMLElement {
    switch (item.type) {
      case 'cast':
        return this.renderCastContent(item.data as FarcasterCast);
      case 'browser-history':
        return this.renderBrowserHistoryContent(item.data as BrowserHistoryEntry);
      case 'transaction':
        return this.renderTransactionContent(item.data as TellerTransaction);
      default:
        return createElement('div', {
          className: 'text-sm p-3 bg-card border font-mono',
          textContent: JSON.stringify(item.data),
        });
    }
  }
  
  private renderCastContent(cast: FarcasterCast): HTMLElement {
    const wrapper = createElement('div', {
      className: 'p-3 bg-card border hover:bg-accent transition-colors',
    });
    
    // Author row
    const authorRow = createElement('div', {
      className: 'flex items-center gap-2 mb-2',
    });
    
    if (cast.author.pfp_url) {
      authorRow.innerHTML = `
        <img src="${cast.author.pfp_url}" alt="" class="w-6 h-6" />
        <span class="font-medium text-sm">${escapeHtml(cast.author.display_name)}</span>
        <span class="text-muted-foreground text-sm font-mono">@${escapeHtml(cast.author.username)}</span>
      `;
    } else {
      authorRow.innerHTML = `
        <div class="w-6 h-6 bg-muted"></div>
        <span class="font-medium text-sm">${escapeHtml(cast.author.display_name)}</span>
        <span class="text-muted-foreground text-sm font-mono">@${escapeHtml(cast.author.username)}</span>
      `;
    }
    wrapper.appendChild(authorRow);
    
    // Text content
    const text = createElement('p', {
      className: 'text-sm',
      textContent: cast.text,
    });
    wrapper.appendChild(text);
    
    // Reactions
    if (cast.reactions) {
      const reactions = createElement('div', {
        className: 'flex items-center gap-4 mt-2 text-xs text-muted-foreground font-mono',
      });
      reactions.innerHTML = `
        <span>❤️ ${cast.reactions.likes_count}</span>
        <span>🔁 ${cast.reactions.recasts_count}</span>
        ${cast.replies ? `<span>💬 ${cast.replies.count}</span>` : ''}
      `;
      wrapper.appendChild(reactions);
    }
    
    return wrapper;
  }
  
  private renderBrowserHistoryContent(entry: BrowserHistoryEntry): HTMLElement {
    const wrapper = createElement('div', {
      className: 'p-3 bg-card border hover:bg-accent transition-colors',
    });
    
    // Get favicon
    let faviconUrl = '';
    try {
      const url = new URL(entry.url);
      faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
    } catch {
      // Invalid URL
    }
    
    wrapper.innerHTML = `
      <div class="flex items-start gap-3">
        ${faviconUrl ? `<img src="${faviconUrl}" alt="" class="w-4 h-4 mt-0.5" />` : '<div class="w-4 h-4 mt-0.5 bg-muted"></div>'}
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">${escapeHtml(entry.title || 'Untitled')}</p>
          <p class="text-xs text-muted-foreground truncate font-mono">${escapeHtml(entry.url)}</p>
        </div>
      </div>
    `;
    
    return wrapper;
  }
  
  private renderTransactionContent(transaction: TellerTransaction): HTMLElement {
    const wrapper = createElement('div', {
      className: 'p-3 bg-card border hover:bg-accent transition-colors',
    });
    
    const amount = parseFloat(transaction.amount);
    const isPositive = amount > 0;
    
    wrapper.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium">${escapeHtml(transaction.description)}</p>
          <p class="text-xs text-muted-foreground font-mono uppercase">${escapeHtml(transaction.details.category || 'Uncategorized')}</p>
        </div>
        <span class="font-mono text-sm ${isPositive ? 'text-status-connected' : 'text-foreground'}">
          ${isPositive ? '+' : ''}$${Math.abs(amount).toFixed(2)}
        </span>
      </div>
    `;
    
    return wrapper;
  }
  
  private renderExpandedView(item: TimelineItem): HTMLElement {
    const wrapper = createElement('div', {
      className: 'mt-3 p-4 bg-card border border-border relative',
    });
    
    // Close button in top right
    const closeButton = createElement('button', {
      className: 'absolute top-2 right-2 p-1.5 hover:bg-accent transition-colors z-10',
      attributes: {
        'aria-label': 'Close',
        style: 'cursor: pointer;',
      },
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    });
    closeButton.dataset.closeExpanded = 'true';
    wrapper.appendChild(closeButton);
    
    // Content based on item type
    switch (item.type) {
      case 'cast':
        return this.renderCastExpanded(item.data as FarcasterCast, wrapper);
      case 'browser-history':
        return this.renderBrowserHistoryExpanded(item.data as BrowserHistoryEntry, wrapper);
      case 'transaction':
        return this.renderTransactionExpanded(item.data as TellerTransaction, wrapper);
      default:
        return this.renderDefaultExpanded(item, wrapper);
    }
  }
  
  private renderCastExpanded(cast: FarcasterCast, wrapper: HTMLElement): HTMLElement {
    // Clear only the content, keep the close button
    const existingContent = wrapper.querySelector('.expanded-content');
    if (existingContent) {
      existingContent.remove();
    }
    
    const content = createElement('div', {
      className: 'expanded-content space-y-3 text-sm',
    });
    
    // Author info
    const authorSection = createElement('div', {
      className: 'flex items-center gap-3 pb-3 border-b border-border',
    });
    
    if (cast.author.pfp_url) {
      authorSection.innerHTML = `
        <img src="${escapeHtml(cast.author.pfp_url)}" alt="" class="w-10 h-10" />
        <div>
          <div class="font-medium">${escapeHtml(cast.author.display_name)}</div>
          <div class="text-xs text-muted-foreground font-mono">@${escapeHtml(cast.author.username)}</div>
        </div>
      `;
    } else {
      authorSection.innerHTML = `
        <div class="w-10 h-10 bg-muted"></div>
        <div>
          <div class="font-medium">${escapeHtml(cast.author.display_name)}</div>
          <div class="text-xs text-muted-foreground font-mono">@${escapeHtml(cast.author.username)}</div>
        </div>
      `;
    }
    content.appendChild(authorSection);
    
    // Full text
    const textSection = createElement('div', {
      className: 'text-sm leading-relaxed',
      textContent: cast.text,
    });
    content.appendChild(textSection);
    
    // Metadata
    if (cast.reactions || cast.replies) {
      const metaSection = createElement('div', {
        className: 'flex items-center gap-4 pt-2 text-xs text-muted-foreground font-mono',
      });
      
      const metaItems: string[] = [];
      if (cast.reactions?.likes_count) metaItems.push(`❤️ ${cast.reactions.likes_count}`);
      if (cast.reactions?.recasts_count) metaItems.push(`🔁 ${cast.reactions.recasts_count}`);
      if (cast.replies?.count) metaItems.push(`💬 ${cast.replies.count}`);
      
      metaSection.textContent = metaItems.join(' · ');
      content.appendChild(metaSection);
    }
    
    wrapper.appendChild(content);
    return wrapper;
  }
  
  private renderBrowserHistoryExpanded(entry: BrowserHistoryEntry, wrapper: HTMLElement): HTMLElement {
    // Clear only the content, keep the close button
    const existingContent = wrapper.querySelector('.expanded-content');
    if (existingContent) {
      existingContent.remove();
    }
    
    const content = createElement('div', {
      className: 'expanded-content space-y-3 text-sm',
    });
    
    // Title
    const title = createElement('div', {
      className: 'font-medium text-base pb-2',
      textContent: entry.title || 'Untitled',
    });
    content.appendChild(title);
    
    // URL
    const urlSection = createElement('div', {
      className: 'text-xs text-muted-foreground break-all font-mono',
    });
    
    try {
      const url = new URL(entry.url);
      urlSection.innerHTML = `
        <div class="mb-1">${escapeHtml(url.protocol)}//${escapeHtml(url.hostname)}</div>
        <div class="text-muted-foreground/70">${escapeHtml(entry.url)}</div>
      `;
    } catch {
      urlSection.textContent = entry.url;
    }
    content.appendChild(urlSection);
    
    // Visit count if available
    if (entry.visitCount) {
      const visitCountEl = createElement('div', {
        className: 'text-xs text-muted-foreground pt-2 border-t border-border font-mono',
        textContent: `Visited ${entry.visitCount} time${entry.visitCount !== 1 ? 's' : ''}`,
      });
      content.appendChild(visitCountEl);
    }
    
    wrapper.appendChild(content);
    return wrapper;
  }
  
  private renderTransactionExpanded(transaction: TellerTransaction, wrapper: HTMLElement): HTMLElement {
    // Clear only the content, keep the close button
    const existingContent = wrapper.querySelector('.expanded-content');
    if (existingContent) {
      existingContent.remove();
    }
    
    const content = createElement('div', {
      className: 'expanded-content space-y-3 text-sm',
    });
    
    // Description
    const description = createElement('div', {
      className: 'font-medium text-base pb-2',
      textContent: transaction.description,
    });
    content.appendChild(description);
    
    // Amount
    const amount = parseFloat(transaction.amount);
    const isPositive = amount > 0;
    const amountSection = createElement('div', {
      className: `text-lg font-mono ${isPositive ? 'text-status-connected' : 'text-foreground'}`,
      textContent: `${isPositive ? '+' : ''}$${Math.abs(amount).toFixed(2)}`,
    });
    content.appendChild(amountSection);
    
    // Details grid
    const detailsGrid = createElement('div', {
      className: 'grid grid-cols-2 gap-3 pt-2 border-t border-border text-xs',
    });
    
    if (transaction.details?.category) {
      const categoryRow = createElement('div');
      categoryRow.innerHTML = `
        <div class="text-muted-foreground mb-1 font-mono uppercase tracking-wider">Category</div>
        <div>${escapeHtml(transaction.details.category)}</div>
      `;
      detailsGrid.appendChild(categoryRow);
    }
    
    if (transaction.details?.counterparty?.name) {
      const counterpartyRow = createElement('div');
      counterpartyRow.innerHTML = `
        <div class="text-muted-foreground mb-1 font-mono uppercase tracking-wider">Counterparty</div>
        <div>${escapeHtml(transaction.details.counterparty.name)}</div>
      `;
      detailsGrid.appendChild(counterpartyRow);
    }
    
    if (transaction.account_id) {
      const accountRow = createElement('div');
      accountRow.innerHTML = `
        <div class="text-muted-foreground mb-1 font-mono uppercase tracking-wider">Account</div>
        <div class="font-mono text-xs">${escapeHtml(transaction.account_id.slice(0, 8))}...</div>
      `;
      detailsGrid.appendChild(accountRow);
    }
    
    if (transaction.status) {
      const statusRow = createElement('div');
      statusRow.innerHTML = `
        <div class="text-muted-foreground mb-1 font-mono uppercase tracking-wider">Status</div>
        <div class="uppercase">${escapeHtml(transaction.status)}</div>
      `;
      detailsGrid.appendChild(statusRow);
    }
    
    if (detailsGrid.children.length > 0) {
      content.appendChild(detailsGrid);
    }
    
    wrapper.appendChild(content);
    return wrapper;
  }
  
  private renderDefaultExpanded(item: TimelineItem, wrapper: HTMLElement): HTMLElement {
    // Clear only the content, keep the close button
    const existingContent = wrapper.querySelector('.expanded-content');
    if (existingContent) {
      existingContent.remove();
    }
    
    const content = createElement('div', {
      className: 'expanded-content text-sm',
    });
    
    content.innerHTML = `
      <div class="font-mono uppercase tracking-wider mb-2">Details</div>
      <pre class="text-xs bg-background p-3 overflow-auto max-h-64 border border-border font-mono">${escapeHtml(JSON.stringify(item.data, null, 2))}</pre>
    `;
    
    wrapper.appendChild(content);
    return wrapper;
  }
  
  private updateExpandedStates(): void {
    // This is called when expandedItemId changes
    // Re-render to update expanded states
    this.renderItems();
  }
  
  /**
   * Handle clicks via event delegation
   */
  protected setupEventDelegation(): void {
    // Use capture phase to ensure we catch events even if they're stopped
    this.addListener(this.container, 'click', (e) => {
      const target = e.target as HTMLElement;
      
      // Check for close button
      if (target.closest('[data-close-expanded]')) {
        e.preventDefault();
        e.stopPropagation();
        actions.setExpandedItem(null);
        return;
      }
      
      // Check for clickable content
      const clickable = target.closest('[data-clickable]');
      if (clickable) {
        const entry = clickable.closest('[data-entry-id]') as HTMLElement;
        if (entry?.dataset.entryId) {
          e.preventDefault();
          e.stopPropagation();
          actions.toggleExpandedItem(entry.dataset.entryId);
        }
      }
    }, { capture: true });
  }
}

export default Timeline;


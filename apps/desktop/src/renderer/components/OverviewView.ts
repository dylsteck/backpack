/**
 * OverviewView Component
 * Day-grouped card view showing overview of activity
 */

import { Component } from './Component';
import { store, actions } from '../store';
import { fetchTimeline, loadMoreTimeline, fetchAppsWithCache } from '../api';
import { createElement, clearChildren, escapeHtml } from '../utils/dom';
import type { TimelineItem, SourceType, FarcasterCast, TellerTransaction, BrowserHistoryEntry } from '../types';
import { DetailModal } from './DetailModal';

interface DayGroup {
  date: Date;
  label: string;
  items: TimelineItem[];
  sources: Set<SourceType>;
  previewImages: string[];
  previewTexts: string[];
}

export class OverviewView extends Component {
  private contentContainer: HTMLElement | null = null;
  private loadMoreRef: HTMLElement | null = null;
  private observer: IntersectionObserver | null = null;
  private isLoadingMore = false;
  private iconUrls: Record<string, string | undefined> = {};
  
  async init(): Promise<void> {
    this.render();
    await this.loadAppsData();
    await this.loadInitialData();
    this.setupInfiniteScroll();
    
    // Subscribe to store changes
    this.subscribe(store.timelineItems, () => this.renderContent());
    this.subscribe(store.selectedSources, () => this.renderContent());
    this.subscribe(store.chromeHistory, () => this.renderContent());
    this.subscribe(store.braveHistory, () => this.renderContent());
  }
  
  render(): void {
    this.container.innerHTML = '';
    
    // Main scrollable container
    const scrollArea = createElement('div', {
      className: 'h-full overflow-y-auto',
    });
    
    // Content wrapper with padding
    const wrapper = createElement('div', {
      className: 'max-w-4xl mx-auto px-6 py-8 space-y-8',
    });
    
    // Content container
    this.contentContainer = createElement('div', {
      className: 'overview-content',
    });
    wrapper.appendChild(this.contentContainer);
    
    // Load more trigger
    this.loadMoreRef = createElement('div', { className: 'h-4' });
    wrapper.appendChild(this.loadMoreRef);
    
    // Loading indicator
    const loadingIndicator = createElement('div', {
      className: 'loading-more hidden text-sm text-muted-foreground text-center py-4',
      textContent: 'Loading more...',
    });
    wrapper.appendChild(loadingIndicator);
    
    scrollArea.appendChild(wrapper);
    this.container.appendChild(scrollArea);
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
    if (this.contentContainer) {
      this.renderSkeleton();
    }
    
    try {
      const result = await fetchTimeline(50); // Load more for overview
      actions.appendTimelineItems(result.items);
      actions.setTimelineCursor(result.nextCursor || null);
      this.renderContent();
    } catch {
      if (this.contentContainer) {
        this.contentContainer.innerHTML = `
          <div class="flex items-center justify-center py-12">
            <div class="text-destructive text-sm">Failed to load data</div>
          </div>
        `;
      }
    }
  }
  
  private renderSkeleton(): void {
    if (!this.contentContainer) return;
    clearChildren(this.contentContainer);
    
    // Skeleton day cards
    for (let i = 0; i < 3; i++) {
      const skeleton = createElement('div', {
        className: 'mb-8',
      });
      
      skeleton.innerHTML = `
        <div class="skeleton h-6 w-32 mb-4 rounded-lg"></div>
        <div class="card-modern card-elevated">
          <div class="skeleton h-48 w-full mb-4 rounded-xl"></div>
          <div class="skeleton h-4 w-3/4 mb-2 rounded"></div>
          <div class="skeleton h-4 w-1/2 rounded"></div>
        </div>
      `;
      
      this.contentContainer.appendChild(skeleton);
    }
  }
  
  private setupInfiniteScroll(): void {
    if (!this.loadMoreRef) return;
    
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !this.isLoadingMore) {
          this.loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    
    this.observer.observe(this.loadMoreRef);
    this.registerCleanup(() => this.observer?.disconnect());
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
    indicator?.classList.toggle('hidden', !show);
  }
  
  private getAllItems(): TimelineItem[] {
    const serverItems = store.timelineItems.get();
    const chromeHistory = store.chromeHistory.get();
    const braveHistory = store.braveHistory.get();
    
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
    
    return [...serverItems, ...chromeItems, ...braveItems].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }
  
  private groupItemsByDay(items: TimelineItem[]): DayGroup[] {
    const groups = new Map<string, DayGroup>();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    for (const item of items) {
      const date = new Date(item.timestamp);
      const dateKey = date.toDateString();
      
      if (!groups.has(dateKey)) {
        let label: string;
        if (date.toDateString() === today.toDateString()) {
          label = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
          label = 'Yesterday';
        } else {
          label = date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'short', 
            day: 'numeric' 
          });
        }
        
        groups.set(dateKey, {
          date,
          label,
          items: [],
          sources: new Set(),
          previewImages: [],
          previewTexts: [],
        });
      }
      
      const group = groups.get(dateKey)!;
      group.items.push(item);
      group.sources.add(item.source);
      
      // Extract preview content
      if (group.previewImages.length < 3) {
        const imageUrl = this.extractImageUrl(item);
        if (imageUrl) group.previewImages.push(imageUrl);
      }
      
      if (group.previewTexts.length < 2) {
        const text = this.extractPreviewText(item);
        if (text) group.previewTexts.push(text);
      }
    }
    
    return Array.from(groups.values());
  }
  
  private extractImageUrl(item: TimelineItem): string | null {
    if (item.type === 'cast') {
      const cast = item.data as FarcasterCast;
      if (cast.author.pfp_url) return cast.author.pfp_url;
      if (cast.embeds?.[0]?.url) return cast.embeds[0].url;
    }
    return null;
  }
  
  private extractPreviewText(item: TimelineItem): string | null {
    if (item.type === 'cast') {
      const cast = item.data as FarcasterCast;
      return cast.text.slice(0, 100);
    }
    if (item.type === 'note') {
      const note = item.data as { body: string };
      return note.body.slice(0, 100);
    }
    if (item.type === 'browser-history') {
      const entry = item.data as BrowserHistoryEntry;
      return entry.title || entry.url;
    }
    if (item.type === 'transaction') {
      const tx = item.data as TellerTransaction;
      return tx.description;
    }
    return null;
  }
  
  private renderContent(): void {
    if (!this.contentContainer) return;
    
    const allItems = this.getAllItems();
    const selectedSources = store.selectedSources.get();
    
    const filteredItems = selectedSources.includes('all')
      ? allItems
      : allItems.filter(item => selectedSources.includes(item.source));
    
    clearChildren(this.contentContainer);
    
    if (filteredItems.length === 0) {
      this.renderEmptyState();
      return;
    }
    
    const dayGroups = this.groupItemsByDay(filteredItems);
    
    for (const group of dayGroups) {
      const dayCard = this.renderDayCard(group);
      this.contentContainer.appendChild(dayCard);
    }
  }
  
  private renderEmptyState(): void {
    if (!this.contentContainer) return;
    
    this.contentContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold mb-2">Your overview is empty</h3>
        <p class="text-muted-foreground text-sm max-w-md mb-6">
          Connect your apps to start seeing your activity organized by day.
        </p>
        <a href="/apps" class="px-6 py-3 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:opacity-90 transition-opacity" data-link>
          Connect Apps
        </a>
      </div>
    `;
    
    const link = this.contentContainer.querySelector('[data-link]');
    if (link) {
      this.addListener(link as HTMLElement, 'click', (e) => {
        e.preventDefault();
        import('../router').then(({ router }) => router.navigate('/apps'));
      });
    }
  }
  
  private renderDayCard(group: DayGroup): HTMLElement {
    const section = createElement('div', {
      className: 'mb-8',
    });
    
    // Day header
    const header = createElement('div', {
      className: 'day-header mb-4',
    });
    
    const label = createElement('span', {
      className: 'text-xl font-semibold',
      textContent: group.label,
    });
    header.appendChild(label);
    
    // Arrow icon
    const arrow = createElement('span', {
      className: 'text-muted-foreground',
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 7h10v10"/>
          <path d="M7 17 17 7"/>
        </svg>
      `,
    });
    header.appendChild(arrow);
    
    section.appendChild(header);
    
    // Card
    const card = createElement('div', {
      className: 'card-modern card-elevated cursor-pointer',
    });
    
    // Click handler for the card
    this.addListener(card, 'click', () => {
      // Open the first item's detail modal, or show a day summary
      if (group.items.length > 0) {
        this.openItemDetail(group.items[0]);
      }
    });
    
    // Preview content area
    const previewArea = createElement('div', {
      className: 'mb-4',
    });
    
    if (group.previewImages.length > 0 || group.previewTexts.length > 0) {
      // Image stack or text previews
      if (group.previewImages.length > 0) {
        const imageStack = this.renderImageStack(group.previewImages);
        previewArea.appendChild(imageStack);
      } else if (group.previewTexts.length > 0) {
        const textPreview = createElement('div', {
          className: 'bg-secondary/50 rounded-xl p-4',
        });
        for (const text of group.previewTexts.slice(0, 2)) {
          const p = createElement('p', {
            className: 'text-sm text-secondary-foreground mb-2 last:mb-0 line-clamp-2',
            textContent: text,
          });
          textPreview.appendChild(p);
        }
        previewArea.appendChild(textPreview);
      }
    } else {
      // Fallback visual
      previewArea.innerHTML = `
        <div class="bg-secondary/30 rounded-xl h-32 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground/40">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        </div>
      `;
    }
    
    card.appendChild(previewArea);
    
    // Item count and description
    const meta = createElement('div', {
      className: 'space-y-2',
    });
    
    const title = createElement('h3', {
      className: 'font-medium',
      textContent: this.generateDayTitle(group),
    });
    meta.appendChild(title);
    
    const description = createElement('p', {
      className: 'text-sm text-muted-foreground',
      textContent: this.generateDayDescription(group),
    });
    meta.appendChild(description);
    
    card.appendChild(meta);
    
    // Source icons footer
    const footer = createElement('div', {
      className: 'flex items-center gap-2 mt-4 pt-4 border-t border-border',
    });
    
    for (const source of group.sources) {
      if (source === 'all' || source === 'user') continue;
      const iconUrl = this.iconUrls[source];
      if (iconUrl) {
        const icon = createElement('img', {
          className: 'w-5 h-5 rounded',
          attributes: { src: iconUrl, alt: source },
        });
        footer.appendChild(icon);
      } else {
        // User notes icon
        if (source === 'user') {
          footer.innerHTML += `
            <div class="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-amber-500">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
            </div>
          `;
        }
      }
    }
    
    card.appendChild(footer);
    section.appendChild(card);
    
    return section;
  }
  
  private renderImageStack(images: string[]): HTMLElement {
    const stack = createElement('div', {
      className: 'image-stack h-48 relative',
    });
    
    // Arrange images in a scattered layout
    const positions = [
      { top: '0', left: '0', rotate: '-3deg', zIndex: '1' },
      { top: '10px', left: '40px', rotate: '2deg', zIndex: '2' },
      { top: '5px', left: '80px', rotate: '-1deg', zIndex: '3' },
    ];
    
    images.slice(0, 3).forEach((url, index) => {
      const pos = positions[index];
      const imageWrapper = createElement('div', {
        className: 'image-stack-item w-32 h-40',
        attributes: {
          style: `top: ${pos.top}; left: ${pos.left}; transform: rotate(${pos.rotate}); z-index: ${pos.zIndex};`,
        },
      });
      
      const img = createElement('img', {
        className: 'w-full h-full object-cover',
        attributes: { src: url, alt: '' },
      });
      
      // Handle image load errors
      this.addListener(img, 'error', () => {
        imageWrapper.innerHTML = `
          <div class="w-full h-full bg-muted flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-muted-foreground">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
          </div>
        `;
      });
      
      imageWrapper.appendChild(img);
      stack.appendChild(imageWrapper);
    });
    
    return stack;
  }
  
  private generateDayTitle(group: DayGroup): string {
    const typeCount: Record<string, number> = {};
    
    for (const item of group.items) {
      typeCount[item.type] = (typeCount[item.type] || 0) + 1;
    }
    
    const parts: string[] = [];
    
    if (typeCount['cast']) {
      parts.push(`${typeCount['cast']} cast${typeCount['cast'] !== 1 ? 's' : ''}`);
    }
    if (typeCount['transaction']) {
      parts.push(`${typeCount['transaction']} transaction${typeCount['transaction'] !== 1 ? 's' : ''}`);
    }
    if (typeCount['browser-history']) {
      parts.push(`${typeCount['browser-history']} page${typeCount['browser-history'] !== 1 ? 's' : ''} visited`);
    }
    if (typeCount['note']) {
      parts.push(`${typeCount['note']} note${typeCount['note'] !== 1 ? 's' : ''}`);
    }
    
    if (parts.length === 0) {
      return `${group.items.length} item${group.items.length !== 1 ? 's' : ''}`;
    }
    
    return parts.slice(0, 2).join(', ');
  }
  
  private generateDayDescription(group: DayGroup): string {
    const sourceNames = Array.from(group.sources)
      .filter(s => s !== 'all' && s !== 'user')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1));
    
    if (group.sources.has('user')) {
      sourceNames.push('Notes');
    }
    
    if (sourceNames.length === 0) {
      return `${group.items.length} items`;
    }
    
    return `${group.items.length} items from ${sourceNames.join(', ')}`;
  }
  
  private openItemDetail(item: TimelineItem): void {
    const modalContainer = createElement('div', { id: 'detail-modal-portal' });
    document.body.appendChild(modalContainer);
    
    const modal = new DetailModal(modalContainer, item, () => {
      modal.destroy();
      modalContainer.remove();
    });
    modal.init();
  }
}

export default OverviewView;


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
import { decryptApiKeyForProvider, hasApiKeyForProvider } from '../utils/crypto';
import { getChatStateManager } from '../utils/chat-state';
import type { Provider } from '../utils/providers';

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
  private briefingContainer: HTMLElement | null = null;
  private loadMoreRef: HTMLElement | null = null;
  private observer: IntersectionObserver | null = null;
  private isLoadingMore = false;
  private iconUrls: Record<string, string | undefined> = {};
  private briefingContent: string | null = null;
  private briefingLastUpdated: Date | null = null;
  
  async init(): Promise<void> {
    this.render();
    this.setupEventDelegation();
    await this.loadAppsData();
    await this.loadInitialData();
    this.setupInfiniteScroll();
    
    // Load briefing after a short delay to let timeline load first
    setTimeout(() => {
      this.loadBriefing();
    }, 500);
    
    // Subscriptions
    this.subscribe(store.timelineItems, () => {
      this.renderItems();
      // Regenerate briefing when timeline updates (debounced)
      this.debouncedRefreshBriefing();
    });
    this.subscribe(store.selectedSources, () => this.renderItems());
    this.subscribe(store.obsidianNotes, () => this.renderItems());
    this.subscribe(store.timelineLoading, (loading) => {
      if (loading && store.timelineItems.get().length === 0) this.renderSkeleton();
      else if (!loading) this.renderItems();
    });
    
    this.loadBrowserHistory();
  }
  
  private briefingRefreshTimeout: NodeJS.Timeout | null = null;
  private debouncedRefreshBriefing(): void {
    if (this.briefingRefreshTimeout) {
      clearTimeout(this.briefingRefreshTimeout);
    }
    this.briefingRefreshTimeout = setTimeout(() => {
      this.loadBriefing(true);
    }, 5000); // Wait 5 seconds after timeline updates
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
    
    // Briefing section (at top) - minimal spacing, brought up slightly
    this.briefingContainer = createElement('div', {
      className: 'briefing-section mb-12',
    });
    (this.briefingContainer as HTMLElement).style.cssText = `
      margin-top: -1rem;
    `;
    wrapper.appendChild(this.briefingContainer);
    
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
    
    // Empty header - briefing section handles the greeting
    return header;
  }
  
  private getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
  
  // ============================================
  // BRIEFING SECTION
  // ============================================
  
  private async loadBriefing(forceRefresh = false): Promise<void> {
    if (!this.briefingContainer) return;
    
    // Check cache (skip if forceRefresh is true)
    const cacheKey = 'cortex-daily-briefing';
    const cached = localStorage.getItem(cacheKey);
    const now = new Date();
    
    if (!forceRefresh && cached) {
      try {
        const { content, timestamp } = JSON.parse(cached);
        const cacheDate = new Date(timestamp);
        const hoursSinceUpdate = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60);
        
        // Use cache if less than 6 hours old
        if (hoursSinceUpdate < 6) {
          this.briefingContent = content;
          this.briefingLastUpdated = cacheDate;
          this.renderBriefing();
          return;
        }
      } catch (e) {
        console.warn('[Timeline] Failed to parse cached briefing:', e);
      }
    }
    
    // Generate new briefing (forceRefresh bypasses cache)
    await this.generateBriefing();
  }
  
  private async generateBriefing(): Promise<void> {
    if (!this.briefingContainer) return;
    
    // Check if API key is available
    const stateManager = getChatStateManager();
    const provider: Provider = stateManager.getProvider();
    
    if (!hasApiKeyForProvider(provider)) {
      this.renderBriefingPlaceholder();
      return;
    }
    
    try {
      const apiKey = await decryptApiKeyForProvider(provider);
      if (!apiKey) {
        this.renderBriefingPlaceholder();
        return;
      }
      
      // Get recent timeline items for context
      const allItems = this.getAllItems();
      const recentItems = allItems.slice(0, 20);
      
      // Build context from recent items
      const context = recentItems.map(item => {
        const time = formatTime(item.timestamp);
        const source = item.source;
        const preview = this.extractPreviewText(item) || '';
        return `[${time}] ${source}: ${preview.substring(0, 100)}`;
      }).join('\n');
      
      const endpoint = stateManager.getEndpoint(provider, await this.getServerPort());
      const model = stateManager.getModel(provider);
      
      const greeting = this.getGreeting();
      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      
      const prompt = `Generate a concise daily briefing for ${greeting.toLowerCase()}, ${dateStr}. 

Based on this recent activity:
${context}

Write 3-4 short paragraphs summarizing:
1. Key meetings or important events coming up
2. Notable activity or updates from connected services
3. Any tasks or items that need attention
4. A brief overall assessment of the day

Write in a natural, conversational tone. Be specific but concise. Format as plain text paragraphs (no markdown, no lists).`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful assistant that generates concise daily briefings.' },
            { role: 'user', content: prompt }
          ],
          model,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      // Read entire streamed response before displaying
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');
      
      const decoder = new TextDecoder();
      let content = '';
      
      // Read all chunks from the stream and accumulate text
      // AI SDK streams plain text chunks, so we just concatenate them
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        // Accumulate all text chunks
        content += chunk;
      }
      
      // Clean up any streaming artifacts or extra whitespace
      content = content.trim();
      
      // Set content and render once (no incremental updates)
      this.briefingContent = content;
      this.briefingLastUpdated = new Date();
      this.renderBriefing();
      
      // Cache the briefing for 6 hours
      localStorage.setItem('cortex-daily-briefing', JSON.stringify({
        content,
        timestamp: this.briefingLastUpdated.toISOString(),
      }));
      
    } catch (error) {
      console.error('[Timeline] Failed to generate briefing:', error);
      this.renderBriefingPlaceholder();
    }
  }
  
  private async getServerPort(): Promise<number> {
    if (typeof window !== 'undefined' && window.serverApi) {
      try {
        const port = await window.serverApi.getPort();
        return port || 3000;
      } catch {
        return 3000;
      }
    }
    return 3000;
  }
  
  private renderBriefingPlaceholder(): void {
    if (!this.briefingContainer) return;
    
    const greeting = this.getGreeting();
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    
    this.briefingContent = `Good ${timeOfDay}. Your timeline is ready. Connect services to see personalized insights and updates here.`;
    this.briefingLastUpdated = new Date();
    this.renderBriefing();
  }
  
  private renderBriefing(): void {
    if (!this.briefingContainer) return;
    
    clearChildren(this.briefingContainer);
    
    // Minimal wrapper - no card styling
    const wrapper = createElement('div', {
      className: 'briefing-wrapper',
    });
    (wrapper as HTMLElement).style.cssText = `
      padding: 0;
      animation: fade-in 0.4s ease-out;
    `;
    
    // Header with icon and greeting - minimal
    const header = createElement('div', {
      className: 'flex items-center gap-3 mb-8',
    });
    
    // Simple sun/icon - no background
    const iconWrapper = createElement('div', {
      className: 'flex-shrink-0',
    });
    (iconWrapper as HTMLElement).style.cssText = `
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--muted-foreground);
      opacity: 0.6;
    `;
    const hour = new Date().getHours();
    const isMorning = hour < 12;
    const isAfternoon = hour >= 12 && hour < 17;
    iconWrapper.innerHTML = isMorning 
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`
      : isAfternoon
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a6 6 0 0 0-6 6c0 1.5.5 3 1.5 4L12 22l4.5-8A6 6 0 0 0 12 2Z"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    header.appendChild(iconWrapper);
    
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const greetingText = createElement('h2', {
      textContent: `${this.getGreeting()}, ${dateStr}.`,
    });
    (greetingText as HTMLElement).style.cssText = `
      font-family: var(--font-sans, 'Manrope', sans-serif);
      font-size: 1rem;
      font-weight: 500;
      color: var(--foreground);
      margin: 0;
      line-height: 1.4;
    `;
    header.appendChild(greetingText);
    
    wrapper.appendChild(header);
    
    // Briefing content - plain text paragraphs
    if (this.briefingContent) {
      const contentWrapper = createElement('div', {
        className: 'briefing-content',
      });
      (contentWrapper as HTMLElement).style.cssText = `
        font-family: var(--font-sans, 'Manrope', sans-serif);
        font-size: 0.9375rem;
        line-height: 1.8;
        color: var(--foreground);
        margin-bottom: 2rem;
      `;
      
      // Split into paragraphs
      const paragraphs = this.briefingContent.split('\n\n').filter(p => p.trim());
      paragraphs.forEach((para, index) => {
        const p = createElement('p', {
          textContent: para.trim(),
        });
        (p as HTMLElement).style.cssText = `
          margin-bottom: ${index < paragraphs.length - 1 ? '1.25rem' : '0'};
          color: var(--foreground);
          animation: fade-in 0.4s ease-out ${index * 0.1}s both;
        `;
        contentWrapper.appendChild(p);
      });
      
      wrapper.appendChild(contentWrapper);
    }
    
    // Footer - minimal, centered
    const footer = createElement('div', {
      className: 'flex flex-col items-center gap-1',
    });
    (footer as HTMLElement).style.cssText = `
      padding-top: 0.5rem;
    `;
    
    const timestamp = createElement('div', {
      className: 'text-xs',
    });
    (timestamp as HTMLElement).style.cssText = `
      color: var(--muted-foreground);
      opacity: 0.5;
      font-family: var(--font-sans, 'Manrope', sans-serif);
    `;
    if (this.briefingLastUpdated) {
      const hours = Math.floor((new Date().getTime() - this.briefingLastUpdated.getTime()) / (1000 * 60 * 60));
      const minutes = Math.floor((new Date().getTime() - this.briefingLastUpdated.getTime()) / (1000 * 60));
      if (hours > 0) {
        timestamp.textContent = `Last updated: ${hours}h ago`;
      } else if (minutes > 0) {
        timestamp.textContent = `Last updated: ${minutes}m ago`;
      } else {
        timestamp.textContent = `Last updated: just now`;
      }
    }
    footer.appendChild(timestamp);
    
    const refreshBtn = createElement('button', {
      className: 'text-xs',
    });
    (refreshBtn as HTMLElement).style.cssText = `
      color: var(--muted-foreground);
      opacity: 0.6;
      cursor: pointer;
      transition: opacity 0.2s;
      background: none;
      border: none;
      padding: 0;
      font-family: var(--font-sans, 'Manrope', sans-serif);
      text-decoration: underline;
      text-underline-offset: 2px;
    `;
    refreshBtn.textContent = 'Refresh';
    refreshBtn.addEventListener('mouseenter', () => {
      (refreshBtn as HTMLElement).style.opacity = '1';
    });
    refreshBtn.addEventListener('mouseleave', () => {
      (refreshBtn as HTMLElement).style.opacity = '0.6';
    });
    this.addListener(refreshBtn, 'click', () => {
      this.loadBriefing(true);
    });
    footer.appendChild(refreshBtn);
    
    wrapper.appendChild(footer);
    this.briefingContainer.appendChild(wrapper);
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
    
    this.renderTimeline(filteredItems);
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
    const container = createElement('div', { className: 'space-y-8' });
    
    for (const [dateKey, dayItems] of grouped) {
      const dayWrapper = createElement('div', { className: 'relative' });
      
      // Minimal date header - very subtle, only show if not today
      const today = new Date().toDateString();
      const dateKeyDate = new Date(dateKey).toDateString();
      if (dateKeyDate !== today) {
        const dateHeader = createElement('div', {
          className: 'mb-5',
        });
        const dateLabel = formatFullDate(new Date(dateKey));
        dateHeader.innerHTML = `
          <h2 style="font-family: var(--font-sans, 'Manrope', sans-serif); font-weight: 500; font-size: 0.8125rem; letter-spacing: 0.03em; text-transform: uppercase;" class="text-muted-foreground/40">${dateLabel}</h2>
        `;
        dayWrapper.appendChild(dateHeader);
      }
      
      const itemsList = createElement('div', { className: 'space-y-4 relative' });
      
      dayItems.forEach((item, index) => {
        // Message bubble - very subtle background
        const messageWrapper = createElement('div', {
          className: 'flex items-start gap-4 group relative',
        });
        (messageWrapper as HTMLElement).style.cssText = `
          padding-left: 1.5rem;
        `;

        // Timeline dot indicator - very subtle
        const dot = createElement('div', {
          className: 'absolute left-5 top-3',
        });
        (dot as HTMLElement).style.cssText = `
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          transform: translateX(-50%);
        `;
        messageWrapper.appendChild(dot);

        // Message bubble - very subtle, minimal styling
        const bubble = createElement('div', {
          className: 'flex-1 cursor-pointer',
        });
        (bubble as HTMLElement).style.cssText = `
          background: rgba(255, 255, 255, 0.01);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          transition: background 0.15s ease;
        `;
        bubble.addEventListener('mouseenter', () => {
          (bubble as HTMLElement).style.background = 'rgba(255, 255, 255, 0.02)';
        });
        bubble.addEventListener('mouseleave', () => {
          (bubble as HTMLElement).style.background = 'rgba(255, 255, 255, 0.01)';
        });
        this.addListener(bubble, 'click', () => this.openItemDetail(item));

        // Content text
        const content = this.renderItemContent(item);
        (content as HTMLElement).style.cssText = `
          font-family: var(--font-sans, 'Manrope', sans-serif);
          font-size: 0.875rem;
          line-height: 1.65;
          color: var(--foreground);
          margin-bottom: 0.625rem;
        `;
        bubble.appendChild(content);
        
        // Check if item has linked todos or actionable items
        // For now, detect if content mentions Linear tickets or similar patterns
        const contentText = this.extractPreviewText(item) || '';
        const hasLinkedTodos = contentText.toLowerCase().includes('linear') || 
                               contentText.toLowerCase().includes('des-') ||
                               item.type === 'obsidian-note';
        
        if (hasLinkedTodos) {
          const todosSection = createElement('div', {
            className: 'mt-3 pt-3 border-t border-white/5',
          });
          
          const todosHeader = createElement('div', {
            className: 'text-xs mb-2',
          });
          (todosHeader as HTMLElement).style.cssText = `
            color: var(--muted-foreground);
            opacity: 0.5;
            font-weight: 500;
          `;
          todosHeader.textContent = 'Linked todos';
          todosSection.appendChild(todosHeader);
          
          // Extract todo items from content (simplified - could be enhanced)
          const todoItems = this.extractTodoItems(contentText);
          todoItems.forEach((todo, todoIndex) => {
            const todoItem = createElement('div', {
              className: 'flex items-center gap-2 py-1',
            });
            
            const checkbox = createElement('div', {
              className: 'flex-shrink-0',
            });
            (checkbox as HTMLElement).style.cssText = `
              width: 16px;
              height: 16px;
              border-radius: 0.25rem;
              border: 1.5px solid rgba(255, 255, 255, 0.2);
              cursor: pointer;
              transition: all 0.15s;
              flex-shrink: 0;
            `;
            checkbox.addEventListener('mouseenter', () => {
              (checkbox as HTMLElement).style.borderColor = 'rgba(99, 102, 241, 0.6)';
              (checkbox as HTMLElement).style.background = 'rgba(99, 102, 241, 0.1)';
            });
            checkbox.addEventListener('mouseleave', () => {
              (checkbox as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.2)';
              (checkbox as HTMLElement).style.background = 'transparent';
            });
            
            const todoText = createElement('span', {
              className: 'text-sm',
            });
            (todoText as HTMLElement).style.cssText = `
              color: var(--foreground);
              opacity: ${todoIndex === 0 ? '1' : '0.7'};
              font-weight: ${todoIndex === 0 ? '500' : '400'};
            `;
            todoText.textContent = todo;
            todoItem.appendChild(checkbox);
            todoItem.appendChild(todoText);
            todosSection.appendChild(todoItem);
          });
          
          bubble.appendChild(todosSection);
        }

        // Footer with sender, time, and source badge
        const footer = createElement('div', {
          className: 'flex items-center gap-2 mt-2',
        });
        
        // Sender name (if available) or source
        const senderName = createElement('span', {
          className: 'text-xs font-medium',
        });
        (senderName as HTMLElement).style.cssText = `
          color: var(--muted-foreground);
          opacity: 0.7;
        `;
        
        // Try to extract sender name from item data
        let displayName = item.source;
        if (item.type === 'cast' && (item.data as FarcasterCast).author) {
          displayName = (item.data as FarcasterCast).author.display_name || displayName;
        }
        senderName.textContent = displayName;
        footer.appendChild(senderName);
        
        // Time badge
        const timeBadge = createElement('span', {
          className: 'text-xs',
        });
        (timeBadge as HTMLElement).style.cssText = `
          color: var(--muted-foreground);
          opacity: 0.5;
        `;
        const timeAgo = this.getRelativeTime(item.timestamp);
        timeBadge.textContent = timeAgo;
        footer.appendChild(timeBadge);
        
        // Source badge ("using X") with icon
        const sourceBadge = createElement('span', {
          className: 'inline-flex items-center gap-1.5 ml-auto',
        });
        (sourceBadge as HTMLElement).style.cssText = `
          font-size: 0.625rem;
          font-weight: 500;
          color: var(--muted-foreground);
          opacity: 0.5;
        `;
        
        const sourceIconSpan = createElement('span');
        sourceIconSpan.innerHTML = this.getSourceIconSmall(item.source);
        sourceBadge.appendChild(sourceIconSpan);
        
        const usingText = createElement('span', {
          textContent: 'using',
        });
        sourceBadge.appendChild(usingText);
        
        const sourceNameSpan = createElement('span', {
          className: 'font-semibold',
          textContent: item.source.charAt(0).toUpperCase() + item.source.slice(1),
        });
        sourceBadge.appendChild(sourceNameSpan);
        footer.appendChild(sourceBadge);

        bubble.appendChild(footer);
        messageWrapper.appendChild(bubble);

        // Right-side absolute timestamp
        const absoluteTime = createElement('div', {
          className: 'absolute right-0 top-2',
        });
        (absoluteTime as HTMLElement).style.cssText = `
          font-family: var(--font-mono, 'JetBrains Mono', monospace);
          font-size: 0.75rem;
          color: var(--muted-foreground);
          opacity: 0.4;
          white-space: nowrap;
        `;
        absoluteTime.textContent = formatTime(item.timestamp);
        messageWrapper.appendChild(absoluteTime);

        itemsList.appendChild(messageWrapper);
      });
      
      dayWrapper.appendChild(itemsList);
      container.appendChild(dayWrapper);
    }
    
    this.itemsContainer?.appendChild(container);
  }
  
  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatTime(date);
  }
  
  private extractTodoItems(text: string): string[] {
    // Extract todo items from text (e.g., "Linear DES-16 — ...")
    const todoPattern = /(?:Linear\s+)?(DES-\d+[^•\n]+)/gi;
    const matches = text.match(todoPattern);
    if (matches) {
      return matches.slice(0, 4).map(m => m.trim());
    }
    // Fallback: if text mentions todos, create placeholder items
    if (text.toLowerCase().includes('todo') || text.toLowerCase().includes('ticket')) {
      return ['Task item 1', 'Task item 2'];
    }
    return [];
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

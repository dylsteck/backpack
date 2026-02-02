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
  
  async init(): Promise<void> {
    this.render();
    this.setupEventDelegation();
    await this.loadAppsData();
    await this.loadInitialData();
    this.setupInfiniteScroll();
    
    // Subscriptions
    this.subscribe(store.timelineItems, () => {
      this.renderItems();
    });
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
    (this.itemsContainer as HTMLElement).style.cssText = `
      position: relative;
    `;
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
    const container = createElement('div', { className: 'space-y-12 relative' });
    
    // Vertical connecting line - runs down the left side
    // Aligned with briefing text start: icon (24px) + gap (12px) = 36px from container edge
    const connectingLine = createElement('div', {
      className: 'absolute top-0 bottom-0',
    });
    (connectingLine as HTMLElement).style.cssText = `
      left: 36px;
      width: 1px;
      background: rgba(255, 255, 255, 0.08);
      z-index: 0;
    `;
    container.appendChild(connectingLine);
    
    for (const [dateKey, dayItems] of grouped) {
      const dayWrapper = createElement('div', { className: 'relative' });
      
      // Date badge with horizontal line - pill-shaped, overlapping line
      const today = new Date().toDateString();
      const dateKeyDate = new Date(dateKey).toDateString();
      if (dateKeyDate !== today) {
        // Container for line and badge
        const dateSection = createElement('div', {
          className: 'relative mb-8',
        });
        (dateSection as HTMLElement).style.cssText = `
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        `;
        
        // Horizontal line - extends across
        const line = createElement('div');
        (line as HTMLElement).style.cssText = `
          position: absolute;
          left: 0;
          right: 0;
          height: 1px;
          background: hsl(var(--destructive) / 0.6);
          z-index: 1;
        `;
        dateSection.appendChild(line);
        
        // Badge container - right-aligned, overlaps line
        const dateBadge = createElement('div', {
          className: 'flex justify-end relative z-10',
        });
        (dateBadge as HTMLElement).style.cssText = `
          position: relative;
          z-index: 10;
        `;
        
        const badge = createElement('div');
        (badge as HTMLElement).style.cssText = `
          background: hsl(var(--destructive));
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          font-family: var(--font-sans, 'Manrope', sans-serif);
          font-size: 0.8125rem;
          font-weight: 500;
          box-shadow: 0 2px 8px hsl(var(--destructive) / 0.3);
          white-space: nowrap;
        `;
        badge.textContent = formatFullDate(new Date(dateKey));
        dateBadge.appendChild(badge);
        dateSection.appendChild(dateBadge);
        dayWrapper.appendChild(dateSection);
      }
      
      const itemsList = createElement('div', { className: 'space-y-6 relative z-10' });
      
      dayItems.forEach((item, index) => {
        const isLast = index === dayItems.length - 1;
        
        // Message wrapper with left padding for timeline
        // Padding accounts for node position (36px) + spacing (12px) = 48px
        const messageWrapper = createElement('div', {
          className: 'relative group',
        });
        (messageWrapper as HTMLElement).style.cssText = `
          padding-left: 48px;
          position: relative;
        `;

        // Timeline node - circular, positioned on the connecting line
        // Aligned with briefing text start: icon (24px) + gap (12px) = 36px
        const node = createElement('div', {
          className: 'absolute',
        });
        (node as HTMLElement).style.cssText = `
          left: 36px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.6);
          border: 2px solid var(--background);
          transform: translateX(-50%);
          z-index: 10;
          top: 0.75rem;
        `;
        messageWrapper.appendChild(node);

        // Connecting line segment from node to next node (if not last)
        if (!isLast) {
          const lineSegment = createElement('div', {
            className: 'absolute',
          });
          (lineSegment as HTMLElement).style.cssText = `
            left: 36px;
            width: 1px;
            height: calc(100% + 1.5rem);
            background: rgba(255, 255, 255, 0.08);
            top: 1.5rem;
            transform: translateX(-50%);
            z-index: 1;
          `;
          messageWrapper.appendChild(lineSegment);
        }

        // Sender info (avatar + name) - positioned above bubble
        const senderInfo = createElement('div', {
          className: 'flex items-center gap-2 mb-2',
        });
        
        // Avatar/icon
        const avatar = createElement('div', {
          className: 'flex-shrink-0',
        });
        (avatar as HTMLElement).style.cssText = `
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        `;
        const iconUrl = this.iconUrls[item.source];
        if (iconUrl) {
          avatar.innerHTML = `<img src="${iconUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`;
        } else {
          avatar.innerHTML = `<div style="width: 12px; height: 12px; border-radius: 50%; background: rgba(99, 102, 241, 0.6);"></div>`;
        }
        senderInfo.appendChild(avatar);
        
        // Sender name
        let displayName = item.source.charAt(0).toUpperCase() + item.source.slice(1);
        if (item.type === 'cast' && (item.data as FarcasterCast).author) {
          displayName = (item.data as FarcasterCast).author.display_name || displayName;
        }
        const senderName = createElement('span');
        (senderName as HTMLElement).style.cssText = `
          font-family: var(--font-sans, 'Manrope', sans-serif);
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--muted-foreground);
          opacity: 0.8;
        `;
        senderName.textContent = displayName;
        senderInfo.appendChild(senderName);
        
        // Time indicator below name
        const timeIndicator = createElement('span');
        (timeIndicator as HTMLElement).style.cssText = `
          font-family: var(--font-sans, 'Manrope', sans-serif);
          font-size: 0.75rem;
          color: var(--muted-foreground);
          opacity: 0.5;
          margin-left: 0.5rem;
        `;
        timeIndicator.textContent = this.getRelativeTime(item.timestamp);
        senderInfo.appendChild(timeIndicator);
        
        messageWrapper.appendChild(senderInfo);

        // Special styling for Obsidian notes - card-like appearance
        const isObsidianNote = item.type === 'obsidian-note';
        
        // Message bubble - chat-like appearance (or card-like for Obsidian)
        const bubble = createElement('div', {
          className: 'cursor-pointer',
        });
        (bubble as HTMLElement).style.cssText = `
          background: ${isObsidianNote ? 'hsl(var(--card))' : 'hsl(var(--muted) / 0.3)'};
          border: 1px solid ${isObsidianNote ? 'hsl(var(--border) / 0.5)' : 'hsl(var(--border) / 0.5)'};
          border-radius: ${isObsidianNote ? '0.875rem' : '0.75rem'};
          padding: ${isObsidianNote ? '1.25rem 1.5rem' : '1rem 1.25rem'};
          transition: all 0.2s ease;
          box-shadow: ${isObsidianNote ? '0 2px 8px hsl(var(--background) / 0.3)' : '0 1px 2px hsl(var(--background) / 0.05)'};
          max-width: 85%;
        `;
        bubble.addEventListener('mouseenter', () => {
          (bubble as HTMLElement).style.background = isObsidianNote 
            ? 'hsl(var(--card) / 0.95)' 
            : 'hsl(var(--muted) / 0.5)';
          (bubble as HTMLElement).style.borderColor = 'hsl(var(--border) / 0.8)';
          (bubble as HTMLElement).style.transform = isObsidianNote ? 'translateY(-1px)' : 'none';
          (bubble as HTMLElement).style.boxShadow = isObsidianNote 
            ? '0 4px 12px hsl(var(--background) / 0.4)' 
            : '0 1px 2px hsl(var(--background) / 0.05)';
        });
        bubble.addEventListener('mouseleave', () => {
          (bubble as HTMLElement).style.background = isObsidianNote 
            ? 'hsl(var(--card))' 
            : 'hsl(var(--muted) / 0.3)';
          (bubble as HTMLElement).style.borderColor = 'hsl(var(--border) / 0.5)';
          (bubble as HTMLElement).style.transform = 'none';
          (bubble as HTMLElement).style.boxShadow = isObsidianNote 
            ? '0 2px 8px hsl(var(--background) / 0.3)' 
            : '0 1px 2px rgba(0, 0, 0, 0.05)';
        });
        this.addListener(bubble, 'click', () => this.openItemDetail(item));

        // Content - special renderer for Obsidian notes
        const content = isObsidianNote 
          ? this.renderObsidianNoteContent(item)
          : this.renderItemContent(item);
        
        if (!isObsidianNote) {
          (content as HTMLElement).style.cssText = `
            font-family: var(--font-sans, 'Manrope', sans-serif);
            font-size: 0.875rem;
            line-height: 1.7;
            color: var(--foreground);
            margin-bottom: 0.75rem;
          `;
        }
        bubble.appendChild(content);
        
        // Check if item has linked todos
        const contentText = this.extractPreviewText(item) || '';
        const hasLinkedTodos = contentText.toLowerCase().includes('linear') || 
                               contentText.toLowerCase().includes('des-') ||
                               item.type === 'obsidian-note';
        
        if (hasLinkedTodos) {
          const todosSection = createElement('div', {
            className: 'mt-4 pt-4',
          });
          (todosSection as HTMLElement).style.cssText = `
            border-top: 1px solid hsl(var(--border) / 0.5);
            margin-top: ${isObsidianNote ? '1rem' : '1rem'};
            padding-top: ${isObsidianNote ? '1rem' : '1rem'};
          `;
          
          // Todos header badge - nicer styling for Obsidian
          const todoItems = this.extractTodoItems(contentText);
          const todosHeader = createElement('div');
          (todosHeader as HTMLElement).style.cssText = `
            background: hsl(var(--muted) / 0.4);
            color: var(--muted-foreground);
            padding: 0.375rem 0.625rem;
            border-radius: 0.5rem;
            font-size: 0.75rem;
            font-weight: 500;
            display: inline-block;
            margin-bottom: 0.875rem;
            opacity: 0.8;
            font-family: var(--font-sans, 'Manrope', sans-serif);
          `;
          // Count completed (first item is checked)
          const completedCount = todoItems.length > 0 ? 1 : 0;
          todosHeader.textContent = `${completedCount}/${todoItems.length} Linked todos`;
          todosSection.appendChild(todosHeader);
          
          // Todo items with checkboxes
          todoItems.forEach((todo, todoIndex) => {
            const todoItem = createElement('div', {
              className: 'flex items-center gap-3 py-1.5',
            });
            
            // Checkbox - circular, filled for first item
            const checkbox = createElement('div', {
              className: 'flex-shrink-0',
            });
            const isChecked = todoIndex === 0;
            (checkbox as HTMLElement).style.cssText = `
              width: 18px;
              height: 18px;
              border-radius: 50%;
              border: ${isChecked ? 'none' : '1.5px solid hsl(var(--border) / 0.6)'};
              background: ${isChecked ? 'hsl(var(--primary) / 0.8)' : 'transparent'};
              cursor: pointer;
              transition: all 0.15s;
              display: flex;
              align-items: center;
              justify-content: center;
            `;
            if (isChecked) {
              checkbox.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            }
            checkbox.addEventListener('mouseenter', () => {
              if (!isChecked) {
                (checkbox as HTMLElement).style.borderColor = 'hsl(var(--primary) / 0.6)';
                (checkbox as HTMLElement).style.background = 'hsl(var(--primary) / 0.1)';
              }
            });
            checkbox.addEventListener('mouseleave', () => {
              if (!isChecked) {
                (checkbox as HTMLElement).style.borderColor = 'hsl(var(--border) / 0.6)';
                (checkbox as HTMLElement).style.background = 'transparent';
              }
            });
            
            const todoText = createElement('span');
            (todoText as HTMLElement).style.cssText = `
              font-family: var(--font-sans, 'Manrope', sans-serif);
              font-size: 0.875rem;
              color: ${isChecked ? 'hsl(var(--primary) / 0.9)' : 'var(--foreground)'};
              opacity: ${isChecked ? '1' : '0.7'};
              font-weight: ${isChecked ? '500' : '400'};
            `;
            todoText.textContent = todo;
            todoItem.appendChild(checkbox);
            todoItem.appendChild(todoText);
            todosSection.appendChild(todoItem);
          });
          
          bubble.appendChild(todosSection);
        }

        // Footer with source badge inline
        const footer = createElement('div', {
          className: 'flex items-center gap-2 mt-3',
        });
        
        // Source badge ("using X") inline
        const sourceBadge = createElement('span', {
          className: 'inline-flex items-center gap-1.5',
        });
        (sourceBadge as HTMLElement).style.cssText = `
          background: hsl(var(--muted) / 0.5);
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--muted-foreground);
          opacity: 0.7;
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

        // Right-side timestamp
        const absoluteTime = createElement('div', {
          className: 'absolute right-0 top-0',
        });
        (absoluteTime as HTMLElement).style.cssText = `
          font-family: var(--font-sans, 'Manrope', sans-serif);
          font-size: 0.75rem;
          color: var(--muted-foreground);
          opacity: 0.4;
          white-space: nowrap;
        `;
        const timeStr = formatTime(item.timestamp);
        const dateStr = new Date(item.timestamp).toDateString();
        const todayStr = new Date().toDateString();
        absoluteTime.textContent = dateStr === todayStr ? timeStr : `${timeStr} ${formatFullDate(new Date(item.timestamp)).split(',')[0]}`;
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
  
  private renderObsidianNoteContent(item: TimelineItem): HTMLElement {
    const note = item.data as { title: string; body: string; path: string; mtime: number; tags?: string[] };
    const wrapper = createElement('div', { className: 'obsidian-note-content' });
    
    // Title - prominent
    const title = createElement('h3');
    (title as HTMLElement).style.cssText = `
      font-family: var(--font-sans, 'Manrope', sans-serif);
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--foreground);
      margin: 0 0 0.5rem 0;
      line-height: 1.4;
    `;
    title.textContent = note.title || 'Untitled';
    wrapper.appendChild(title);
    
    // Date - formatted nicely
    const date = createElement('div');
    (date as HTMLElement).style.cssText = `
      font-family: var(--font-sans, 'Manrope', sans-serif);
      font-size: 0.8125rem;
      color: var(--muted-foreground);
      margin-bottom: 0.75rem;
      opacity: 0.8;
    `;
    const dateObj = new Date(note.mtime);
    date.textContent = dateObj.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    wrapper.appendChild(date);
    
    // Preview text from body - clean and readable
    const bodyText = note.body.replace(/^---\n[\s\S]*?\n---\n?/, '').trim(); // Remove frontmatter
    const previewLength = 150;
    const preview = bodyText.length > previewLength 
      ? bodyText.substring(0, previewLength).trim() + '...' 
      : bodyText;
    
    // Check for links in preview
    const linkMatch = preview.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const hasLink = linkMatch !== null;
    
    const previewDiv = createElement('div');
    (previewDiv as HTMLElement).style.cssText = `
      font-family: var(--font-sans, 'Manrope', sans-serif);
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--foreground);
      margin-bottom: ${hasLink ? '0.5rem' : '0.75rem'};
      opacity: 0.9;
    `;
    
    // If markdown, parse it; otherwise just show text
    if (isMarkdown(preview)) {
      previewDiv.innerHTML = parseMarkdown(preview);
      setupMarkdownInteractivity(previewDiv);
    } else {
      previewDiv.textContent = preview;
    }
    wrapper.appendChild(previewDiv);
    
    // Extract and display link if present
    if (hasLink && linkMatch) {
      const linkText = linkMatch[1];
      const linkUrl = linkMatch[2];
      const linkEl = createElement('a', {
        attributes: { href: linkUrl, target: '_blank' },
      });
      (linkEl as HTMLElement).style.cssText = `
        font-family: var(--font-sans, 'Manrope', sans-serif);
        font-size: 0.875rem;
        color: hsl(var(--primary));
        text-decoration: underline;
        text-underline-offset: 2px;
        margin-bottom: 0.75rem;
        display: inline-block;
        transition: opacity 0.2s;
      `;
      linkEl.textContent = linkText;
      linkEl.addEventListener('mouseenter', () => {
        (linkEl as HTMLElement).style.opacity = '0.8';
      });
      linkEl.addEventListener('mouseleave', () => {
        (linkEl as HTMLElement).style.opacity = '1';
      });
      wrapper.appendChild(linkEl);
    }
    
    return wrapper;
  }
  
  private renderItemContent(item: TimelineItem): HTMLElement {
    const text = this.extractPreviewText(item) || 'No preview available';

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

/**
 * Virtual Scroller
 * Only renders visible items for massive performance gains with long lists
 * Based on the performance guide's virtual scrolling pattern
 */

export interface VirtualScrollOptions {
  container: HTMLElement;
  itemHeight: number;
  totalItems: number;
  renderItem: (index: number) => HTMLElement;
  overscan?: number;
  onLoadMore?: () => Promise<void>;
  loadMoreThreshold?: number;
}

export class VirtualScroller {
  private scrollTop = 0;
  private containerHeight = 0;
  private visibleStart = 0;
  private visibleEnd = 0;
  private renderedItems = new Map<number, HTMLElement>();
  private scrollContent: HTMLElement;
  private itemsContainer: HTMLElement;
  private resizeObserver: ResizeObserver;
  private isLoadingMore = false;
  
  constructor(private options: VirtualScrollOptions) {
    this.containerHeight = options.container.clientHeight;
    this.setupDOM();
    this.setupScrolling();
    this.setupResizeObserver();
    this.render();
  }
  
  private setupDOM(): void {
    const { container, totalItems, itemHeight } = this.options;
    
    // Clear container
    container.innerHTML = '';
    container.style.overflow = 'auto';
    container.style.position = 'relative';
    
    // Create scroll content (sets total scrollable height)
    this.scrollContent = document.createElement('div');
    this.scrollContent.style.height = `${totalItems * itemHeight}px`;
    this.scrollContent.style.position = 'relative';
    container.appendChild(this.scrollContent);
    
    // Create items container
    this.itemsContainer = document.createElement('div');
    this.itemsContainer.style.position = 'absolute';
    this.itemsContainer.style.top = '0';
    this.itemsContainer.style.left = '0';
    this.itemsContainer.style.right = '0';
    this.scrollContent.appendChild(this.itemsContainer);
  }
  
  private setupScrolling(): void {
    this.options.container.addEventListener('scroll', () => {
      this.scrollTop = this.options.container.scrollTop;
      this.render();
      this.checkLoadMore();
    });
  }
  
  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.containerHeight = entry.contentRect.height;
        this.render();
      }
    });
    this.resizeObserver.observe(this.options.container);
  }
  
  private async checkLoadMore(): Promise<void> {
    const { onLoadMore, loadMoreThreshold = 200, container, totalItems, itemHeight } = this.options;
    
    if (!onLoadMore || this.isLoadingMore) return;
    
    const scrollBottom = this.scrollTop + this.containerHeight;
    const totalHeight = totalItems * itemHeight;
    
    if (totalHeight - scrollBottom < loadMoreThreshold) {
      this.isLoadingMore = true;
      try {
        await onLoadMore();
      } finally {
        this.isLoadingMore = false;
      }
    }
  }
  
  private render(): void {
    const { itemHeight, totalItems, renderItem, overscan = 3 } = this.options;
    
    // Calculate visible range
    const start = Math.floor(this.scrollTop / itemHeight);
    const end = Math.ceil((this.scrollTop + this.containerHeight) / itemHeight);
    
    // Add overscan
    this.visibleStart = Math.max(0, start - overscan);
    this.visibleEnd = Math.min(totalItems, end + overscan);
    
    // Remove items outside visible range
    this.renderedItems.forEach((el, index) => {
      if (index < this.visibleStart || index >= this.visibleEnd) {
        el.remove();
        this.renderedItems.delete(index);
      }
    });
    
    // Add items in visible range
    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      if (!this.renderedItems.has(i)) {
        const item = renderItem(i);
        item.style.position = 'absolute';
        item.style.top = `${i * itemHeight}px`;
        item.style.left = '0';
        item.style.right = '0';
        item.style.height = `${itemHeight}px`;
        
        this.itemsContainer.appendChild(item);
        this.renderedItems.set(i, item);
      }
    }
  }
  
  /**
   * Update total items count (e.g., after loading more)
   */
  updateTotalItems(total: number): void {
    this.options.totalItems = total;
    this.scrollContent.style.height = `${total * this.options.itemHeight}px`;
    this.render();
  }
  
  /**
   * Scroll to a specific index
   */
  scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth'): void {
    const top = index * this.options.itemHeight;
    this.options.container.scrollTo({ top, behavior });
  }
  
  /**
   * Get current scroll position info
   */
  getScrollInfo(): { scrollTop: number; containerHeight: number; visibleStart: number; visibleEnd: number } {
    return {
      scrollTop: this.scrollTop,
      containerHeight: this.containerHeight,
      visibleStart: this.visibleStart,
      visibleEnd: this.visibleEnd,
    };
  }
  
  /**
   * Force re-render of visible items
   */
  refresh(): void {
    this.renderedItems.forEach(el => el.remove());
    this.renderedItems.clear();
    this.render();
  }
  
  /**
   * Clean up
   */
  destroy(): void {
    this.resizeObserver.disconnect();
    this.renderedItems.clear();
    this.options.container.innerHTML = '';
  }
}

/**
 * Variable height virtual scroller
 * For items with dynamic heights
 */
export class VariableVirtualScroller {
  private heights: number[] = [];
  private positions: number[] = [];
  private totalHeight = 0;
  private renderedItems = new Map<number, HTMLElement>();
  private scrollContent: HTMLElement;
  private itemsContainer: HTMLElement;
  private containerHeight = 0;
  private scrollTop = 0;
  
  constructor(
    private container: HTMLElement,
    private estimatedItemHeight: number,
    private renderItem: (index: number) => HTMLElement,
    private overscan = 3
  ) {
    this.containerHeight = container.clientHeight;
    this.setupDOM();
    this.setupScrolling();
  }
  
  private setupDOM(): void {
    this.container.innerHTML = '';
    this.container.style.overflow = 'auto';
    this.container.style.position = 'relative';
    
    this.scrollContent = document.createElement('div');
    this.scrollContent.style.position = 'relative';
    this.container.appendChild(this.scrollContent);
    
    this.itemsContainer = document.createElement('div');
    this.scrollContent.appendChild(this.itemsContainer);
  }
  
  private setupScrolling(): void {
    this.container.addEventListener('scroll', () => {
      this.scrollTop = this.container.scrollTop;
      this.render();
    });
  }
  
  /**
   * Set items and calculate positions
   */
  setItems(count: number, getHeight?: (index: number) => number): void {
    this.heights = [];
    this.positions = [];
    let position = 0;
    
    for (let i = 0; i < count; i++) {
      const height = getHeight ? getHeight(i) : this.estimatedItemHeight;
      this.heights.push(height);
      this.positions.push(position);
      position += height;
    }
    
    this.totalHeight = position;
    this.scrollContent.style.height = `${this.totalHeight}px`;
    this.render();
  }
  
  private render(): void {
    // Binary search for first visible item
    const startIndex = this.binarySearch(this.scrollTop);
    const endScrollTop = this.scrollTop + this.containerHeight;
    
    // Find end index
    let endIndex = startIndex;
    while (endIndex < this.positions.length && this.positions[endIndex] < endScrollTop) {
      endIndex++;
    }
    
    // Add overscan
    const visibleStart = Math.max(0, startIndex - this.overscan);
    const visibleEnd = Math.min(this.positions.length, endIndex + this.overscan);
    
    // Remove items outside range
    this.renderedItems.forEach((el, index) => {
      if (index < visibleStart || index >= visibleEnd) {
        el.remove();
        this.renderedItems.delete(index);
      }
    });
    
    // Add visible items
    for (let i = visibleStart; i < visibleEnd; i++) {
      if (!this.renderedItems.has(i)) {
        const item = this.renderItem(i);
        item.style.position = 'absolute';
        item.style.top = `${this.positions[i]}px`;
        item.style.left = '0';
        item.style.right = '0';
        
        this.itemsContainer.appendChild(item);
        this.renderedItems.set(i, item);
        
        // Update height if different from estimate
        const actualHeight = item.offsetHeight;
        if (actualHeight !== this.heights[i]) {
          this.updateHeight(i, actualHeight);
        }
      }
    }
  }
  
  private binarySearch(scrollTop: number): number {
    let low = 0;
    let high = this.positions.length - 1;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const position = this.positions[mid];
      
      if (position === scrollTop) {
        return mid;
      } else if (position < scrollTop) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    
    return Math.max(0, low - 1);
  }
  
  private updateHeight(index: number, newHeight: number): void {
    const diff = newHeight - this.heights[index];
    this.heights[index] = newHeight;
    
    // Update positions for all following items
    for (let i = index + 1; i < this.positions.length; i++) {
      this.positions[i] += diff;
    }
    
    this.totalHeight += diff;
    this.scrollContent.style.height = `${this.totalHeight}px`;
  }
  
  destroy(): void {
    this.renderedItems.clear();
    this.container.innerHTML = '';
  }
}

export default VirtualScroller;


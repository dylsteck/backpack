/**
 * Main Layout Component
 * Manages sidebar, topbar, and content area with modern design
 */

import { Component } from './Component';
import { store } from '../store';
import { router } from '../router';
import { createElement, clearChildren } from '../utils/dom';
import { Sidebar } from './Sidebar';
import { Timeline } from './Timeline';
import { VaultGrid } from './VaultGrid';
import { AppDetail } from './AppDetail';
import { Onboarding } from './Onboarding';
import { TopbarTitle } from './TopbarTitle';
import { SearchView } from './SearchView';

type RouteView = 'timeline' | 'apps' | 'app-detail' | 'onboarding' | 'search';

export class Layout extends Component {
  private sidebar: Sidebar | null = null;
  private topbar: TopbarTitle | null = null;
  private currentView: Component | null = null;
  private contentContainer: HTMLElement | null = null;
  private sidebarContainer: HTMLElement | null = null;
  private topbarContainer: HTMLElement | null = null;
  private topbarTitleEl: HTMLElement | null = null;
  private searchButtonEl: HTMLElement | null = null;
  private lastViewWasOnboarding: boolean = false;
  private lastView: RouteView | null = null;

  async init(): Promise<void> {
    this.render();

    // Subscribe to sidebar states
    this.subscribe(store.sidebarCollapsed, () => this.updateSidebarState());
  }

  render(): void {
    const isOnboarding = router.getCurrentPath() === '/onboarding' || this.lastViewWasOnboarding;

    if (isOnboarding && this.lastViewWasOnboarding) {
      this.lastViewWasOnboarding = false;
    }

    if (router.getCurrentPath() === '/onboarding') {
      this.lastViewWasOnboarding = true;

      // Onboarding has its own full-screen layout
      this.container.innerHTML = '';
      this.container.className = 'h-full w-full bg-gradient-soft';

      this.contentContainer = createElement('div', {
        className: 'h-full w-full',
      });
      this.container.appendChild(this.contentContainer);
      return;
    }

    // Main layout with sidebar
    this.container.innerHTML = '';
    this.container.className = 'relative flex h-screen w-full bg-background overflow-hidden text-foreground';
    this.searchButtonEl = null;

    // Topbar background (covers content area) - cleaner, more minimal
    this.topbarContainer = createElement('div', {
      className: 'fixed top-0 h-[var(--topbar-height)] z-40 bg-background/95 backdrop-blur-md border-b border-border/40 transition-all duration-300',
      attributes: {
        style: 'left: 0; right: 0; pointer-events: none;',
      },
    });
    this.container.appendChild(this.topbarContainer);

    // Topbar title container with integrated search
    this.topbarTitleEl = createElement('div', {
      className: 'fixed top-0 h-[var(--topbar-height)] z-[100] transition-[left] duration-200 ease-linear text-foreground select-none',
      attributes: {
        style: 'left: calc(16rem + 0.5rem); right: 0; pointer-events: auto; -webkit-app-region: drag;',
      },
    });

    const topbarInner = createElement('div', {
      className: 'content-wrap-left w-full h-full flex items-center justify-between',
    });
    this.topbarTitleEl.appendChild(topbarInner);

    const leftGroup = createElement('div', {
      className: 'flex items-center gap-1.5',
    });

    const sidebarToggle = createElement('button', {
      className: 'btn btn-ghost icon-btn',
      attributes: {
        type: 'button',
        'aria-label': 'Toggle sidebar',
        title: 'Toggle sidebar',
      },
    });
    (sidebarToggle as HTMLElement).style.cssText = `
      -webkit-app-region: no-drag;
      pointer-events: auto;
    `;
    sidebarToggle.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="3"/>
        <line x1="9" x2="9" y1="3" y2="21"/>
      </svg>
    `;
    this.addListener(sidebarToggle, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      store.sidebarCollapsed.update(c => !c);
    });
    leftGroup.appendChild(sidebarToggle);

    // Title section
    const titleSection = createElement('div', {
      className: 'flex items-center pointer-events-none',
    });
    leftGroup.appendChild(titleSection);
    this.topbar = new TopbarTitle(titleSection);
    this.topbar.init();
    topbarInner.appendChild(leftGroup);

    // Search button - inline with topbar
    this.searchButtonEl = createElement('button', {
      className: 'topbar-pill',
      attributes: {
        title: 'Search (⌘K)',
        type: 'button',
        'aria-label': 'Open search',
        id: 'search-button-topbar',
      },
    });
    // Ensure button is clickable and above other elements - CRITICAL: must have pointer-events
    (this.searchButtonEl as HTMLElement).style.cssText = `
      pointer-events: auto !important;
      z-index: 101 !important;
      position: relative;
      cursor: pointer !important;
      -webkit-app-region: no-drag !important;
      user-select: none;
      touch-action: manipulation;
    `;
    this.searchButtonEl.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.3-4.3"/>
      </svg>
      <span class="text-xs font-medium">Search...</span>
      <kbd class="kbd">⌘K</kbd>
    `;

    topbarInner.appendChild(this.searchButtonEl);
    this.container.appendChild(this.topbarTitleEl);
    this.attachSearchHandlers();

    // Sidebar (Left)
    this.sidebarContainer = createElement('aside', {
      className: 'w-64 h-full border-r border-border/70 bg-sidebar flex-shrink-0 flex flex-col transition-[width] duration-300',
      dataset: { state: 'expanded', sidebar: 'true' },
    });
    (this.sidebarContainer as HTMLElement).style.cssText += `
      z-index: 100;
      position: relative;
      overflow: visible;
    `;
    this.container.appendChild(this.sidebarContainer);
    this.sidebar = new Sidebar(this.sidebarContainer);
    this.sidebar.init();

    // Main content area
    const mainWrapper = createElement('div', {
      className: 'flex flex-row h-screen overflow-hidden flex-1 bg-gradient-soft',
    });
    (mainWrapper as HTMLElement).style.cssText = `
      display: flex;
      flex-direction: row;
      height: 100vh;
      overflow: hidden;
      flex: 1 1 0%;
      min-width: 0;
      max-width: 100%;
    `;

    const contentStack = createElement('div', {
      className: 'flex flex-col flex-1 min-w-0',
    });
    (contentStack as HTMLElement).style.cssText = `
      flex: 1 1 0%;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      overflow-x: hidden;
      overflow-y: hidden;
      position: relative;
    `;
    
    // Drag region - but don't block search button area
    const topbarSpacer = createElement('div', {
      className: 'h-[48px] shrink-0',
      attributes: {
        'aria-hidden': 'true',
      },
    });
    (topbarSpacer as HTMLElement).style.cssText = `
      pointer-events: none;
      -webkit-app-region: no-drag;
    `;
    contentStack.appendChild(topbarSpacer);

    // Content container
    this.contentContainer = createElement('div', {
      className: 'flex-1 overflow-y-auto min-h-0',
    });
    this.contentContainer.style.cssText = `
      flex: 1 1 0%;
      overflow-y: auto;
      min-height: 0;
      position: relative;
      min-width: 0;
      max-width: 100%;
    `;
    contentStack.appendChild(this.contentContainer);

    mainWrapper.appendChild(contentStack);

    this.container.appendChild(mainWrapper);

    // Ensure layout respects current sidebar state after re-render
    this.updateSidebarState();
  }

  private updateSidebarState(): void {
    const collapsed = store.sidebarCollapsed.get();
    const collapsedLeft = '76px'; // Just right of macOS traffic lights
    const expandedLeft = 'calc(16rem + 0.5rem)';

    if (this.sidebarContainer) {
      this.sidebarContainer.dataset.state = collapsed ? 'collapsed' : 'expanded';
      this.sidebarContainer.style.width = collapsed ? '0' : '16rem';
      this.sidebarContainer.style.borderRightWidth = collapsed ? '0' : '1px';
    }

    // Keep topbar background full-width for consistent color
    if (this.topbarContainer) {
      this.topbarContainer.style.left = '0';
    }

    if (this.topbarTitleEl) {
      this.topbarTitleEl.style.left = collapsed ? collapsedLeft : expandedLeft;
    }
    
    // Ensure search button stays attached when sidebar changes
    if (this.searchButtonEl && this.topbarTitleEl && !this.searchButtonEl.parentElement) {
      this.topbarTitleEl.appendChild(this.searchButtonEl);
    }
  }

  private attachSearchHandlers(): void {
    // Find button by ID if searchButtonEl is null (in case of re-render)
    if (!this.searchButtonEl) {
      this.searchButtonEl = document.getElementById('search-button-topbar') as HTMLButtonElement;
      if (!this.searchButtonEl) {
        console.warn('[Layout] Search button not found when attaching handlers');
        return;
      }
    }

    const handleClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      // Use router.navigate which handles both hash and store updates
      router.navigate('/search');
    };
    
    this.searchButtonEl.onclick = handleClick;
  }

  /**
   * Show a specific route view
   */
  showRoute(view: RouteView, params?: Record<string, string>): void {
    // Destroy current view
    if (this.currentView) {
      this.currentView.destroy();
      this.currentView = null;
    }

    // Re-render layout if switching to/from onboarding or search
    const isOnboarding = view === 'onboarding';
    const isSearch = view === 'search';
    const wasOnboarding = this.lastViewWasOnboarding && view !== 'onboarding';

    this.lastViewWasOnboarding = isOnboarding;

    if (!this.contentContainer || isOnboarding || isSearch || wasOnboarding) {
      // Hide sidebar and topbar for search view
      if (isSearch) {
        if (this.sidebarContainer) this.sidebarContainer.style.display = 'none';
        if (this.topbarContainer) this.topbarContainer.style.display = 'none';
        if (this.topbarTitleEl) this.topbarTitleEl.style.display = 'none';
      } else {
        if (this.sidebarContainer) this.sidebarContainer.style.display = '';
        if (this.topbarContainer) this.topbarContainer.style.display = '';
        if (this.topbarTitleEl) this.topbarTitleEl.style.display = '';
      }
      this.render();
    }

    if (!this.contentContainer) return;

    // Clear content
    clearChildren(this.contentContainer);

    // Restore scroll styles
    this.contentContainer.className = 'w-full flex-1 overflow-y-auto min-h-0';
    this.contentContainer.style.cssText = `
      width: 100%;
      flex: 1 1 0%;
      overflow-y: auto;
      min-height: 0;
      max-width: 100%;
      position: relative;
    `;

    // Create new view
    switch (view) {
      case 'timeline':
        this.currentView = new Timeline(this.contentContainer);
        break;
      case 'apps':
        this.currentView = new VaultGrid(this.contentContainer);
        break;
      case 'app-detail':
        this.currentView = new AppDetail(this.contentContainer, params?.appId);
        break;
      case 'onboarding':
        this.currentView = new Onboarding(this.contentContainer);
        break;
      case 'search':
        this.currentView = new SearchView(this.contentContainer);
        break;
    }

    this.currentView?.init();

    // Store last view
    this.lastView = view;

    // Update topbar
    this.topbar?.updateForRoute(view, params);
  }

  destroy(): void {
    this.sidebar?.destroy();
    this.topbar?.destroy();
    this.currentView?.destroy();
    super.destroy();
  }
}

export default Layout;

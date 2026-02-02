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

type RouteView = 'timeline' | 'apps' | 'app-detail' | 'onboarding';

export class Layout extends Component {
  private sidebar: Sidebar | null = null;
  private topbar: TopbarTitle | null = null;
  private currentView: Component | null = null;
  private contentContainer: HTMLElement | null = null;
  private sidebarContainer: HTMLElement | null = null;
  private topbarContainer: HTMLElement | null = null;
  private topbarTitleEl: HTMLElement | null = null;
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

    // Topbar background (covers content area) - cleaner, more minimal
    this.topbarContainer = createElement('div', {
      className: 'fixed top-0 h-[48px] z-40 bg-background/95 backdrop-blur-sm border-b border-border/40 transition-all duration-300',
      attributes: {
        style: 'left: calc(16rem + 0.5rem); right: 0;',
      },
    });
    this.container.appendChild(this.topbarContainer);

    // Topbar title - cleaner typography
    this.topbarTitleEl = createElement('div', {
      className: 'fixed top-0 h-[48px] flex items-center z-40 transition-[left] duration-200 ease-linear px-6 text-foreground select-none pointer-events-none',
      attributes: {
        style: 'left: calc(16rem + 0.5rem);',
      },
    });
    this.container.appendChild(this.topbarTitleEl);
    this.topbar = new TopbarTitle(this.topbarTitleEl);
    this.topbar.init();

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
    
    // Drag region
    const dragRegion = createElement('div', {
      className: 'draglayer h-[48px] shrink-0',
    });
    contentStack.appendChild(dragRegion);

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
  }

  private updateSidebarState(): void {
    const collapsed = store.sidebarCollapsed.get();
    const collapsedLeft = '130px';
    const expandedLeft = 'calc(16rem + 0.5rem)';

    if (this.sidebarContainer) {
      this.sidebarContainer.dataset.state = collapsed ? 'collapsed' : 'expanded';
      this.sidebarContainer.style.width = collapsed ? '0' : '16rem';
      this.sidebarContainer.style.borderRightWidth = collapsed ? '0' : '1px';
    }

    if (this.topbarContainer) {
      this.topbarContainer.style.left = collapsed ? collapsedLeft : expandedLeft;
    }

    if (this.topbarTitleEl) {
      this.topbarTitleEl.style.left = collapsed ? collapsedLeft : expandedLeft;
    }
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

    // Re-render layout if switching to/from onboarding
    const isOnboarding = view === 'onboarding';
    const wasOnboarding = this.lastViewWasOnboarding && view !== 'onboarding';

    this.lastViewWasOnboarding = isOnboarding;

    if (!this.contentContainer || isOnboarding || wasOnboarding) {
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

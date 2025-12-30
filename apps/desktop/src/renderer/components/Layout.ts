/**
 * Main Layout Component
 * Manages sidebar, topbar, and content area
 */

import { Component } from './Component';
import { store } from '../store';
import { router } from '../router';
import { createElement, clearChildren } from '../utils/dom';
import { Sidebar } from './Sidebar';
import { Timeline } from './Timeline';
import { AppsGrid } from './AppsGrid';
import { AppDetail } from './AppDetail';
import { Onboarding } from './Onboarding';
import { Chat } from './Chat';
import { TopbarTitle } from './TopbarTitle';

type RouteView = 'timeline' | 'apps' | 'app-detail' | 'onboarding' | 'chat';

export class Layout extends Component {
  private sidebar: Sidebar | null = null;
  private topbar: TopbarTitle | null = null;
  private currentView: Component | null = null;
  private contentContainer: HTMLElement | null = null;
  private sidebarContainer: HTMLElement | null = null;
  private topbarContainer: HTMLElement | null = null;
  private topbarTitleEl: HTMLElement | null = null;
  
  async init(): Promise<void> {
    this.render();
    
    // Subscribe to sidebar state
    this.subscribe(store.sidebarCollapsed, () => this.updateSidebarState());
  }
  
  render(): void {
    const isOnboarding = router.getCurrentPath() === '/onboarding';
    
    if (isOnboarding) {
      // Onboarding has its own full-screen layout
      this.container.innerHTML = '';
      this.container.className = 'h-full w-full';
      
      this.contentContainer = createElement('div', {
        className: 'h-full w-full',
      });
      this.container.appendChild(this.contentContainer);
      return;
    }
    
    // Main layout with sidebar
    this.container.innerHTML = '';
    this.container.className = 'relative flex h-screen w-full';
    
    // Full-width border line under topbar
    const borderLine = createElement('div', {
      className: 'fixed top-[44px] left-0 right-0 h-px bg-border z-50',
    });
    this.container.appendChild(borderLine);
    
    // Topbar background (covers content area)
    this.topbarContainer = createElement('div', {
      className: 'fixed top-0 h-[44px] z-40 bg-background',
      attributes: {
        style: 'left: calc(16rem + 0.5rem); right: 0;',
      },
    });
    this.container.appendChild(this.topbarContainer);
    
    // Topbar title
    this.topbarTitleEl = createElement('div', {
      className: 'fixed top-0 h-[44px] flex items-center z-40 transition-[left] duration-200 ease-linear text-base font-normal text-foreground select-none pointer-events-none',
      attributes: {
        style: 'left: calc(16rem + 0.5rem);',
      },
    });
    this.container.appendChild(this.topbarTitleEl);
    this.topbar = new TopbarTitle(this.topbarTitleEl);
    this.topbar.init();
    
    // Sidebar
    this.sidebarContainer = createElement('aside', {
      className: 'w-64 h-full border-r bg-sidebar flex-shrink-0 flex flex-col transition-[width] duration-200',
      dataset: { state: 'expanded' },
    });
    this.container.appendChild(this.sidebarContainer);
    this.sidebar = new Sidebar(this.sidebarContainer);
    this.sidebar.init();
    
    // Main content area
    const mainWrapper = createElement('div', {
      className: 'flex flex-col h-screen overflow-hidden flex-1',
    });
    
    // Drag region for window movement
    const dragRegion = createElement('div', {
      className: 'draglayer h-[44px] shrink-0',
    });
    mainWrapper.appendChild(dragRegion);
    
    // Content container - ensure it always has scroll capability
    this.contentContainer = createElement('div', {
      className: 'w-full flex-1 overflow-y-auto min-h-0',
    });
    // Set inline styles as backup to ensure scrolling always works
    this.contentContainer.style.cssText = 'width: 100%; flex: 1 1 0%; overflow-y: auto; min-height: 0;';
    mainWrapper.appendChild(this.contentContainer);
    
    this.container.appendChild(mainWrapper);
  }
  
  private updateSidebarState(): void {
    const collapsed = store.sidebarCollapsed.get();
    const collapsedLeft = '130px';  // 90px (after traffic lights) + 40px toggle button
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
    
    if (!this.contentContainer) {
      this.render();
    }
    
    // Re-render layout if switching to/from onboarding
    const isOnboarding = view === 'onboarding';
    const wasOnboarding = router.getCurrentPath() === '/onboarding' && view !== 'onboarding';
    
    if (isOnboarding || wasOnboarding) {
      this.render();
    }
    
    if (!this.contentContainer) return;
    
    // Clear content
    clearChildren(this.contentContainer);
    
    // CRITICAL: Always restore scroll styles after clearing
    // Components should never override this container's className
    // Use both className and inline styles to ensure scrolling always works
    this.contentContainer.className = 'w-full flex-1 overflow-y-auto min-h-0';
    this.contentContainer.style.cssText = 'width: 100%; flex: 1 1 0%; overflow-y: auto; min-height: 0;';
    
    // Create new view
    switch (view) {
      case 'timeline':
        this.currentView = new Timeline(this.contentContainer);
        break;
      case 'apps':
        this.currentView = new AppsGrid(this.contentContainer);
        break;
      case 'app-detail':
        this.currentView = new AppDetail(this.contentContainer, params?.appId);
        break;
      case 'onboarding':
        this.currentView = new Onboarding(this.contentContainer);
        break;
      case 'chat':
        this.currentView = new Chat(this.contentContainer);
        break;
    }
    
    this.currentView?.init();
    
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


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
import { ChatSidebar } from './ChatSidebar';

type RouteView = 'timeline' | 'apps' | 'app-detail' | 'onboarding';

export class Layout extends Component {
  private sidebar: Sidebar | null = null;
  private chatSidebar: ChatSidebar | null = null;
  private topbar: TopbarTitle | null = null;
  private currentView: Component | null = null;
  private contentContainer: HTMLElement | null = null;
  private sidebarContainer: HTMLElement | null = null;
  private chatSidebarContainer: HTMLElement | null = null;
  private topbarContainer: HTMLElement | null = null;
  private topbarTitleEl: HTMLElement | null = null;
  private lastViewWasOnboarding: boolean = false;
  
  async init(): Promise<void> {
    this.render();
    
    // Subscribe to sidebar states
    this.subscribe(store.sidebarCollapsed, () => this.updateSidebarState());
    this.subscribe(store.chatSidebarOpen, () => this.updateChatSidebarState());
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
    this.container.className = 'relative flex h-screen w-full bg-background overflow-hidden';
    
    // Subtle border line under topbar
    const borderLine = createElement('div', {
      className: 'fixed top-[44px] left-0 right-0 h-px bg-border/50 z-50',
    });
    this.container.appendChild(borderLine);
    
    // Topbar background (covers content area)
    this.topbarContainer = createElement('div', {
      className: 'fixed top-0 h-[44px] z-40 bg-background/80 backdrop-blur-sm transition-all duration-300',
      attributes: {
        style: 'left: calc(16rem + 0.5rem); right: 0;',
      },
    });
    this.container.appendChild(this.topbarContainer);
    
    // Topbar title
    this.topbarTitleEl = createElement('div', {
      className: 'fixed top-0 h-[44px] flex items-center z-40 transition-[left] duration-200 ease-linear text-base font-medium text-foreground select-none pointer-events-none',
      attributes: {
        style: 'left: calc(16rem + 0.5rem);',
      },
    });
    this.container.appendChild(this.topbarTitleEl);
    this.topbar = new TopbarTitle(this.topbarTitleEl);
    this.topbar.init();

    // Chat Toggle (Top Right)
    const chatToggle = document.createElement('button');
    chatToggle.className = 'fixed top-[6px] right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors z-[9999] cursor-pointer';
    chatToggle.style.cssText = '-webkit-app-region: no-drag; cursor: pointer;';
    chatToggle.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <line x1="15" x2="15" y1="3" y2="21"/>
      </svg>
    `;
    chatToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      store.chatSidebarOpen.update(v => !v);
    });
    document.body.appendChild(chatToggle);
    
    this.registerCleanup(() => {
      chatToggle.remove();
    });

    // Subscribe to chat sidebar state to hide this toggle when sidebar is open
    // (Sidebar has its own integrated close button to avoid overlap)
    this.subscribe(store.chatSidebarOpen, (open) => {
      chatToggle.style.display = open ? 'none' : 'flex';
    });
    
    // Sidebar (Left)
    this.sidebarContainer = createElement('aside', {
      className: 'w-64 h-full border-r border-border/50 bg-sidebar flex-shrink-0 flex flex-col transition-[width] duration-300',
      dataset: { state: 'expanded', sidebar: 'true' },
    });
    this.container.appendChild(this.sidebarContainer);
    this.sidebar = new Sidebar(this.sidebarContainer);
    this.sidebar.init();
    
    // Main content area
    const mainWrapper = createElement('div', {
      className: 'flex flex-row h-screen overflow-hidden flex-1 bg-gradient-soft',
    });
    
    const contentStack = createElement('div', {
      className: 'flex flex-col flex-1 min-w-0',
    });

    // Drag region
    const dragRegion = createElement('div', {
      className: 'draglayer h-[44px] shrink-0',
    });
    contentStack.appendChild(dragRegion);
    
    // Content container
    this.contentContainer = createElement('div', {
      className: 'w-full flex-1 overflow-y-auto min-h-0',
    });
    this.contentContainer.style.cssText = 'width: 100%; flex: 1 1 0%; overflow-y: auto; min-height: 0;';
    contentStack.appendChild(this.contentContainer);
    
    mainWrapper.appendChild(contentStack);

    // Chat Sidebar (Right)
    this.chatSidebarContainer = createElement('aside', {
      className: 'w-0 h-full flex-shrink-0 flex flex-col transition-all duration-300 overflow-hidden relative',
    });
    (this.chatSidebarContainer as HTMLElement).style.cssText = `
      min-width: 0;
      overflow: hidden;
    `;
    mainWrapper.appendChild(this.chatSidebarContainer);
    
    this.container.appendChild(mainWrapper);
    
    // Update initial state
    this.updateChatSidebarState();
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

  private updateChatSidebarState(): void {
    const open = store.chatSidebarOpen.get();
    const chatWidth = '320px';
    if (this.chatSidebarContainer) {
      // Only set width if not already set by resize handle
      if (!this.chatSidebarContainer.dataset.resized) {
        this.chatSidebarContainer.style.width = open ? chatWidth : '0';
      }

      if (open && !this.chatSidebar) {
        this.chatSidebar = new ChatSidebar(this.chatSidebarContainer);
        this.chatSidebar.init();
      }
    }

    if (this.topbarContainer) {
      const currentWidth = this.chatSidebarContainer?.offsetWidth || 320;
      this.topbarContainer.style.right = open ? `${currentWidth}px` : '0';
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
    this.contentContainer.style.cssText = 'width: 100%; flex: 1 1 0%; overflow-y: auto; min-height: 0;';
    
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
    
    // Update topbar
    this.topbar?.updateForRoute(view, params);
  }
  
  destroy(): void {
    this.sidebar?.destroy();
    this.chatSidebar?.destroy();
    this.topbar?.destroy();
    this.currentView?.destroy();
    super.destroy();
  }
}

export default Layout;

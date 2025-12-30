/**
 * Topbar Title Component
 * Shows current page title and optional filter dropdown
 */

import { Component } from './Component';
import { store } from '../store';
import { createElement } from '../utils/dom';

type RouteView = 'timeline' | 'apps' | 'app-detail' | 'onboarding' | 'chat';

const routeTitles: Record<RouteView, string> = {
  timeline: 'Home',
  apps: 'Apps',
  'app-detail': 'App Details',
  onboarding: 'Welcome',
  chat: 'Chat',
};

export class TopbarTitle extends Component {
  private titleElement: HTMLElement | null = null;
  private filterContainer: HTMLElement | null = null;
  private currentView: RouteView = 'timeline';
  
  async init(): Promise<void> {
    this.render();
    
    // Subscribe to sidebar collapsed state to update position
    this.subscribe(store.sidebarCollapsed, () => this.updatePosition());
  }
  
  render(): void {
    this.container.innerHTML = '';
    
    this.titleElement = createElement('span', {
      className: 'pointer-events-auto font-mono uppercase tracking-wider',
      textContent: routeTitles[this.currentView],
    });
    this.container.appendChild(this.titleElement);
  }
  
  private updatePosition(): void {
    const collapsed = store.sidebarCollapsed.get();
    this.container.style.left = collapsed
      ? 'calc(76px + 3rem + 2rem)'
      : 'calc(16rem + 0.5rem)';
  }
  
  /**
   * Update title for current route
   */
  updateForRoute(view: RouteView, params?: Record<string, string>): void {
    this.currentView = view;
    
    if (!this.titleElement) return;
    
    let title = routeTitles[view];
    
    // For app detail, try to get the app name
    if (view === 'app-detail' && params?.appId) {
      const apps = store.apps.get();
      const app = apps.find(a => 
        a.id.toLowerCase() === params.appId?.toLowerCase() ||
        a.name.toLowerCase().replace(/\s+/g, '-') === params.appId?.toLowerCase()
      );
      if (app) {
        title = app.name;
      }
    }
    
    this.titleElement.textContent = title;
  }
}

export default TopbarTitle;


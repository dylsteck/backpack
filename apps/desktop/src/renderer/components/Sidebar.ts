/**
 * Sidebar Component
 * Navigation sidebar with collapsible state
 */

import { Component } from './Component';
import { store, actions } from '../store';
import { isActive, createLink } from '../router';
import { createElement } from '../utils/dom';

// Import icon
import iconImage from '@/assets/images/icon.png';

interface NavItem {
  title: string;
  url: string;
  icon: string;
}

const navItems: NavItem[] = [
  {
    title: 'Home',
    url: '/',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  },
  {
    title: 'Apps',
    url: '/apps',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
  },
];

export class Sidebar extends Component {
  private navContainer: HTMLElement | null = null;
  
  async init(): Promise<void> {
    this.render();
    
    // Subscribe to route changes to update active state
    this.subscribe(store.currentRoute, () => this.updateActiveStates());
    this.subscribe(store.sidebarCollapsed, () => this.render());
  }
  
  render(): void {
    const collapsed = store.sidebarCollapsed.get();
    this.container.innerHTML = '';
    // Don't use dynamic Tailwind classes - they won't be generated
    this.container.className = 'h-full border-r bg-sidebar flex-shrink-0 flex flex-col transition-all duration-200 overflow-hidden';
    
    // Fixed toggle button - always visible, positioned well after traffic lights
    // Using inline styles to ensure -webkit-app-region works and button is clickable
    const toggleButton = document.createElement('button');
    toggleButton.className = 'fixed top-[6px] flex items-center justify-center w-8 h-8 rounded hover:bg-sidebar-accent/50 transition-colors';
    toggleButton.style.cssText = 'left: 90px; -webkit-app-region: no-drag; z-index: 9999; cursor: pointer;';
    toggleButton.setAttribute('aria-label', 'Toggle sidebar');
    toggleButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <line x1="9" x2="9" y1="3" y2="21"/>
      </svg>
    `;
    
    // Direct event listener to ensure it works
    toggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      store.sidebarCollapsed.update(c => !c);
    });
    
    // Append to body instead of sidebar to avoid any container issues
    document.body.appendChild(toggleButton);
    
    // Clean up on destroy
    this.registerCleanup(() => {
      toggleButton.remove();
    });
    
    // Don't render sidebar content when collapsed
    if (collapsed) {
      return;
    }
    
    // Top bar area (traffic lights space)
    const topBar = createElement('div', {
      className: 'relative flex h-[44px] items-center draglayer',
    });
    
    // Space for traffic lights on macOS + toggle button
    const trafficLightsSpace = createElement('div', { className: 'w-[130px] flex-shrink-0' });
    topBar.appendChild(trafficLightsSpace);
    this.container.appendChild(topBar);
    
    // Header with logo
    const header = createElement('header', {
      className: 'pt-3 px-2',
    });
    
    const logoLink = createLink('/', this.createLogoContent(collapsed), 'flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors');
    header.appendChild(logoLink);
    this.container.appendChild(header);
    
    // Navigation
    this.navContainer = createElement('nav', {
      className: 'flex-1 px-2 py-4',
    });
    
    const navList = createElement('ul', {
      className: 'space-y-1',
    });
    
    for (const item of navItems) {
      const li = this.createNavItem(item, collapsed);
      navList.appendChild(li);
    }
    
    this.navContainer.appendChild(navList);
    this.container.appendChild(this.navContainer);
    
    // Footer with theme toggle
    const footer = createElement('footer', {
      className: 'p-4 border-t border-sidebar-border',
    });
    
    if (!collapsed) {
      footer.appendChild(this.createThemeToggle());
    }
    
    this.container.appendChild(footer);
  }
  
  private createLogoContent(collapsed: boolean): HTMLElement {
    const wrapper = createElement('div', {
      className: 'flex items-center gap-3',
    });
    
    const iconWrapper = createElement('div', {
      className: 'flex aspect-square size-8 items-center justify-center rounded-lg',
    });
    
    const icon = createElement('img', {
      className: 'size-8 rounded-lg',
      attributes: {
        src: iconImage,
        alt: 'Cortex',
        loading: 'lazy',
      },
    });
    iconWrapper.appendChild(icon);
    wrapper.appendChild(iconWrapper);
    
    if (!collapsed) {
      const textWrapper = createElement('div', {
        className: 'grid flex-1 text-left text-sm leading-tight',
      });
      
      const title = createElement('span', {
        className: 'truncate font-semibold',
        textContent: 'Cortex',
      });
      
      const subtitle = createElement('span', {
        className: 'truncate text-xs text-sidebar-foreground/70',
        textContent: 'Your whole life in one app',
      });
      
      textWrapper.appendChild(title);
      textWrapper.appendChild(subtitle);
      wrapper.appendChild(textWrapper);
    }
    
    return wrapper;
  }
  
  private createNavItem(item: NavItem, collapsed: boolean): HTMLElement {
    const li = createElement('li');
    const active = isActive(item.url);
    
    const linkContent = createElement('div', {
      className: 'flex items-center gap-3',
    });
    
    const iconWrapper = createElement('span', {
      className: 'flex-shrink-0',
      innerHTML: item.icon,
    });
    linkContent.appendChild(iconWrapper);
    
    if (!collapsed) {
      const text = createElement('span', {
        textContent: item.title,
      });
      linkContent.appendChild(text);
    }
    
    const link = createLink(
      item.url,
      linkContent,
      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        active 
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
          : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
      }`
    );
    
    link.dataset.navItem = item.url;
    li.appendChild(link);
    
    return li;
  }
  
  private createThemeToggle(): HTMLElement {
    const wrapper = createElement('div', {
      className: 'flex items-center justify-between',
    });
    
    const label = createElement('span', {
      className: 'text-sm font-medium text-sidebar-foreground',
      textContent: 'Theme',
    });
    wrapper.appendChild(label);
    
    const toggleGroup = createElement('div', {
      className: 'flex items-center gap-1 bg-sidebar-accent rounded-lg p-1',
    });
    
    const themes: Array<{ value: 'light' | 'dark' | 'system'; icon: string; label: string }> = [
      {
        value: 'light',
        label: 'Light',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
      },
      {
        value: 'dark',
        label: 'Dark',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
      },
      {
        value: 'system',
        label: 'System',
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>`,
      },
    ];
    
    for (const theme of themes) {
      const button = createElement('button', {
        className: `p-1.5 rounded transition-colors ${
          store.theme.get() === theme.value
            ? 'bg-background text-foreground shadow-sm'
            : 'text-sidebar-foreground/70 hover:text-sidebar-foreground'
        }`,
        attributes: {
          'aria-label': theme.label,
          title: theme.label,
        },
        innerHTML: theme.icon,
      });
      
      this.addListener(button, 'click', () => {
        actions.setTheme(theme.value);
        this.render(); // Re-render to update active state
      });
      
      toggleGroup.appendChild(button);
    }
    
    wrapper.appendChild(toggleGroup);
    
    return wrapper;
  }
  
  private updateActiveStates(): void {
    if (!this.navContainer) return;
    
    const links = this.navContainer.querySelectorAll('[data-nav-item]');
    links.forEach((link) => {
      const url = (link as HTMLElement).dataset.navItem || '';
      const active = isActive(url);
      
      link.className = `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        active 
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
          : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
      }`;
    });
  }
}

export default Sidebar;


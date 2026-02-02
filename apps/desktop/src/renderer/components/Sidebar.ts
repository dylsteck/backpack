/**
 * Sidebar Component
 * Navigation sidebar with modern rounded design
 */

import { Component } from './Component';
import { store } from '../store';
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
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  },
  {
    title: 'Vault',
    url: '/apps',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
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
    this.container.className = 'h-full border-r border-border/70 bg-sidebar flex-shrink-0 flex flex-col transition-all duration-300 overflow-hidden';

    // Fixed toggle button
    const toggleButton = document.createElement('button');
    toggleButton.className = 'fixed top-[7px] flex items-center justify-center w-8 h-8 rounded-lg hover:bg-secondary/80 transition-colors';
    toggleButton.style.cssText = 'left: 90px; -webkit-app-region: no-drag; z-index: 9999; cursor: pointer;';
    toggleButton.setAttribute('aria-label', 'Toggle sidebar');
    toggleButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
        <line x1="9" x2="9" y1="3" y2="21"/>
      </svg>
    `;

    toggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      store.sidebarCollapsed.update(c => !c);
    });

    document.body.appendChild(toggleButton);

    this.registerCleanup(() => {
      toggleButton.remove();
    });

    if (collapsed) {
      return;
    }

    // Top bar area (traffic lights space)
    const topBar = createElement('div', {
      className: 'relative flex h-[44px] items-center draglayer',
    });

    const trafficLightsSpace = createElement('div', { className: 'w-[130px] flex-shrink-0' });
    topBar.appendChild(trafficLightsSpace);
    this.container.appendChild(topBar);

    // Header with logo
    const header = createElement('header', {
      className: 'pt-2 px-3',
    });

    const logoLink = createLink('/', this.createLogoContent(collapsed), 'flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/70 transition-colors');
    header.appendChild(logoLink);
    this.container.appendChild(header);

    // Navigation
    this.navContainer = createElement('nav', {
      className: 'flex-1 px-3 py-3',
    });

    const navList = createElement('ul', {
      className: 'space-y-0.5',
    });

    for (const item of navItems) {
      const li = this.createNavItem(item, collapsed);
      navList.appendChild(li);
    }

    this.navContainer.appendChild(navList);
    this.container.appendChild(this.navContainer);

  }

  private createLogoContent(collapsed: boolean): HTMLElement {
    const wrapper = createElement('div', {
      className: 'flex items-center gap-3',
    });

    const iconWrapper = createElement('div', {
      className: 'flex aspect-square size-8 items-center justify-center rounded-lg bg-secondary/80 border border-border/60',
    });

    const icon = createElement('img', {
      className: 'size-7',
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
        className: 'grid flex-1 text-left leading-tight',
      });

      const title = createElement('span', {
        className: 'truncate font-semibold text-[13px] tracking-tight',
        textContent: 'Cortex',
      });

      const subtitle = createElement('span', {
        className: 'truncate text-[11px] text-muted-foreground',
        textContent: 'Your personal timeline',
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
        className: 'text-[13px] font-medium',
        textContent: item.title,
      });
      linkContent.appendChild(text);
    }

    const link = createLink(
      item.url,
      linkContent,
      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150 ${active
        ? 'bg-card text-foreground border border-border/70 shadow-sm'
        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70'
      }`
    );

    link.dataset.navItem = item.url;
    li.appendChild(link);

    return li;
  }


  private updateActiveStates(): void {
    if (!this.navContainer) return;

    const links = this.navContainer.querySelectorAll('[data-nav-item]');
    links.forEach((link) => {
      const url = (link as HTMLElement).dataset.navItem || '';
      const active = isActive(url);

      link.className = `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
        }`;
    });
  }
}

export default Sidebar;

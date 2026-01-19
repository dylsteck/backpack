/**
 * Tasks Component
 * Tasks tab with command bar and inbox list
 */

import { Component } from './Component';
import { createElement } from '../utils/dom';

export class Tasks extends Component {
  private selectedTab: 'all' | 'inbox' = 'all';

  async init(): Promise<void> {
    this.render();
  }

  render(): void {
    this.container.innerHTML = '';
    this.container.className = 'h-full w-full overflow-y-auto';
    (this.container as HTMLElement).style.cssText = `
      background: hsl(var(--background));
      color: hsl(var(--foreground));
    `;

    const wrapper = createElement('div', {
      className: 'max-w-5xl mx-auto px-6 md:px-10 py-12',
    });

    // Header with title
    const header = createElement('div', {
      className: 'mb-10',
    });
    const title = createElement('h1', {
      textContent: 'Tasks',
    });
    (title as HTMLElement).style.cssText = `
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
      font-size: 3rem;
      font-weight: 700;
      color: hsl(var(--foreground));
      margin: 0 0 1.75rem 0;
      line-height: 1.1;
      letter-spacing: -0.03em;
    `;
    header.appendChild(title);

    // Tabs - Apple-style pill buttons
    const tabsContainer = createElement('div', {
      className: 'flex items-center gap-1.5 mb-10',
    });
    
    const allTab = createElement('button', {
      textContent: 'All',
    });
    (allTab as HTMLElement).style.cssText = `
      padding: 0.5rem 1.125rem;
      border-radius: 9999px;
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      background: ${this.selectedTab === 'all' ? 'hsl(var(--foreground))' : 'transparent'};
      color: ${this.selectedTab === 'all' ? 'hsl(var(--background))' : 'hsl(var(--foreground) / 0.65)'};
      border: none;
      letter-spacing: -0.01em;
    `;
    this.addListener(allTab, 'click', () => {
      this.selectedTab = 'all';
      this.render();
    });
    tabsContainer.appendChild(allTab);

    const inboxTab = createElement('button', {
      textContent: 'Inbox',
    });
    (inboxTab as HTMLElement).style.cssText = `
      padding: 0.5rem 1.125rem;
      border-radius: 9999px;
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      background: ${this.selectedTab === 'inbox' ? 'hsl(var(--foreground))' : 'transparent'};
      color: ${this.selectedTab === 'inbox' ? 'hsl(var(--background))' : 'hsl(var(--foreground) / 0.65)'};
      border: none;
      letter-spacing: -0.01em;
    `;
    this.addListener(inboxTab, 'click', () => {
      this.selectedTab = 'inbox';
      this.render();
    });
    tabsContainer.appendChild(inboxTab);

    header.appendChild(tabsContainer);
    wrapper.appendChild(header);

    // Command bar with refined glassmorphism
    const commandBar = createElement('div', {
      className: 'glass-panel-premium mb-10',
    });
    (commandBar as HTMLElement).style.cssText = `
      padding: 1.75rem;
      border-radius: 20px;
      margin-bottom: 2.5rem;
      background: hsl(var(--card) / 0.6);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid hsl(var(--border) / 0.3);
      box-shadow: 0 4px 16px hsl(var(--foreground) / 0.04);
    `;

    const searchInput = createElement('input', {
      attributes: {
        type: 'text',
        placeholder: 'Search web, send email, or create event',
      },
    });
    (searchInput as HTMLElement).style.cssText = `
      width: 100%;
      background: transparent;
      border: none;
      outline: none;
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
      font-size: 0.9375rem;
      font-weight: 400;
      color: hsl(var(--foreground));
      margin-bottom: 1.25rem;
      padding: 0;
      letter-spacing: -0.01em;
    `;
    searchInput.setAttribute('placeholder', 'Search web, send email, or create event');
    searchInput.id = 'tasks-search-input';
    commandBar.appendChild(searchInput);
    
    // Add placeholder styling
    if (!document.getElementById('tasks-placeholder-style')) {
      const placeholderStyle = document.createElement('style');
      placeholderStyle.id = 'tasks-placeholder-style';
      placeholderStyle.textContent = `
        #tasks-search-input::placeholder {
          color: hsl(var(--muted-foreground));
          opacity: 0.6;
          font-weight: 400;
        }
      `;
      document.head.appendChild(placeholderStyle);
    }

    // Command chips - Apple-style refined
    const chipsContainer = createElement('div', {
      className: 'flex items-center gap-2.5 flex-wrap',
    });
    
    const commands = [
      { 
        label: 'Get recent emails', 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`, 
        color: '#3b82f6' 
      },
      { 
        label: 'List events', 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`, 
        color: '#ef4444', 
        badge: '17' 
      },
      { 
        label: 'Create pages', 
        icon: `<div style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; font-size: 11px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">N</div>`, 
        color: '#000000' 
      },
      { 
        label: 'List customers', 
        icon: `<div style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; font-size: 11px; font-weight: 700; color: #8b5cf6; letter-spacing: -0.02em;">S</div>`, 
        color: '#8b5cf6' 
      },
      { 
        label: 'Launch agent', 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" x2="12" y1="22.08" y2="12"/></svg>`, 
        color: '#475569' 
      },
    ];

    commands.forEach(cmd => {
      const chip = createElement('button', {
        className: 'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl',
      });
      (chip as HTMLElement).style.cssText = `
        background: hsl(var(--muted) / 0.4);
        border: 1px solid hsl(var(--border) / 0.4);
        color: hsl(var(--foreground));
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        letter-spacing: -0.01em;
      `;
      chip.addEventListener('mouseenter', () => {
        (chip as HTMLElement).style.background = 'hsl(var(--muted) / 0.6)';
        (chip as HTMLElement).style.transform = 'translateY(-1px)';
        (chip as HTMLElement).style.boxShadow = '0 2px 8px hsl(var(--foreground) / 0.08)';
      });
      chip.addEventListener('mouseleave', () => {
        (chip as HTMLElement).style.background = 'hsl(var(--muted) / 0.4)';
        (chip as HTMLElement).style.transform = 'translateY(0)';
        (chip as HTMLElement).style.boxShadow = 'none';
      });

      const iconWrapper = createElement('div', {
        innerHTML: cmd.icon,
      });
      (iconWrapper as HTMLElement).style.cssText = `
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      `;
      chip.appendChild(iconWrapper);

      const label = createElement('span', {
        textContent: cmd.label,
      });
      chip.appendChild(label);

      if (cmd.badge) {
        const badge = createElement('span', {
          className: 'ml-0.5',
        });
        (badge as HTMLElement).style.cssText = `
          background: ${cmd.color};
          color: white;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.625rem;
          font-weight: 600;
          font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif);
          margin-left: 0.375rem;
        `;
        badge.textContent = cmd.badge;
        chip.appendChild(badge);
      }

      chipsContainer.appendChild(chip);
    });

    commandBar.appendChild(chipsContainer);
    wrapper.appendChild(commandBar);

    // Inbox section
    const inboxSection = createElement('div', {
      className: 'mb-8',
    });

    const inboxHeader = createElement('div', {
      className: 'flex items-center gap-2 mb-5',
    });
    (inboxHeader as HTMLElement).style.cssText = `
      cursor: pointer;
    `;
    const inboxTitle = createElement('h2', {
      textContent: 'Inbox',
    });
    (inboxTitle as HTMLElement).style.cssText = `
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
      font-size: 1.125rem;
      font-weight: 600;
      color: hsl(var(--foreground));
      margin: 0;
      letter-spacing: -0.01em;
    `;
    inboxHeader.appendChild(inboxTitle);

    const chevron = createElement('svg', {
      attributes: {
        width: '14',
        height: '14',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2.5',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    });
    chevron.innerHTML = '<path d="m9 18 6-6-6-6"/>';
    (chevron as HTMLElement).style.cssText = `
      color: hsl(var(--muted-foreground));
      opacity: 0.5;
    `;
    inboxHeader.appendChild(chevron);
    inboxSection.appendChild(inboxHeader);

    // Task list
    const taskList = createElement('div', {
      className: 'space-y-0.5',
    });

    const tasks = [
      { 
        text: "Today's Calendar Prep", 
        checked: false, 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`, 
        iconColor: '#ef4444', 
        badge: '17' 
      },
      { 
        text: 'Draft Follow-Up Email', 
        checked: false, 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`, 
        iconColor: '#3b82f6' 
      },
      { 
        text: 'Top Headlines', 
        checked: true, 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><rect width="10" height="7" x="11" y="11" rx="2"/></svg>`, 
        iconColor: '#ef4444' 
      },
      { 
        text: "Today's Meeting Recaps", 
        checked: false, 
        icon: `<div style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; font-size: 11px; font-weight: 700; color: #000000; letter-spacing: -0.02em;">N</div>`, 
        iconColor: '#000000' 
      },
      { 
        text: 'Team Spending Overview', 
        checked: false, 
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>`, 
        iconColor: '#10b981' 
      },
    ];

    tasks.forEach(task => {
      const taskItem = createElement('div', {
        className: 'flex items-center gap-3.5 py-2.5 px-3 rounded-xl hover:bg-muted/40 transition-all group',
      });
      (taskItem as HTMLElement).style.cssText = `
        cursor: pointer;
      `;

      // Checkbox - Apple-style circular
      const checkbox = createElement('div', {
        className: 'flex-shrink-0',
      });
      (checkbox as HTMLElement).style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid hsl(var(--border) / 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        ${task.checked ? `
          background: hsl(var(--foreground));
          border-color: hsl(var(--foreground));
        ` : `
          background: transparent;
        `}
      `;
      if (task.checked) {
        checkbox.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--background))" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `;
      }
      taskItem.appendChild(checkbox);

      // Task text - Apple typography
      const taskText = createElement('span', {
        textContent: task.text,
      });
      (taskText as HTMLElement).style.cssText = `
        flex: 1;
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif);
        font-size: 0.9375rem;
        font-weight: 400;
        color: ${task.checked ? 'hsl(var(--foreground) / 0.5)' : 'hsl(var(--foreground))'};
        text-decoration: ${task.checked ? 'line-through' : 'none'};
        letter-spacing: -0.01em;
        line-height: 1.4;
      `;
      taskItem.appendChild(taskText);

      // Right side icons
      const rightIcons = createElement('div', {
        className: 'flex items-center gap-2',
      });

      if (task.badge) {
        const badge = createElement('div', {
          className: 'flex items-center gap-1',
        });
        const badgeIcon = createElement('div', {
          innerHTML: task.icon,
        });
        (badgeIcon as HTMLElement).style.cssText = `
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        `;
        badge.appendChild(badgeIcon);
        const badgeNumber = createElement('div', {
          textContent: task.badge,
        });
        (badgeNumber as HTMLElement).style.cssText = `
          background: ${task.iconColor};
          color: white;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.625rem;
          font-weight: 600;
          font-family: var(--font-sans, 'Manrope', sans-serif);
        `;
        badge.appendChild(badgeNumber);
        rightIcons.appendChild(badge);
      } else {
        const icon = createElement('div', {
          innerHTML: task.icon,
        });
        (icon as HTMLElement).style.cssText = `
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        `;
        rightIcons.appendChild(icon);
      }

      const chevronRight = createElement('svg', {
        attributes: {
          width: '14',
          height: '14',
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '2.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        },
      });
      chevronRight.innerHTML = '<path d="m9 18 6-6-6-6"/>';
      (chevronRight as HTMLElement).style.cssText = `
        color: hsl(var(--muted-foreground));
        opacity: 0.4;
      `;
      rightIcons.appendChild(chevronRight);

      taskItem.appendChild(rightIcons);
      taskList.appendChild(taskItem);
    });

    inboxSection.appendChild(taskList);
    wrapper.appendChild(inboxSection);

    this.container.appendChild(wrapper);
  }
}

export default Tasks;

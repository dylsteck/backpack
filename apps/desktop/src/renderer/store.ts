/**
 * Observable State Management
 * Lightweight alternative to Redux/Context following the performance guide
 * ~100 lines vs Redux's kilobytes
 */

import type { 
  SourceType, 
  FilterConfig, 
  ThemeMode, 
  TimelineItem,
  AppServer,
  BrowserHistoryEntry,
} from './types';

type Listener<T> = (value: T, prevValue: T) => void;

/**
 * Observable class - core reactive primitive
 * Notifies subscribers when value changes
 */
export class Observable<T> {
  private value: T;
  private listeners: Set<Listener<T>> = new Set();
  
  constructor(initialValue: T) {
    this.value = initialValue;
  }
  
  /**
   * Get current value
   */
  get(): T {
    return this.value;
  }
  
  /**
   * Set new value and notify listeners
   * Skips if value is unchanged (shallow comparison)
   */
  set(newValue: T): void {
    if (this.value === newValue) return;
    const prevValue = this.value;
    this.value = newValue;
    this.notify(prevValue);
  }
  
  /**
   * Update value using a function (for complex state)
   */
  update(updater: (current: T) => T): void {
    this.set(updater(this.value));
  }
  
  /**
   * Subscribe to value changes
   * Returns unsubscribe function
   */
  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Notify all listeners of change
   */
  private notify(prevValue: T): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.value, prevValue);
      } catch (error) {
        console.error('Error in store listener:', error);
      }
    });
  }
}

/**
 * Computed observable - derives value from other observables
 */
export class Computed<T> {
  private observable: Observable<T>;
  private unsubscribers: (() => void)[] = [];
  
  constructor(
    compute: () => T,
    dependencies: Observable<unknown>[]
  ) {
    this.observable = new Observable(compute());
    
    // Subscribe to all dependencies
    for (const dep of dependencies) {
      const unsub = dep.subscribe(() => {
        this.observable.set(compute());
      });
      this.unsubscribers.push(unsub);
    }
  }
  
  get(): T {
    return this.observable.get();
  }
  
  subscribe(listener: Listener<T>): () => void {
    return this.observable.subscribe(listener);
  }
  
  destroy(): void {
    this.unsubscribers.forEach(fn => fn());
    this.unsubscribers = [];
  }
}

// ============================================
// Application Store
// ============================================

/**
 * Global application state
 */
export const store = {
  // Routing
  currentRoute: new Observable<string>(window.location.hash.slice(1) || '/'),
  routeParams: new Observable<Record<string, string>>({}),
  
  // UI State
  sidebarOpen: new Observable<boolean>(true),
  sidebarCollapsed: new Observable<boolean>(false),
  expandedItemId: new Observable<string | null>(null),
  
  // Theme
  theme: new Observable<ThemeMode>('system'),
  
  // Filters
  selectedSources: new Observable<SourceType[]>(['all']),
  filterConfig: new Observable<FilterConfig>(null),
  
  // Data caches
  timelineItems: new Observable<TimelineItem[]>([]),
  timelineCursor: new Observable<string | null>(null),
  timelineLoading: new Observable<boolean>(false),
  timelineError: new Observable<Error | null>(null),
  
  apps: new Observable<AppServer[]>([]),
  appsLoading: new Observable<boolean>(false),
  
  // Browser history (loaded via IPC)
  chromeHistory: new Observable<BrowserHistoryEntry[]>([]),
  braveHistory: new Observable<BrowserHistoryEntry[]>([]),
  
  // Onboarding
  hasSeenOnboarding: new Observable<boolean>(
    localStorage.getItem('hasSeenOnboarding') === 'true'
  ),
};

// Persist hasSeenOnboarding to localStorage
store.hasSeenOnboarding.subscribe((value) => {
  localStorage.setItem('hasSeenOnboarding', value.toString());
});

// Initialize theme from system/localStorage
function initializeTheme(): void {
  const savedTheme = localStorage.getItem('theme') as ThemeMode | null;
  if (savedTheme) {
    store.theme.set(savedTheme);
  }
  
  // Apply theme to document
  applyTheme(store.theme.get());
  
  // Subscribe to changes
  store.theme.subscribe((theme) => {
    localStorage.setItem('theme', theme);
    applyTheme(theme);
  });
}

function applyTheme(theme: ThemeMode): void {
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  document.documentElement.classList.toggle('dark', isDark);
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (store.theme.get() === 'system') {
    applyTheme('system');
  }
});

// Initialize on load
initializeTheme();

/**
 * Store actions - organized methods for state mutations
 */
export const actions = {
  // Navigation
  navigate(path: string, params?: Record<string, string>): void {
    window.location.hash = path;
    store.currentRoute.set(path);
    store.routeParams.set(params || {});
  },
  
  // Sidebar
  toggleSidebar(): void {
    store.sidebarOpen.update(open => !open);
  },
  
  collapseSidebar(): void {
    store.sidebarCollapsed.update(collapsed => !collapsed);
  },
  
  // Theme
  setTheme(theme: ThemeMode): void {
    store.theme.set(theme);
  },
  
  toggleTheme(): void {
    const current = store.theme.get();
    const next = current === 'dark' ? 'light' : 'dark';
    store.theme.set(next);
  },
  
  // Timeline
  setExpandedItem(id: string | null): void {
    store.expandedItemId.set(id);
  },
  
  toggleExpandedItem(id: string): void {
    store.expandedItemId.update(current => current === id ? null : id);
  },
  
  // Filters
  setSelectedSources(sources: SourceType[]): void {
    store.selectedSources.set(sources);
  },
  
  // Onboarding
  completeOnboarding(): void {
    store.hasSeenOnboarding.set(true);
  },
  
  // Apps
  setApps(apps: AppServer[]): void {
    store.apps.set(apps);
  },
  
  // Timeline data
  appendTimelineItems(items: TimelineItem[]): void {
    store.timelineItems.update(current => [...current, ...items]);
  },
  
  setTimelineCursor(cursor: string | null): void {
    store.timelineCursor.set(cursor);
  },
  
  // Browser history
  setChromeHistory(entries: BrowserHistoryEntry[]): void {
    store.chromeHistory.set(entries);
  },
  
  setBraveHistory(entries: BrowserHistoryEntry[]): void {
    store.braveHistory.set(entries);
  },
};

export default store;


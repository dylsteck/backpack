/**
 * Base Component Class
 * Provides lifecycle management and cleanup tracking
 * Following the performance guide's memory management patterns
 */

export abstract class Component {
  protected container: HTMLElement;
  protected cleanups: (() => void)[] = [];
  protected childComponents: Component[] = [];
  
  constructor(container: HTMLElement) {
    this.container = container;
  }
  
  /**
   * Initialize the component - called after constructor
   */
  abstract init(): void | Promise<void>;
  
  /**
   * Render the component's DOM
   */
  abstract render(): void;
  
  /**
   * Register a cleanup function to be called on destroy
   */
  protected registerCleanup(fn: () => void): void {
    this.cleanups.push(fn);
  }
  
  /**
   * Register an event listener with automatic cleanup
   */
  protected addListener<K extends keyof HTMLElementEventMap>(
    element: HTMLElement | Window | Document,
    event: K,
    handler: (e: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions
  ): void {
    element.addEventListener(event, handler as EventListener, options);
    this.registerCleanup(() => {
      element.removeEventListener(event, handler as EventListener, options);
    });
  }
  
  /**
   * Register an interval with automatic cleanup
   */
  protected registerInterval(callback: () => void, ms: number): number {
    const id = window.setInterval(callback, ms);
    this.registerCleanup(() => clearInterval(id));
    return id;
  }
  
  /**
   * Register a timeout with automatic cleanup
   */
  protected registerTimeout(callback: () => void, ms: number): number {
    const id = window.setTimeout(callback, ms);
    this.registerCleanup(() => clearTimeout(id));
    return id;
  }
  
  /**
   * Subscribe to an observable with automatic cleanup
   */
  protected subscribe<T>(
    observable: { subscribe: (fn: (value: T, prev: T) => void) => () => void },
    handler: (value: T, prev: T) => void
  ): void {
    const unsub = observable.subscribe(handler);
    this.registerCleanup(unsub);
  }
  
  /**
   * Mount a child component
   */
  protected mountChild<T extends Component>(
    ComponentClass: new (container: HTMLElement) => T,
    container: HTMLElement
  ): T {
    const child = new ComponentClass(container);
    this.childComponents.push(child);
    child.init();
    return child;
  }
  
  /**
   * Destroy the component and all children
   * Cleans up event listeners, intervals, subscriptions, etc.
   */
  destroy(): void {
    // Destroy children first
    for (const child of this.childComponents) {
      child.destroy();
    }
    this.childComponents = [];
    
    // Run all cleanups
    for (const cleanup of this.cleanups) {
      try {
        cleanup();
      } catch (error) {
        console.error('Error during component cleanup:', error);
      }
    }
    this.cleanups = [];
    
    // Clear container
    this.container.innerHTML = '';
  }
  
  /**
   * Re-render the component (destroy and rebuild)
   */
  protected rerender(): void {
    this.container.innerHTML = '';
    this.render();
  }
}

/**
 * Lazy component loader for code splitting
 */
export class LazyComponent {
  private loadedComponent: Component | null = null;
  private loading = false;
  
  constructor(
    private container: HTMLElement,
    private loader: () => Promise<{ default: new (container: HTMLElement) => Component }>
  ) {}
  
  async load(): Promise<Component> {
    if (this.loadedComponent) {
      return this.loadedComponent;
    }
    
    if (this.loading) {
      // Wait for existing load
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.loadedComponent) {
            clearInterval(check);
            resolve(this.loadedComponent);
          }
        }, 50);
      });
    }
    
    this.loading = true;
    
    // Show loading state
    this.container.innerHTML = `
      <div class="flex items-center justify-center h-full">
        <div class="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    `;
    
    try {
      const module = await this.loader();
      this.loadedComponent = new module.default(this.container);
      await this.loadedComponent.init();
      return this.loadedComponent;
    } finally {
      this.loading = false;
    }
  }
  
  destroy(): void {
    this.loadedComponent?.destroy();
    this.loadedComponent = null;
  }
}

export default Component;


/**
 * Lightweight Hash-based Router
 * ~100 lines vs TanStack Router's complexity
 * Supports dynamic params like /apps/:appId
 */

import { store, actions } from './store';

export interface RouteConfig {
  path: string;
  render: (params: Record<string, string>) => void;
  beforeEnter?: () => boolean | Promise<boolean>;
}

type RouteHandler = (params: Record<string, string>) => void;

class Router {
  private routes: Map<string, RouteConfig> = new Map();
  private currentCleanup: (() => void) | null = null;
  private notFoundHandler: RouteHandler | null = null;
  
  constructor() {
    // Listen for hash changes
    window.addEventListener('hashchange', () => this.handleRoute());
    
    // Also listen to store changes for programmatic navigation
    store.currentRoute.subscribe(() => this.handleRoute());
  }
  
  /**
   * Register a route
   */
  register(config: RouteConfig): this {
    this.routes.set(config.path, config);
    return this;
  }
  
  /**
   * Register multiple routes
   */
  registerAll(configs: RouteConfig[]): this {
    for (const config of configs) {
      this.register(config);
    }
    return this;
  }
  
  /**
   * Set 404 handler
   */
  notFound(handler: RouteHandler): this {
    this.notFoundHandler = handler;
    return this;
  }
  
  /**
   * Navigate to a path
   */
  navigate(path: string): void {
    actions.navigate(path);
  }
  
  /**
   * Get current path from hash
   */
  getCurrentPath(): string {
    const hash = window.location.hash.slice(1);
    return hash || '/';
  }
  
  /**
   * Start the router
   */
  start(): void {
    this.handleRoute();
  }
  
  /**
   * Handle route change
   */
  private async handleRoute(): Promise<void> {
    const path = this.getCurrentPath();
    
    // Clean up previous route
    if (this.currentCleanup) {
      this.currentCleanup();
      this.currentCleanup = null;
    }
    
    // Find matching route
    const { config, params } = this.matchRoute(path);
    
    if (config) {
      // Check beforeEnter guard
      if (config.beforeEnter) {
        const canEnter = await config.beforeEnter();
        if (!canEnter) return;
      }
      
      // Update store
      store.routeParams.set(params);
      
      // Render route
      config.render(params);
    } else if (this.notFoundHandler) {
      this.notFoundHandler({});
    } else {
      console.warn(`No route found for: ${path}`);
    }
  }
  
  /**
   * Match a path to a route config
   * Supports dynamic segments like :appId
   */
  private matchRoute(path: string): { config: RouteConfig | null; params: Record<string, string> } {
    // Exact match first
    const exact = this.routes.get(path);
    if (exact) {
      return { config: exact, params: {} };
    }
    
    // Try pattern matching
    for (const [pattern, config] of this.routes) {
      const params = this.matchPattern(pattern, path);
      if (params !== null) {
        return { config, params };
      }
    }
    
    return { config: null, params: {} };
  }
  
  /**
   * Match a pattern against a path
   * Returns params if match, null otherwise
   */
  private matchPattern(pattern: string, path: string): Record<string, string> | null {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);
    
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params: Record<string, string> = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      
      if (patternPart.startsWith(':')) {
        // Dynamic segment
        const paramName = patternPart.slice(1);
        params[paramName] = pathPart;
      } else if (patternPart !== pathPart) {
        // Static segment mismatch
        return null;
      }
    }
    
    return params;
  }
  
  /**
   * Set cleanup function for current route
   */
  setCleanup(cleanup: () => void): void {
    this.currentCleanup = cleanup;
  }
}

// Create singleton router instance
export const router = new Router();

/**
 * Helper to create a link element that navigates on click
 */
export function createLink(
  href: string, 
  content: string | HTMLElement,
  className?: string
): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = `#${href}`;
  link.className = className || '';
  
  if (typeof content === 'string') {
    link.textContent = content;
  } else {
    link.appendChild(content);
  }
  
  // Prevent default and use router
  link.addEventListener('click', (e) => {
    e.preventDefault();
    router.navigate(href);
  });
  
  return link;
}

/**
 * Check if a path is currently active
 */
export function isActive(path: string): boolean {
  const current = router.getCurrentPath();
  
  // Exact match
  if (current === path) return true;
  
  // Prefix match for nested routes (e.g., /apps active when on /apps/chrome)
  if (path !== '/' && current.startsWith(path + '/')) return true;
  
  return false;
}

export default router;


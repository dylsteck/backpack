/**
 * Vanilla TypeScript Renderer Entry Point
 * Following the performance guide for lightning-fast Electron apps
 */

import { store, actions } from './store';
import { router } from './router';
import { fetchAppsWithCache, checkHealth, initializeApi } from './api';
import { Layout } from './components/Layout';
import { getElementById } from './utils/dom';

// Performance tracking
const perfMarks = {
  start: 'app-init-start',
  domReady: 'app-dom-ready',
  routerReady: 'app-router-ready',
  dataLoaded: 'app-data-loaded',
  end: 'app-init-end',
};

performance.mark(perfMarks.start);

/**
 * Main application class
 */
class App {
  private layout: Layout | null = null;
  private cleanups: (() => void)[] = [];
  
  async init(): Promise<void> {
    console.time('app-init');
    
    // Wait for DOM
    if (document.readyState === 'loading') {
      await new Promise<void>(resolve => {
        document.addEventListener('DOMContentLoaded', () => resolve());
      });
    }
    performance.mark(perfMarks.domReady);
    
    // Initialize API with server port
    await initializeApi();
    
    // Get app container
    const appContainer = getElementById<HTMLDivElement>('app');
    if (!appContainer) {
      throw new Error('App container not found');
    }
    
    // Check if should redirect to onboarding
    if (!store.hasSeenOnboarding.get() && router.getCurrentPath() !== '/onboarding') {
      router.navigate('/onboarding');
    }
    
    // Initialize layout
    this.layout = new Layout(appContainer);
    await this.layout.init();
    
    // Set up routes
    this.setupRoutes();
    performance.mark(perfMarks.routerReady);
    
    // Start router
    router.start();
    
    // Prefetch data in background
    this.prefetchData();
    
    console.timeEnd('app-init');
    performance.mark(perfMarks.end);
    
    // Log performance metrics
    this.logPerformance();
  }
  
  private setupRoutes(): void {
    router.registerAll([
      {
        path: '/',
        render: () => this.layout?.showRoute('timeline'),
        beforeEnter: () => {
          // Redirect to onboarding if not seen
          if (!store.hasSeenOnboarding.get()) {
            router.navigate('/onboarding');
            return false;
          }
          return true;
        },
      },
      {
        path: '/apps',
        render: () => this.layout?.showRoute('apps'),
      },
      {
        path: '/apps/:appId',
        render: (params) => this.layout?.showRoute('app-detail', params),
      },
      {
        path: '/chat',
        render: () => this.layout?.showRoute('chat'),
      },
      {
        path: '/onboarding',
        render: () => this.layout?.showRoute('onboarding'),
      },
    ]);
    
    router.notFound(() => {
      // Redirect to home
      router.navigate('/');
    });
  }
  
  private async prefetchData(): Promise<void> {
    try {
      // Check API health
      const healthy = await checkHealth();
      if (!healthy) {
        console.warn('API health check failed');
      }
      
      // Prefetch apps list
      await fetchAppsWithCache();
      performance.mark(perfMarks.dataLoaded);
    } catch (error) {
      console.error('Failed to prefetch data:', error);
    }
  }
  
  private logPerformance(): void {
    // Log all performance measures
    performance.measure('DOM Ready', perfMarks.start, perfMarks.domReady);
    performance.measure('Router Setup', perfMarks.domReady, perfMarks.routerReady);
    performance.measure('Total Init', perfMarks.start, perfMarks.end);
    
    const measures = performance.getEntriesByType('measure');
    console.group('Performance Metrics');
    for (const measure of measures) {
      console.log(`${measure.name}: ${measure.duration.toFixed(2)}ms`);
    }
    console.groupEnd();
  }
  
  /**
   * Clean up application
   */
  destroy(): void {
    this.layout?.destroy();
    this.cleanups.forEach(fn => fn());
  }
}

// Initialize app
const app = new App();
app.init().catch(error => {
  console.error('Failed to initialize app:', error);
  
  // Show error UI
  const appContainer = getElementById<HTMLDivElement>('app');
  if (appContainer) {
    appContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full p-8 text-center">
        <div class="text-red-500 text-xl mb-4">Failed to initialize app</div>
        <div class="text-muted-foreground">${error.message}</div>
        <button 
          class="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
          onclick="window.location.reload()"
        >
          Reload
        </button>
      </div>
    `;
  }
});

// Handle window unload
window.addEventListener('beforeunload', () => {
  app.destroy();
});

// Expose app for debugging in development
if (import.meta.env.DEV) {
  (window as unknown as { __app: App; __store: typeof store; __actions: typeof actions }).__app = app;
  (window as unknown as { __store: typeof store }).__store = store;
  (window as unknown as { __actions: typeof actions }).__actions = actions;
}

export default app;


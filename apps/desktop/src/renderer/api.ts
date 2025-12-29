/**
 * Vanilla tRPC Client
 * Type-safe API calls without React hooks
 */

import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import type { AppRouter } from '@cortex/api/routers';
import { store, actions } from './store';
import type { TimelineItem, AppServer } from './types';

// API URL - will be set dynamically based on server port
let API_URL = 'http://localhost:3000';
let apiClient: TRPCClient<AppRouter> | null = null;

/**
 * Initialize API with dynamic server port
 */
export async function initializeApi(): Promise<void> {
  // Try to get server port from IPC
  if (typeof window !== 'undefined' && window.serverApi) {
    try {
      const port = await window.serverApi.getPort();
      if (port) {
        API_URL = `http://localhost:${port}`;
        console.log(`[API] Using server port: ${port}`);
      }
      
      // Listen for port changes
      window.serverApi.onPortChange((newPort) => {
        API_URL = `http://localhost:${newPort}`;
        apiClient = null; // Reset client to use new URL
        console.log(`[API] Server port changed to: ${newPort}`);
      });
    } catch (error) {
      console.warn('[API] Failed to get server port, using default:', error);
    }
  }
}

// Allow setting API URL dynamically (for when server port is assigned)
export function setApiUrl(url: string): void {
  API_URL = url;
  apiClient = null; // Reset client
}

/**
 * Get or create tRPC client
 */
function getApiClient(): TRPCClient<AppRouter> {
  if (!apiClient) {
    apiClient = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: `${API_URL}/trpc`,
          async fetch(url, options) {
            try {
              const response = await fetch(url, {
                ...options,
                credentials: 'include',
              });
              if (!response.ok) {
                console.error(`[API] Request failed: ${response.status} ${response.statusText}`);
              }
              return response;
            } catch (error) {
              console.error('[API] Fetch error:', error);
              throw error;
            }
          },
        }),
      ],
    });
  }
  return apiClient;
}

// Export api as a getter
export const api = new Proxy({} as TRPCClient<AppRouter>, {
  get(_, prop) {
    return getApiClient()[prop as keyof TRPCClient<AppRouter>];
  },
});

/**
 * Timeline data fetching
 */
export async function fetchTimeline(
  limit = 25,
  cursor?: string
): Promise<{ items: TimelineItem[]; nextCursor?: string }> {
  store.timelineLoading.set(true);
  store.timelineError.set(null);
  
  try {
    // Use the raw tRPC client
    const result = await api.timeline.getTimeline.query({ 
      limit, 
      cursor: cursor || undefined 
    }) as { items: Array<{ id: string; timestamp: string; source: string; type: string; data: unknown }>; nextCursor?: string };
    
    // Transform timestamps to Date objects
    const items: TimelineItem[] = result.items.map((item) => ({
      ...item,
      timestamp: new Date(item.timestamp),
      source: item.source as TimelineItem['source'],
    }));
    
    return {
      items,
      nextCursor: result.nextCursor,
    };
  } catch (error) {
    store.timelineError.set(error instanceof Error ? error : new Error('Failed to fetch timeline'));
    throw error;
  } finally {
    store.timelineLoading.set(false);
  }
}

/**
 * Load initial timeline data
 */
export async function loadInitialTimeline(): Promise<void> {
  const result = await fetchTimeline(25);
  actions.appendTimelineItems(result.items);
  actions.setTimelineCursor(result.nextCursor || null);
}

/**
 * Load more timeline items (infinite scroll)
 */
export async function loadMoreTimeline(): Promise<boolean> {
  const cursor = store.timelineCursor.get();
  if (!cursor || store.timelineLoading.get()) {
    return false;
  }
  
  const result = await fetchTimeline(25, cursor);
  actions.appendTimelineItems(result.items);
  actions.setTimelineCursor(result.nextCursor || null);
  
  return result.items.length > 0;
}

/**
 * Apps data fetching
 */
export async function fetchApps(): Promise<AppServer[]> {
  store.appsLoading.set(true);
  
  try {
    const result = await api.apps.getAvailableServers.query() as { servers: AppServer[] };
    const apps = result.servers || [];
    actions.setApps(apps);
    return apps;
  } catch (error) {
    console.error('[API] Failed to fetch apps:', error);
    throw error;
  } finally {
    store.appsLoading.set(false);
  }
}

/**
 * Get a single app by ID
 */
export function getAppById(appId: string): AppServer | undefined {
  return store.apps.get().find(
    app => app.id.toLowerCase() === appId.toLowerCase() ||
           app.name.toLowerCase().replace(/\s+/g, '-') === appId.toLowerCase()
  );
}

/**
 * Check health endpoint
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const result = await api.healthCheck.query();
    return result === 'OK';
  } catch {
    return false;
  }
}

/**
 * Simple data cache with TTL
 */
class DataCache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  
  constructor(private ttlMs: number) {}
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
  
  invalidate(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

// Caches with 5 minute TTL
export const appsCache = new DataCache<AppServer[]>(5 * 60 * 1000);
export const timelineCache = new DataCache<TimelineItem[]>(60 * 1000); // 1 minute for timeline

/**
 * Fetch apps with caching
 */
export async function fetchAppsWithCache(): Promise<AppServer[]> {
  const cached = appsCache.get('apps');
  if (cached) {
    actions.setApps(cached);
    return cached;
  }
  
  const apps = await fetchApps();
  appsCache.set('apps', apps);
  return apps;
}

export default api;


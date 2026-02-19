/**
 * Chrome/Brave browser history types
 */

/**
 * Chrome history item from the SQLite database
 */
export interface HistoryItem {
  /** Chrome's URL id from the urls table */
  id: number;
  
  /** The URL that was visited */
  url: string;
  
  /** Page title */
  title: string;
  
  /** Number of times this URL has been visited */
  visit_count: number;
  
  /** Chrome timestamp - microseconds since Jan 1, 1601 UTC */
  last_visit_time: number;
  
  /** Number of times this URL was typed directly */
  typed_count: number;
}

/**
 * Supported browser types
 */
export type BrowserType = 'chrome' | 'brave' | 'edge' | 'arc';

/**
 * Chrome sync configuration
 */
export interface ChromeConfig {
  /** Browser type - determines default path */
  browser: BrowserType;
  
  /** Optional override for profile path (e.g., "Default" or "Profile 1") */
  profilePath?: string;
  
  /** Optional override for full path to History file */
  historyPath?: string;
  
  /** Number of days to sync (default: 30) */
  daysToSync?: number;
}

/**
 * Chrome sync state for incremental syncs
 */
export interface ChromeSyncState {
  /** Last synced Chrome timestamp (microseconds since 1601) */
  lastSyncTime: number;
  
  /** Total number of history items synced */
  syncedCount: number;
}

/**
 * Default paths for browser History files by OS
 */
export const DEFAULT_BROWSER_PATHS: Record<BrowserType, Record<string, string>> = {
  chrome: {
    darwin: '~/Library/Application Support/Google/Chrome',
    linux: '~/.config/google-chrome',
    win32: '%LOCALAPPDATA%\\Google\\Chrome',
  },
  brave: {
    darwin: '~/Library/Application Support/BraveSoftware/Brave-Browser',
    linux: '~/.config/BraveSoftware/Brave-Browser',
    win32: '%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser',
  },
  edge: {
    darwin: '~/Library/Application Support/Microsoft Edge',
    linux: '~/.config/microsoft-edge',
    win32: '%LOCALAPPDATA%\\Microsoft\\Edge',
  },
  arc: {
    darwin: '~/Library/Application Support/Arc/User Data',
    linux: '~/.config/arc', // May not be supported on Linux
    win32: '%LOCALAPPDATA%\\Arc\\User Data',
  },
};

/**
 * Chrome timestamp conversion constants
 * 
 * Chrome stores timestamps as microseconds since Jan 1, 1601 00:00:00 UTC
 * Unix timestamps are milliseconds since Jan 1, 1970 00:00:00 UTC
 * 
 * Difference between 1601 and 1970: 11644473600 seconds
 * In microseconds: 11644473600000000
 */
export const CHROME_EPOCH_OFFSET = 11644473600000000; // microseconds

/**
 * Convert Chrome timestamp to Unix timestamp (milliseconds)
 * @param chromeTime - Chrome timestamp in microseconds since 1601
 * @returns Unix timestamp in milliseconds
 */
export function chromeTimestampToUnix(chromeTime: number): number {
  return (chromeTime - CHROME_EPOCH_OFFSET) / 1000;
}

/**
 * Convert Unix timestamp to Chrome timestamp
 * @param unixTime - Unix timestamp in milliseconds
 * @returns Chrome timestamp in microseconds since 1601
 */
export function unixTimestampToChrome(unixTime: number): number {
  return (unixTime * 1000) + CHROME_EPOCH_OFFSET;
}

/**
 * Get the cutoff Chrome timestamp for syncing last N days
 * @param days - Number of days to sync
 * @returns Chrome timestamp (microseconds since 1601)
 */
export function getCutoffTimestamp(days: number = 30): number {
  const now = Date.now();
  const cutoff = now - (days * 24 * 60 * 60 * 1000);
  return unixTimestampToChrome(cutoff);
}

/**
 * Check if a URL should be excluded from syncing
 * @param url - The URL to check
 * @returns true if URL should be excluded
 */
export function shouldExcludeUrl(url: string): boolean {
  // Exclude internal browser URLs
  if (url.startsWith('chrome://')) return true;
  if (url.startsWith('chrome-')) return true;
  if (url.startsWith('file://')) return true;
  if (url.startsWith('devtools://')) return true;
  if (url.startsWith('view-source:')) return true;
  if (url.startsWith('javascript:')) return true;
  if (url.startsWith('about:')) return true;
  if (url.startsWith('blob:')) return true;
  if (url.startsWith('data:')) return true;
  
  // Exclude extension pages
  if (url.startsWith('chrome-extension://')) return true;
  if (url.startsWith('edge://')) return true;
  if (url.startsWith('brave://')) return true;
  
  return false;
}

/**
 * Browser Session Manager
 * Handles saving and loading browser sessions from database
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import { getDatabasePath, getDefaultDatabasePath } from '../ipc/database/database-listeners';
import safeConsole from '../safe-console';

export interface BrowserSessionTab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
}

export interface BrowserSession {
  id: string;
  tabs: BrowserSessionTab[];
  activeTabId: string | null;
}

const SESSION_ID = 'default-browser-session';

// Debounce state for session saving
let saveTimeout: NodeJS.Timeout | null = null;
let lastSaveTime = 0;
const MIN_SAVE_INTERVAL = 5000; // Don't save more than once every 5 seconds

/**
 * Save browser session to database (debounced)
 */
export function saveBrowserSession(tabs: BrowserSessionTab[], activeTabId: string | null): void {
  // Debounce: only save once every MIN_SAVE_INTERVAL
  const now = Date.now();
  const timeSinceLastSave = now - lastSaveTime;
  
  // If we recently saved, schedule a save for later
  if (timeSinceLastSave < MIN_SAVE_INTERVAL) {
    if (!saveTimeout) {
      saveTimeout = setTimeout(() => {
        saveTimeout = null;
        saveBrowserSessionImmediate(tabs, activeTabId);
      }, MIN_SAVE_INTERVAL - timeSinceLastSave);
    }
    return;
  }
  
  // Save immediately
  saveBrowserSessionImmediate(tabs, activeTabId);
}

/**
 * Actually save browser session to database
 */
function saveBrowserSessionImmediate(tabs: BrowserSessionTab[], activeTabId: string | null): void {
  try {
    // Try to get configured path, fallback to default
    let dbPath = getDatabasePath();
    if (!dbPath) {
      dbPath = getDefaultDatabasePath();
    }
    
    if (!fs.existsSync(dbPath)) {
      return; // Silently skip if DB not ready
    }

    const db = new Database(dbPath);
    
    const now = Date.now();
    lastSaveTime = now;
    const tabsJson = JSON.stringify(tabs);
    
    // Check if session exists
    const existing = db.prepare('SELECT id FROM browser_sessions WHERE id = ?').get(SESSION_ID);
    
    if (existing) {
      // Update existing session
      db.prepare(`
        UPDATE browser_sessions 
        SET tabs = ?, active_tab_id = ?, updated_at = ?
        WHERE id = ?
      `).run(tabsJson, activeTabId, now, SESSION_ID);
    } else {
      // Create new session
      db.prepare(`
        INSERT INTO browser_sessions (id, tabs, active_tab_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(SESSION_ID, tabsJson, activeTabId, now, now);
    }
    
    db.close();
    // Removed console.log to prevent I/O overflow
  } catch (error) {
    // Silently ignore errors to prevent crash
  }
}

/**
 * Load browser session from database
 */
export function loadBrowserSession(): BrowserSession | null {
  try {
    // Try to get configured path, fallback to default
    let dbPath = getDatabasePath();
    if (!dbPath) {
      dbPath = getDefaultDatabasePath();
    }
    
    if (!fs.existsSync(dbPath)) {
      safeConsole.log('[BrowserSession] Database not initialized, no session to load');
      return null;
    }

    const db = new Database(dbPath);
    
    const session = db.prepare('SELECT * FROM browser_sessions WHERE id = ?').get(SESSION_ID) as any;
    
    db.close();
    
    if (!session) {
      console.log('[BrowserSession] No saved session found');
      return null;
    }
    
    const tabs = session.tabs ? JSON.parse(session.tabs) : [];
    
    return {
      id: session.id,
      tabs: tabs,
      activeTabId: session.active_tab_id || null,
    };
  } catch (error) {
    safeConsole.error('[BrowserSession] Failed to load session:', error);
    return null;
  }
}

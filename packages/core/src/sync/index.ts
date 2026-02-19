/**
 * Sync module exports
 */

// Types
export * from "./types.js";

// Base syncer
export { BaseSyncer } from "./base.js";

// Sync manager
export { SyncManager, createSyncManager } from "./manager.js";

// Source syncers
export * from "./sources/index.js";

import { SyncManager } from "./manager.js";
import { ObsidianSyncer } from "./sources/obsidian.js";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { CoreConfig, ObsidianConfig } from "../config/schema.js";
import * as schema from "../db/schema.js";

/**
 * Initialize all syncers and register with sync manager
 */
export function initSyncers(
  db: BunSQLiteDatabase<typeof schema>,
  config: CoreConfig
): SyncManager {
  const manager = new SyncManager(db);

  // Register Obsidian syncer if configured
  const obsidianEntry = config.sources.obsidian;
  if (obsidianEntry?.config && obsidianEntry.enabled !== false && 'vaultPath' in obsidianEntry.config) {
    const obsidianSyncer = new ObsidianSyncer(db, obsidianEntry.config as ObsidianConfig);
    manager.register(obsidianSyncer);
  }

  // Future: Register other syncers here
  // - Farcaster
  // - Teller
  // - Chrome

  return manager;
}

/**
 * Create sync manager with only specific source types
 */
export function createSyncersForSources(
  db: BunSQLiteDatabase<typeof schema>,
  config: CoreConfig,
  sourceTypes: Array<"obsidian">
): SyncManager {
  const manager = new SyncManager(db);

  for (const sourceType of sourceTypes) {
    switch (sourceType) {
      case "obsidian": {
        const obsidianEntry = config.sources.obsidian;
        if (obsidianEntry?.config && 'vaultPath' in obsidianEntry.config) {
          const syncer = new ObsidianSyncer(db, obsidianEntry.config as ObsidianConfig);
          manager.register(syncer);
        }
        break;
      }
    }
  }

  return manager;
}

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
import { FarcasterSyncer } from "./sources/farcaster.js";
import { TellerSyncer } from "./sources/teller.js";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { CoreConfig, ObsidianConfig, FarcasterConfig, TellerConfig } from "../config/schema.js";
import * as schema from "@backpack/db/schema/core";

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

  // Register Farcaster syncer if configured
  const farcasterEntry = config.sources.farcaster;
  if (farcasterEntry?.config && farcasterEntry.enabled !== false && 'fid' in farcasterEntry.config) {
    const farcasterSyncer = new FarcasterSyncer(db, farcasterEntry.config as FarcasterConfig);
    manager.register(farcasterSyncer);
  }

  // Register Teller syncer if configured
  const tellerEntry = config.sources.teller;
  if (tellerEntry?.config && tellerEntry.enabled !== false && 'environment' in tellerEntry.config) {
    const tellerSyncer = new TellerSyncer(db, tellerEntry.config as TellerConfig);
    manager.register(tellerSyncer);
  }

  // Future: Register other syncers here
  // - Chrome

  return manager;
}

/**
 * Create sync manager with only specific source types
 */
export function createSyncersForSources(
  db: BunSQLiteDatabase<typeof schema>,
  config: CoreConfig,
  sourceTypes: Array<"obsidian" | "teller">
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
      case "teller": {
        const tellerEntry = config.sources.teller;
        if (tellerEntry?.config && 'environment' in tellerEntry.config) {
          const syncer = new TellerSyncer(db, tellerEntry.config as TellerConfig);
          manager.register(syncer);
        }
        break;
      }
    }
  }

  return manager;
}

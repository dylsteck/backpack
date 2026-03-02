/**
 * Sync Manager - orchestrates multiple source syncers
 */

import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { SourceType } from "../config/schema.js";
import { BaseSyncer } from "./base.js";
import type {
  SyncProgress,
  SyncOptions,
  SyncResult,
  SyncStatus,
  SyncManagerOptions,
} from "./types.js";
import * as schema from "@backpack/db/schema/core";

/**
 * Sync Manager class
 */
export class SyncManager {
  private syncers: Map<SourceType, BaseSyncer> = new Map();
  /** Database instance - used for auto-embed trigger */
  private _db: BunSQLiteDatabase<typeof schema>;
  private isRunning: boolean = false;
  private options: Required<SyncManagerOptions>;

  constructor(
    db: BunSQLiteDatabase<typeof schema>,
    options: SyncManagerOptions = {}
  ) {
    this._db = db;
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 3,
      autoEmbed: options.autoEmbed ?? true,
    };
  }

  /**
   * Register a syncer with the manager
   */
  register(syncer: BaseSyncer): void {
    this.syncers.set(syncer.name, syncer);
  }

  /**
   * Unregister a syncer
   */
  unregister(source: SourceType): void {
    this.syncers.delete(source);
  }

  /**
   * Get all registered sources
   */
  getRegisteredSources(): SourceType[] {
    return Array.from(this.syncers.keys());
  }

  /**
   * Check if a source is registered
   */
  isRegistered(source: SourceType): boolean {
    return this.syncers.has(source);
  }

  /**
   * Check if a source is configured
   */
  async isSourceConfigured(source: SourceType): Promise<boolean> {
    const syncer = this.syncers.get(source);
    if (!syncer) {
      return false;
    }
    return await syncer.isConfigured();
  }

  /**
   * Sync all registered and configured sources
   */
  async syncAll(options?: SyncOptions): Promise<SyncResult> {
    if (this.isRunning) {
      throw new Error("Sync is already running");
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      // Determine which sources to sync
      const sourcesToSync = options?.sources
        ? options.sources.filter((s) => this.syncers.has(s))
        : Array.from(this.syncers.keys());

      // Filter to only configured sources
      const configuredSources: SourceType[] = [];
      for (const source of sourcesToSync) {
        const isConfigured = await this.isSourceConfigured(source);
        if (isConfigured) {
          configuredSources.push(source);
        }
      }

      if (configuredSources.length === 0) {
        const duration = Date.now() - startTime;
        return {
          overall: "completed",
          sourceResults: {},
          totalDurationMs: duration,
        };
      }

      // Run syncs with concurrency limit
      const results: Partial<Record<SourceType, SyncProgress>> = {};
      const concurrencyLimit = this.options.maxConcurrent;

      // Process in batches to limit concurrency
      for (let i = 0; i < configuredSources.length; i += concurrencyLimit) {
        const batch = configuredSources.slice(i, i + concurrencyLimit);
        const batchPromises = batch.map(async (source) => {
          const syncer = this.syncers.get(source)!;
          try {
            const result = await syncer.sync(options);
            results[source] = result;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            results[source] = {
              source,
              status: "failed",
              itemsFound: 0,
              itemsAdded: 0,
              itemsUpdated: 0,
              errors: [errorMessage],
              startedAt: new Date(),
              completedAt: new Date(),
            };
          }
        });

        await Promise.all(batchPromises);
      }

      // Calculate overall status
      const overall = this.calculateOverallStatus(results);

      const duration = Date.now() - startTime;

      // Trigger auto-embed if enabled
      if (this.options.autoEmbed && (overall === "completed" || overall === "partial")) {
        try {
          const { generateForNewItems } = await import("../embeddings/index.js");
          await generateForNewItems(this._db);
        } catch (error) {
          console.warn("Failed to generate embeddings:", error);
        }
      }

      return {
        overall,
        sourceResults: results,
        totalDurationMs: duration,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync a single source
   */
  async syncSource(
    source: SourceType,
    options?: SyncOptions
  ): Promise<SyncProgress> {
    const syncer = this.syncers.get(source);
    if (!syncer) {
      return {
        source,
        status: "failed",
        itemsFound: 0,
        itemsAdded: 0,
        itemsUpdated: 0,
        errors: [`Source "${source}" is not registered`],
        startedAt: new Date(),
        completedAt: new Date(),
      };
    }

    return await syncer.sync(options);
  }

  /**
   * Check if a sync is currently running
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Calculate overall status from individual source results
   */
  private calculateOverallStatus(
    results: Partial<Record<SourceType, SyncProgress>>
  ): SyncStatus {
    const statuses = Object.values(results).map((r) => r?.status).filter((s): s is SyncStatus => s !== undefined);

    if (statuses.every((s) => s === "completed")) {
      return "completed";
    }

    if (statuses.every((s) => s === "failed")) {
      return "failed";
    }

    if (statuses.some((s) => s === "running")) {
      return "running";
    }

    // Mix of completed and failed
    return "partial";
  }
}

/**
 * Create a sync manager instance
 */
export function createSyncManager(
  db: BunSQLiteDatabase<typeof schema>,
  options?: SyncManagerOptions
): SyncManager {
  return new SyncManager(db, options);
}

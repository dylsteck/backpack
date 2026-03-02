/**
 * Base syncer class - provides common functionality for all source syncers
 */

import { eq, and } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { SourceType, SourceConfig } from "../config/schema.js";
import type { TimelineItem } from "../types/index.js";
import type { SyncProgress, SyncOptions } from "./types.js";
import { timelineItems, sources } from "@backpack/db/schema/core";
import * as schema from "@backpack/db/schema/core";

/**
 * Abstract base class for all source syncers
 */
export abstract class BaseSyncer {
  /** Source type identifier */
  abstract readonly name: SourceType;

  /** Database connection */
  protected db: BunSQLiteDatabase<typeof schema>;

  /** Source configuration */
  protected config?: SourceConfig;

  /** Current progress for this sync operation */
  protected currentProgress?: SyncProgress;

  /** Progress callback */
  protected onProgress?: (progress: SyncProgress) => void;

  constructor(db: BunSQLiteDatabase<typeof schema>, config?: SourceConfig) {
    this.db = db;
    this.config = config;
  }

  /**
   * Check if this source is configured and ready to sync
   */
  abstract isConfigured(): Promise<boolean>;

  /**
   * Main sync implementation - to be overridden by subclasses
   * @param progress - Progress object to update
   * @returns Updated progress
   */
  protected abstract doSync(progress: SyncProgress): Promise<SyncProgress>;

  /**
   * Validate configuration without syncing
   */
  abstract validateConfig(): Promise<boolean>;

  /**
   * Execute sync with progress tracking and error handling
   */
  async sync(options?: SyncOptions): Promise<SyncProgress> {
    // Check if configured
    const configured = await this.isConfigured();
    if (!configured) {
      const error: SyncProgress = {
        source: this.name,
        status: "failed",
        itemsFound: 0,
        itemsAdded: 0,
        itemsUpdated: 0,
        errors: ["Source not configured"],
        startedAt: new Date(),
        completedAt: new Date(),
      };
      return error;
    }

    // Create initial progress
    const progress: SyncProgress = {
      source: this.name,
      status: "running",
      itemsFound: 0,
      itemsAdded: 0,
      itemsUpdated: 0,
      errors: [],
      startedAt: new Date(),
    };

    this.currentProgress = progress;
    this.onProgress = options?.onProgress;

    try {
      // Execute sync
      const result = await this.doSync(progress);

      // Update status based on errors
      if (result.errors.length > 0) {
        result.status = result.itemsAdded > 0 || result.itemsUpdated > 0 ? "partial" : "failed";
      } else {
        result.status = "completed";
      }

      result.completedAt = new Date();

      // Update last sync time in database
      await this.updateLastSyncTime();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.errors.push(errorMessage);
      progress.status = "failed";
      progress.completedAt = new Date();
      return progress;
    }
  }

  /**
   * Save or update a timeline item
   * Handles conflict resolution by external_id
   */
  protected async saveItem(item: TimelineItem): Promise<void> {
    try {
      // Check if item already exists
      const existing = await this.db.query.timelineItems.findFirst({
        where: and(
          eq(timelineItems.source, item.source),
          eq(timelineItems.externalId, item.externalId || "")
        ),
      });

      if (existing) {
        // Update existing item
        await this.db.update(timelineItems).set({
          title: item.title,
          content: item.content,
          rawData: item.rawData ? JSON.stringify(item.rawData) : null,
          url: item.url,
          timestamp: item.timestamp,
          updatedAt: new Date(),
          syncStatus: "synced",
        }).where(eq(timelineItems.id, existing.id));

        if (this.currentProgress) {
          this.currentProgress.itemsUpdated++;
        }
      } else {
        // Insert new item
        await this.db.insert(timelineItems).values({
          id: item.id,
          source: item.source,
          type: item.type,
          externalId: item.externalId,
          title: item.title,
          content: item.content,
          rawData: item.rawData ? JSON.stringify(item.rawData) : null,
          url: item.url,
          timestamp: item.timestamp,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          syncStatus: item.syncStatus,
          errorMessage: item.errorMessage,
        });

        if (this.currentProgress) {
          this.currentProgress.itemsAdded++;
        }
      }

      // Report progress
      if (this.onProgress && this.currentProgress) {
        this.onProgress(this.currentProgress);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.currentProgress) {
        this.currentProgress.errors.push(errorMessage);
      }
      throw error;
    }
  }

  /**
   * Get the last sync time for this source
   */
  protected async getLastSyncTime(): Promise<Date | null> {
    try {
      const source = await this.db.query.sources.findFirst({
        where: eq(sources.type, this.name),
      });

      return source?.lastSyncAt || null;
    } catch {
      return null;
    }
  }

  /**
   * Update progress and call callback
   */
  protected updateProgress(progress: SyncProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  /**
   * Update the last sync time for this source in the database
   */
  private async updateLastSyncTime(): Promise<void> {
    try {
      const now = new Date();
      const existingSource = await this.db.query.sources.findFirst({
        where: eq(sources.type, this.name),
      });

      if (existingSource) {
        await this.db.update(sources).set({
          lastSyncAt: now,
          updatedAt: now,
        }).where(eq(sources.id, existingSource.id));
      } else {
        // Create source entry if it doesn't exist
        await this.db.insert(sources).values({
          id: crypto.randomUUID(),
          name: this.name,
          type: this.name,
          lastSyncAt: now,
          isEnabled: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      // Log but don't fail sync due to timestamp update
      console.error(`Failed to update last sync time for ${this.name}:`, error);
    }
  }
}

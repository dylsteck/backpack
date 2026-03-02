/**
 * Chrome/Brave browser history syncer
 * 
 * Reads browser history from Chrome's SQLite database and syncs to timeline.
 * Handles locked database by copying to temp location first.
 */

import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { Database } from "bun:sqlite";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { ChromeConfig, HistoryItem, BrowserType } from "../../types/chrome.js";
import type { SourceType } from "../../config/schema.js";
import { BaseSyncer } from "../base.js";
import type { SyncProgress } from "../types.js";
import type { TimelineItem } from "../../types/index.js";
import * as schema from "@backpack/db/schema/core";
import {
  chromeTimestampToUnix,
  getCutoffTimestamp,
  shouldExcludeUrl,
  DEFAULT_BROWSER_PATHS,
} from "../../types/chrome.js";

/**
 * Raw data stored in timeline item for Chrome history
 */
interface ChromeRawData {
  urlId: number;
  visitCount: number;
  typedCount: number;
  chromeTimestamp: number;
}

/**
 * Chrome/Brave browser history syncer
 */
export class ChromeSyncer extends BaseSyncer {
  readonly name: SourceType;
  protected declare config?: ChromeConfig;
  private tempDbPath: string | null = null;

  constructor(
    db: BunSQLiteDatabase<typeof schema>,
    config?: ChromeConfig
  ) {
    super(db, config);
    this.config = config;
    // Determine source type based on browser
    this.name = this.getSourceType();
  }

  /**
   * Get the source type based on configured browser
   */
  private getSourceType(): SourceType {
    const browser = this.config?.browser || "chrome";
    // Map browser to source type
    switch (browser) {
      case "brave":
        return "brave";
      case "chrome":
      case "edge":
      case "arc":
      default:
        return "chrome";
    }
  }

  /**
   * Check if Chrome/Brave history is configured and accessible
   */
  async isConfigured(): Promise<boolean> {
    if (!this.config?.browser) {
      return false;
    }

    try {
      const historyPath = this.getHistoryPath();
      const stats = await fs.promises.stat(historyPath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Validate configuration by testing database read
   */
  async validateConfig(): Promise<boolean> {
    if (!(await this.isConfigured())) {
      return false;
    }

    let tempPath: string | null = null;
    let db: Database | null = null;

    try {
      // Copy to temp and try to open (read-only)
      tempPath = await this.copyHistoryToTemp(this.getHistoryPath());
      db = new Database(tempPath, { readonly: true });

      // Try to query the urls table
      const result = db.query("SELECT COUNT(*) as count FROM urls").get() as { count: number };
      
      // Close before cleanup
      db.close();
      db = null;

      // Cleanup temp file
      if (tempPath) {
        await fs.promises.unlink(tempPath).catch(() => {});
      }

      return result.count > 0;
    } catch (error) {
      // Cleanup on error
      if (db) {
        try { db.close(); } catch {}
      }
      if (tempPath) {
        await fs.promises.unlink(tempPath).catch(() => {});
      }
      return false;
    }
  }

  /**
   * Main sync implementation
   */
  protected async doSync(progress: SyncProgress): Promise<SyncProgress> {
    const historyPath = this.getHistoryPath();
    const daysToSync = this.config?.daysToSync ?? 30;

    // Copy history to temp location (Chrome locks the file while running)
    this.tempDbPath = await this.copyHistoryToTemp(historyPath);

    let db: Database | null = null;

    try {
      // Open temp database read-only
      db = new Database(this.tempDbPath, { readonly: true });

      // Calculate cutoff timestamp
      const cutoffTime = getCutoffTimestamp(daysToSync);

      // Query history items
      const query = `
        SELECT 
          urls.id,
          urls.url,
          urls.title,
          urls.visit_count,
          urls.last_visit_time,
          urls.typed_count
        FROM urls
        WHERE urls.last_visit_time > ?
          AND urls.title IS NOT NULL
          AND urls.title != ''
        ORDER BY urls.last_visit_time DESC
      `;

      const rows = db.query(query).all(cutoffTime) as Array<{
        id: number;
        url: string;
        title: string;
        visit_count: number;
        last_visit_time: number;
        typed_count: number;
      }>;

      progress.itemsFound = rows.length;
      this.updateProgress(progress);

      // Filter and deduplicate URLs
      const seenUrls = new Set<string>();
      const items: HistoryItem[] = [];

      for (const row of rows) {
        // Skip excluded URLs
        if (shouldExcludeUrl(row.url)) {
          continue;
        }

        // Deduplicate - keep first (most recent due to ORDER BY)
        if (seenUrls.has(row.url)) {
          continue;
        }
        seenUrls.add(row.url);

        items.push({
          id: row.id,
          url: row.url,
          title: row.title,
          visit_count: row.visit_count,
          last_visit_time: row.last_visit_time,
          typed_count: row.typed_count,
        });
      }

      // Update progress with filtered count
      progress.itemsFound = items.length;
      this.updateProgress(progress);

      // Save each history item as timeline item
      for (const historyItem of items) {
        try {
          await this.saveHistoryItem(historyItem);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          progress.errors.push(`Failed to save ${historyItem.url}: ${errorMessage}`);
          this.updateProgress(progress);
        }
      }

      return progress;
    } finally {
      // Cleanup
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore close errors
        }
      }
      await this.cleanupTempFile();
    }
  }

  /**
   * Save a history item as timeline item
   */
  private async saveHistoryItem(historyItem: HistoryItem): Promise<void> {
    // Convert Chrome timestamp to Unix timestamp
    const unixTimestamp = chromeTimestampToUnix(historyItem.last_visit_time);
    const timestamp = new Date(unixTimestamp);

    // Create external ID from URL (hashed for consistency)
    const externalId = crypto
      .createHash("sha256")
      .update(historyItem.url)
      .digest("hex")
      .slice(0, 32);

    const rawData: ChromeRawData = {
      urlId: historyItem.id,
      visitCount: historyItem.visit_count,
      typedCount: historyItem.typed_count,
      chromeTimestamp: historyItem.last_visit_time,
    };

    const item: TimelineItem = {
      id: crypto.randomUUID(),
      source: this.name,
      type: "visit",
      externalId,
      title: historyItem.title,
      content: `Visited: ${historyItem.url}`,
      rawData: rawData as unknown as Record<string, unknown>,
      url: historyItem.url,
      timestamp,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: "synced",
    };

    await this.saveItem(item);
  }

  /**
   * Get the full path to the Chrome/Brave History file
   */
  private getHistoryPath(): string {
    // Use explicit history path if provided
    if (this.config?.historyPath) {
      return this.config.historyPath;
    }

    const browser = this.config?.browser || "chrome";
    const profile = this.config?.profilePath || "Default";
    const platform = os.platform();

    // Get base path for browser and platform
    const basePath = this.getBasePath(browser, platform);
    
    // Expand home directory if needed
    const expandedPath = basePath.startsWith("~")
      ? path.join(os.homedir(), basePath.slice(1))
      : basePath;

    return path.join(expandedPath, profile, "History");
  }

  /**
   * Get base path for browser on current platform
   */
  private getBasePath(browser: BrowserType, platform: string): string {
    const paths = DEFAULT_BROWSER_PATHS[browser];
    
    if (!paths) {
      throw new Error(`Unknown browser: ${browser}`);
    }

    // Map platform to path key
    let platformKey: string;
    switch (platform) {
      case "darwin":
        platformKey = "darwin";
        break;
      case "linux":
        platformKey = "linux";
        break;
      case "win32":
        platformKey = "win32";
        break;
      default:
        platformKey = "linux"; // Fallback
    }

    const basePath = paths[platformKey];
    if (!basePath) {
      throw new Error(`Unsupported platform ${platform} for browser ${browser}`);
    }

    return basePath;
  }

  /**
   * Copy History file to temp location
   * Chrome locks the database while running, so we need to copy it
   */
  private async copyHistoryToTemp(sourcePath: string): Promise<string> {
    const tempDir = os.tmpdir();
    const tempFileName = `backpack-chrome-history-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempPath = path.join(tempDir, tempFileName);

    try {
      // Copy the file (not rename, since Chrome has it locked)
      await fs.promises.copyFile(sourcePath, tempPath);
      this.tempDbPath = tempPath;
      return tempPath;
    } catch (error) {
      throw new Error(
        `Failed to copy History file from ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Clean up temporary database file
   */
  private async cleanupTempFile(): Promise<void> {
    if (this.tempDbPath) {
      try {
        await fs.promises.unlink(this.tempDbPath);
      } catch {
        // Ignore cleanup errors
      }
      this.tempDbPath = null;
    }
  }
}

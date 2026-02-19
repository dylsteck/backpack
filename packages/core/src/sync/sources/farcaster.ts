/**
 * Farcaster syncer - fetches user's casts from Farcaster network
 * 
 * Uses Neynar API for accessing Farcaster data with proper
 * authentication, pagination, and rate limiting.
 */

import crypto from "crypto";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { FarcasterConfig } from "../../config/schema.js";
import type { SourceType } from "../../types/index.js";
import { BaseSyncer } from "../base.js";
import type { SyncProgress } from "../types.js";
import type { TimelineItem } from "../../types/index.js";
import * as schema from "../../db/schema.js";
import { getSecret, SECRET_KEYS } from "../../auth/keychain.js";
import type { Cast, NeynarFeedResponse } from "../../types/farcaster.js";

/**
 * Farcaster hub syncer
 * Fetches casts via Neynar API
 */
export class FarcasterSyncer extends BaseSyncer {
  readonly name: SourceType = "farcaster";
  protected declare config?: FarcasterConfig;

  /** Neynar API key from config or environment */
  private neynarApiKey?: string;

  /** Base URL for Neynar API */
  private readonly neynarBaseUrl = "https://api.neynar.com/v2";

  /** Rate limit: 10 requests per second (100ms between requests) */
  private readonly requestDelayMs = 100;

  constructor(
    db: BunSQLiteDatabase<typeof schema>,
    config?: FarcasterConfig
  ) {
    super(db, config);
    this.config = config;
    // Try to get API key from environment
    this.neynarApiKey = process.env.NEYNAR_API_KEY;
  }

  /**
   * Check if Farcaster is configured
   * Requires FID and signer in keychain
   */
  async isConfigured(): Promise<boolean> {
    // Check if FID is set
    if (!this.config?.fid) {
      return false;
    }

    // Check if signer is in keychain
    try {
      const signer = await getSecret(SECRET_KEYS.FARCASTER_SIGNER);
      if (!signer) {
        return false;
      }

      // Also check FID in keychain as backup
      const fidFromKeychain = await getSecret(SECRET_KEYS.FARCASTER_FID);
      if (!fidFromKeychain && !this.config.fid) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate configuration by making a test API call
   */
  async validateConfig(): Promise<boolean> {
    if (!await this.isConfigured()) {
      return false;
    }

    try {
      // Try to fetch a single cast to validate API access
      const fid = this.config!.fid!;
      const casts = await this.fetchNeynarCasts(fid, undefined, 1);
      return true;
    } catch (error) {
      console.error("Farcaster config validation failed:", error);
      return false;
    }
  }

  /**
   * Main sync implementation
   * Fetches all casts and stores them as timeline items
   */
  protected async doSync(progress: SyncProgress): Promise<SyncProgress> {
    const fid = this.config!.fid!;
    
    // Get last cursor for incremental sync
    const lastCursor = await this.getLastCursor();
    let cursor: string | undefined = lastCursor || undefined;
    let hasMore = true;
    let totalFetched = 0;
    let batchCount = 0;

    // Fetch casts in batches
    while (hasMore) {
      batchCount++;
      
      try {
        // Fetch batch of casts
        const response = await this.fetchNeynarCasts(fid, cursor, 100);
        const casts = response.casts;
        
        progress.itemsFound += casts.length;
        totalFetched += casts.length;
        this.updateProgress(progress);

        // Process each cast
        for (const cast of casts) {
          try {
            const item = this.castToTimelineItem(cast);
            await this.saveItem(item);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            progress.errors.push(`Failed to process cast ${cast.hash}: ${errorMessage}`);
            this.updateProgress(progress);
          }
        }

        // Check for more pages
        if (response.next?.cursor && casts.length > 0) {
          cursor = response.next.cursor;
          
          // Store cursor for resumable sync
          await this.storeCursor(cursor);
          
          // Rate limiting delay
          if (hasMore) {
            await this.delay(this.requestDelayMs);
          }
        } else {
          hasMore = false;
        }

        // Safety limit - stop after 100 batches to avoid infinite loops
        if (batchCount >= 100) {
          console.warn("Farcaster sync: Reached batch limit (100), stopping");
          break;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.errors.push(`Failed to fetch casts: ${errorMessage}`);
        this.updateProgress(progress);
        
        // If we have rate limit error, wait longer and retry
        if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
          console.log("Rate limited, waiting 5 seconds...");
          await this.delay(5000);
          continue;
        }
        
        // For other errors, stop syncing
        break;
      }
    }

    // Clear cursor on successful completion
    if (progress.errors.length === 0) {
      await this.clearCursor();
    }

    return progress;
  }

  /**
   * Fetch casts from Neynar API
   */
  private async fetchNeynarCasts(
    fid: number,
    cursor?: string,
    limit: number = 100
  ): Promise<NeynarFeedResponse> {
    const apiKey = this.getNeynarApiKey();
    if (!apiKey) {
      throw new Error("Neynar API key not configured");
    }

    // Build URL with query params
    const params = new URLSearchParams({
      fid: fid.toString(),
      limit: limit.toString(),
      feed_type: "filter",
      filter_type: "fids",
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    const url = `${this.neynarBaseUrl}/farcaster/feed/user/${fid}?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Api-Key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      
      if (response.status === 429) {
        throw new Error(`Rate limited (429): ${errorText}`);
      } else if (response.status === 401 || response.status === 403) {
        throw new Error(`Authentication failed (${response.status}): ${errorText}`);
      } else if (response.status === 404) {
        throw new Error(`FID not found (404): ${errorText}`);
      }
      
      throw new Error(`Neynar API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as NeynarFeedResponse;
    return data;
  }

  /**
   * Convert a Cast to TimelineItem format
   */
  private castToTimelineItem(cast: Cast): TimelineItem {
    const timestamp = new Date(cast.timestamp);
    const username = cast.author.username;
    const shortHash = cast.hash.slice(0, 10);
    
    // Build Warpcast URL
    const warpcastUrl = `https://warpcast.com/${username}/${shortHash}`;

    return {
      id: crypto.randomUUID(),
      source: "farcaster",
      type: "post",
      externalId: cast.hash,
      title: undefined, // Casts don't have titles
      content: cast.text,
      rawData: cast as unknown as Record<string, unknown>,
      url: warpcastUrl,
      timestamp: timestamp,
      createdAt: timestamp,
      updatedAt: new Date(),
      syncStatus: "synced",
    };
  }

  /**
   * Get the last cursor from database
   */
  private async getLastCursor(): Promise<string | null> {
    try {
      const { sources } = await import("../../db/schema.js");
      const { eq } = await import("drizzle-orm");

      const source = await this.db.query.sources.findFirst({
        where: eq(sources.type, this.name),
      });

      if (source?.config && typeof source.config === "object") {
        const config = source.config as Record<string, unknown>;
        const syncState = config.syncState as Record<string, unknown> | undefined;
        if (syncState?.lastCursor) {
          return String(syncState.lastCursor);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Store cursor for resumable sync
   */
  private async storeCursor(cursor: string): Promise<void> {
    try {
      const { sources } = await import("../../db/schema.js");
      const { eq } = await import("drizzle-orm");

      const existingSource = await this.db.query.sources.findFirst({
        where: eq(sources.type, this.name),
      });

      const now = new Date();
      
      if (existingSource) {
        // Merge with existing config
        const existingConfig = (existingSource.config as Record<string, unknown>) || {};
        const existingSyncState = (existingConfig.syncState as Record<string, unknown>) || {};
        
        await this.db.update(sources).set({
          config: {
            ...existingConfig,
            syncState: {
              ...existingSyncState,
              lastCursor: cursor,
              lastSyncTimestamp: Date.now(),
            },
          },
          updatedAt: now,
        }).where(eq(sources.id, existingSource.id));
      }
      // If source doesn't exist, cursor will be stored on next successful sync completion
    } catch (error) {
      console.error("Failed to store cursor:", error);
    }
  }

  /**
   * Clear cursor after successful sync
   */
  private async clearCursor(): Promise<void> {
    try {
      const { sources } = await import("../../db/schema.js");
      const { eq } = await import("drizzle-orm");

      const existingSource = await this.db.query.sources.findFirst({
        where: eq(sources.type, this.name),
      });

      if (existingSource) {
        const existingConfig = (existingSource.config as Record<string, unknown>) || {};
        const existingSyncState = (existingConfig.syncState as Record<string, unknown>) || {};
        
        await this.db.update(sources).set({
          config: {
            ...existingConfig,
            syncState: {
              ...existingSyncState,
              lastCursor: undefined,
              lastSyncTimestamp: Date.now(),
            },
          },
          updatedAt: new Date(),
        }).where(eq(sources.id, existingSource.id));
      }
    } catch (error) {
      console.error("Failed to clear cursor:", error);
    }
  }

  /**
   * Get Neynar API key from various sources
   */
  private getNeynarApiKey(): string | undefined {
    // Priority: environment variable > config > undefined
    return process.env.NEYNAR_API_KEY || this.neynarApiKey;
  }

  /**
   * Delay helper for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

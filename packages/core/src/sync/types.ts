/**
 * Sync-related types and interfaces
 */

import type { SourceType } from "../config/schema.js";

/**
 * Sync status enum
 */
export type SyncStatus = "idle" | "running" | "completed" | "failed" | "partial";

/**
 * Progress tracking for a single sync operation
 */
export interface SyncProgress {
  source: SourceType;
  status: SyncStatus;
  itemsFound: number;
  itemsAdded: number;
  itemsUpdated: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Options for sync operations
 */
export interface SyncOptions {
  /** Force full sync (skip incremental check) */
  forceFull?: boolean;
  /** Sync specific sources only */
  sources?: SourceType[];
  /** Progress callback */
  onProgress?: (progress: SyncProgress) => void;
}

/**
 * Result of a complete sync operation (all sources)
 */
export interface SyncResult {
  overall: SyncStatus;
  sourceResults: Partial<Record<SourceType, SyncProgress>>;
  totalDurationMs: number;
}

/**
 * Interface that all syncers must implement
 */
export interface SyncerInterface {
  /** Unique source name */
  readonly name: SourceType;

  /** Check if source is configured */
  isConfigured(): Promise<boolean>;

  /** Perform sync operation */
  sync(options?: SyncOptions): Promise<SyncProgress>;

  /** Validate configuration */
  validateConfig(): Promise<boolean>;
}

/**
 * Options for the sync manager
 */
export interface SyncManagerOptions {
  /** Maximum concurrent syncs (default: 3) */
  maxConcurrent?: number;
  /** Enable auto-embed after sync (default: true) */
  autoEmbed?: boolean;
}

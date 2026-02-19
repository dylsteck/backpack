/**
 * Core types for Cortex
 */

// Source types
export const SOURCE_TYPES = [
  "farcaster",
  "obsidian", 
  "teller",
  "chrome",
  "brave",
  "safari",
  "manual",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

// Item types
export const ITEM_TYPES = [
  "post",
  "note",
  "transaction",
  "visit",
  "bookmark",
  "document",
] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

// Item sync statuses (for timeline_items.sync_status)
export const ITEM_SYNC_STATUSES = [
  "pending",
  "syncing",
  "synced",
  "error",
  "skipped",
] as const;

export type ItemSyncStatus = (typeof ITEM_SYNC_STATUSES)[number];

/**
 * Timeline item interface
 */
export interface TimelineItem {
  id: string;
  source: SourceType;
  type: ItemType;
  externalId?: string;
  title?: string;
  content?: string;
  rawData?: Record<string, unknown>;
  url?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
  syncStatus: ItemSyncStatus;
  errorMessage?: string;
}

/**
 * Source configuration interface
 */
export interface Source {
  id: string;
  name: string;
  type: SourceType;
  config?: SourceConfig;
  lastSyncAt?: Date;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Source-specific configurations
 */
export interface ObsidianConfig {
  vaultPath: string;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface FarcasterConfig {
  fid?: number;
  signerUuid?: string;
  username?: string;
}

export interface TellerConfig {
  environment: "sandbox" | "production";
  accountIds?: string[];
}

export interface ChromeConfig {
  profilePath?: string;
}

export type SourceConfig = 
  | ObsidianConfig 
  | FarcasterConfig 
  | TellerConfig 
  | ChromeConfig
  | Record<string, unknown>;

/**
 * Embedding interface
 */
export interface Embedding {
  id: string;
  itemId: string;
  vector?: Uint8Array;
  model: string;
  createdAt: Date;
}

/**
 * Timeline query filters
 */
export interface TimelineFilters {
  sources?: SourceType[];
  types?: ItemType[];
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

/**
 * Timeline query result
 */
export interface TimelineResult {
  items: TimelineItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Legacy sync operation result (per-source)
 * @deprecated Use sync/SyncProgress instead
 */
export interface LegacySyncResult {
  source: SourceType;
  added: number;
  updated: number;
  failed: number;
  errors: string[];
  startedAt: Date;
  completedAt: Date;
}

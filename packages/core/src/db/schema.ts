import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * Source types for timeline items
 */
export const SOURCE_TYPES = [
  "farcaster",
  "obsidian",
  "teller",
  "chrome",
  "brave",
  "safari",
  "manual",
] as const;

/**
 * Timeline item types
 */
export const ITEM_TYPES = [
  "post",        // Farcaster cast
  "note",        // Obsidian note
  "transaction", // Teller transaction
  "visit",       // Browser history
  "bookmark",    // Saved item
  "document",    // Generic document
] as const;

/**
 * Sync status values
 */
export const SYNC_STATUSES = [
  "pending",
  "syncing",
  "synced",
  "error",
  "skipped",
] as const;

/**
 * Timeline items table - stores all items from various sources
 */
export const timelineItems = sqliteTable("timeline_items", {
  id: text("id").primaryKey(),
  source: text("source").notNull(), // farcaster, obsidian, teller, chrome, etc.
  type: text("type").notNull(),     // post, note, transaction, visit, etc.
  externalId: text("external_id"),  // ID from source system
  title: text("title"),
  content: text("content"),         // Main content/text
  rawData: text("raw_data"),        // JSON string of full source data
  url: text("url"),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  syncStatus: text("sync_status").notNull().default("pending"),
  errorMessage: text("error_message"),
});

/**
 * Sources table - stores source configurations and metadata
 */
export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),     // Display name
  type: text("type").notNull(),     // farcaster, obsidian, teller, chrome, etc.
  config: text("config"),           // JSON config
  lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Embeddings table - stores vector embeddings for search (QMD)
 */
export const embeddings = sqliteTable("embeddings", {
  id: text("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => timelineItems.id, { onDelete: "cascade" }),
  vector: blob("vector"),           // Binary embedding data
  model: text("model").notNull(),   // Embedding model used
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Relations
 */
export const timelineItemsRelations = relations(timelineItems, ({ one, many }) => ({
  embeddings: many(embeddings),
}));

export const sourcesRelations = relations(sources, () => ({}));

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  item: one(timelineItems, {
    fields: [embeddings.itemId],
    references: [timelineItems.id],
  }),
}));

/**
 * Indexes for common queries
 */
export const indexes = {
  // Timeline items indexes
  timelineItemsSourceIdx: "CREATE INDEX IF NOT EXISTS timeline_items_source_idx ON timeline_items(source)",
  timelineItemsTypeIdx: "CREATE INDEX IF NOT EXISTS timeline_items_type_idx ON timeline_items(type)",
  timelineItemsTimestampIdx: "CREATE INDEX IF NOT EXISTS timeline_items_timestamp_idx ON timeline_items(timestamp)",
  timelineItemsExternalIdIdx: "CREATE INDEX IF NOT EXISTS timeline_items_external_id_idx ON timeline_items(external_id)",
  timelineItemsSyncStatusIdx: "CREATE INDEX IF NOT EXISTS timeline_items_sync_status_idx ON timeline_items(sync_status)",
  
  // Sources indexes
  sourcesTypeIdx: "CREATE INDEX IF NOT EXISTS sources_type_idx ON sources(type)",
  sourcesEnabledIdx: "CREATE INDEX IF NOT EXISTS sources_enabled_idx ON sources(is_enabled)",
  
  // Embeddings indexes
  embeddingsItemIdIdx: "CREATE INDEX IF NOT EXISTS embeddings_item_id_idx ON embeddings(item_id)",
  embeddingsModelIdx: "CREATE INDEX IF NOT EXISTS embeddings_model_idx ON embeddings(model)",
};

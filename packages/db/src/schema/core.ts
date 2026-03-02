import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const SOURCE_TYPES = [
	"farcaster",
	"obsidian",
	"teller",
	"chrome",
	"brave",
	"safari",
	"manual",
] as const;

export const ITEM_TYPES = [
	"post",
	"note",
	"transaction",
	"visit",
	"bookmark",
	"document",
] as const;

export const SYNC_STATUSES = [
	"pending",
	"syncing",
	"synced",
	"error",
	"skipped",
] as const;

export const timelineItems = sqliteTable("timeline_items", {
	id: text("id").primaryKey(),
	source: text("source").notNull(),
	type: text("type").notNull(),
	externalId: text("external_id"),
	title: text("title"),
	content: text("content"),
	rawData: text("raw_data"),
	url: text("url"),
	timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	syncStatus: text("sync_status").notNull().default("pending"),
	errorMessage: text("error_message"),
});

export const sources = sqliteTable("sources", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	type: text("type").notNull(),
	config: text("config"),
	lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
	isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const embeddings = sqliteTable("embeddings", {
	id: text("id").primaryKey(),
	itemId: text("item_id")
		.notNull()
		.references(() => timelineItems.id, { onDelete: "cascade" }),
	vector: blob("vector"),
	model: text("model").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const timelineItemsRelations = relations(timelineItems, ({ many }) => ({
	embeddings: many(embeddings),
}));

export const sourcesRelations = relations(sources, () => ({}));

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
	item: one(timelineItems, {
		fields: [embeddings.itemId],
		references: [timelineItems.id],
	}),
}));

export const coreIndexes = {
	timelineItemsSourceIdx: "CREATE INDEX IF NOT EXISTS timeline_items_source_idx ON timeline_items(source)",
	timelineItemsTypeIdx: "CREATE INDEX IF NOT EXISTS timeline_items_type_idx ON timeline_items(type)",
	timelineItemsTimestampIdx: "CREATE INDEX IF NOT EXISTS timeline_items_timestamp_idx ON timeline_items(timestamp)",
	timelineItemsExternalIdIdx: "CREATE INDEX IF NOT EXISTS timeline_items_external_id_idx ON timeline_items(external_id)",
	timelineItemsSyncStatusIdx: "CREATE INDEX IF NOT EXISTS timeline_items_sync_status_idx ON timeline_items(sync_status)",
	sourcesTypeIdx: "CREATE INDEX IF NOT EXISTS sources_type_idx ON sources(type)",
	sourcesEnabledIdx: "CREATE INDEX IF NOT EXISTS sources_enabled_idx ON sources(is_enabled)",
	embeddingsItemIdIdx: "CREATE INDEX IF NOT EXISTS embeddings_item_id_idx ON embeddings(item_id)",
	embeddingsModelIdx: "CREATE INDEX IF NOT EXISTS embeddings_model_idx ON embeddings(model)",
};

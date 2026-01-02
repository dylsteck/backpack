import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// SQLite doesn't have native enums, so we define them as type constants
export const TRANSPORT_TYPES = ["stdio", "http", "https", "sse", "streamable-http"] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

export const CONNECTION_STATUSES = ["connected", "disconnected", "error"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/**
 * Comprehensive type for app config field values.
 * Covers all observed patterns:
 * - MCP URL-based: { url: string; headers?: Record<string, string> }
 * - MCP Command-based: { command: string; args: string[]; env?: Record<string, string> }
 * - API: { url: string; oas?: string }
 */
export type AppConfig = {
	url?: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	headers?: Record<string, string>;
	oas?: string;
};

export type TransportConfig = {
	command?: string;
	args?: string[];
	url?: string;
	headers?: Record<string, string>;
	env?: Record<string, string>;
};

export const apps = sqliteTable("apps", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull(),
	transport: text("transport", { mode: "json" }).$type<string[]>(),
	oauth: integer("oauth", { mode: "boolean" }).notNull().default(false),
	iconUrl: text("icon_url").notNull(),
	config: text("config", { mode: "json" }).notNull().$type<AppConfig>(),
	connectionType: text("connection_type").notNull().default("mcp"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const connections = sqliteTable("connections", {
	id: text("id").primaryKey(),
	serverId: text("server_id").notNull(),
	serverName: text("server_name").notNull(),
	vendor: text("vendor"),
	transportType: text("transport_type").notNull().$type<TransportType>(),
	transportConfig: text("transport_config", { mode: "json" }).notNull().$type<TransportConfig>(),
	status: text("status").notNull().default("disconnected").$type<ConnectionStatus>(),
	secretUri: text("secret_uri"),
	credentialStorage: text("credential_storage").notNull().default("onepassword"),
	encryptedCredentials: text("encrypted_credentials"), // Base64 encoded credentials for database storage
	connectionMetadata: text("connection_metadata", { mode: "json" }).$type<Record<string, any>>(),
	lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }), // Timestamp of last successful sync
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const items = sqliteTable("items", {
	id: text("id").primaryKey(),
	source: text("source").notNull().references(() => apps.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
	data: text("data", { mode: "json" }).notNull().$type<Record<string, any>>(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const appsRelations = relations(apps, ({ many }) => ({
	items: many(items),
}));

export const itemsRelations = relations(items, ({ one }) => ({
	app: one(apps, {
		fields: [items.source],
		references: [apps.id],
	}),
}));

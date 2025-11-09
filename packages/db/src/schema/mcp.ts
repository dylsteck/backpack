import { pgTable, text, timestamp, json, pgEnum, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const transportTypeEnum = pgEnum("transport_type", ["stdio", "http", "https", "sse", "streamable-http"]);
export const connectionStatusEnum = pgEnum("connection_status", ["connected", "disconnected", "error"]);

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

export const apps = pgTable("apps", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull(),
	transport: json("transport").$type<string[]>(),
	oauth: boolean("oauth").notNull().default(false),
	iconUrl: text("icon_url").notNull(),
	config: json("config").notNull().$type<AppConfig>(),
	connectionType: text("connection_type").notNull().default("mcp"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export const connections = pgTable("connections", {
	id: text("id").primaryKey(),
	serverId: text("server_id").notNull(),
	serverName: text("server_name").notNull(),
	vendor: text("vendor"),
	transportType: transportTypeEnum("transport_type").notNull(),
	transportConfig: json("transport_config").notNull().$type<{
		command?: string;
		args?: string[];
		url?: string;
		headers?: Record<string, string>;
		env?: Record<string, string>;
	}>(),
	status: connectionStatusEnum("status").notNull().default("disconnected"),
	secretUri: text("secret_uri"),
	credentialStorage: text("credential_storage").notNull().default("onepassword"),
	encryptedCredentials: text("encrypted_credentials"), // Base64 encoded credentials for database storage
	connectionMetadata: json("connection_metadata").$type<Record<string, any>>(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export const items = pgTable("items", {
	id: text("id").primaryKey(),
	source: text("source").notNull().references(() => apps.id, { onDelete: "cascade" }),
	type: text("type").notNull(),
	timestamp: timestamp("timestamp").notNull(),
	data: jsonb("data").notNull().$type<Record<string, any>>(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
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


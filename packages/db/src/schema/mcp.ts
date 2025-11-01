import { pgTable, text, timestamp, json, pgEnum, boolean } from "drizzle-orm/pg-core";

export const transportTypeEnum = pgEnum("transport_type", ["stdio", "http", "https", "sse", "streamable-http"]);
export const connectionStatusEnum = pgEnum("connection_status", ["connected", "disconnected", "error"]);

export const apps = pgTable("apps", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull(),
	transport: json("transport").notNull().$type<string[]>(),
	oauth: boolean("oauth").notNull().default(false),
	iconUrl: text("icon_url").notNull(),
	config: json("config").notNull().$type<{
		url?: string;
		command?: string;
		args?: string[];
		env?: Record<string, string>;
		headers?: Record<string, string>;
	}>(),
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
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});


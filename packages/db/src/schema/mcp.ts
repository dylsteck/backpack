import { pgTable, text, timestamp, json, pgEnum } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const transportTypeEnum = pgEnum("transport_type", ["stdio", "http", "sse"]);
export const connectionStatusEnum = pgEnum("connection_status", ["connected", "disconnected", "error"]);

export const mcpConnection = pgTable("mcp_connection", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	serverId: text("server_id").notNull(),
	serverName: text("server_name").notNull(),
	vendor: text("vendor"),
	transportType: transportTypeEnum("transport_type").notNull(),
	transportConfig: json("transport_config").notNull().$type<{
		command?: string;
		args?: string[];
		url?: string;
		headers?: Record<string, string>;
	}>(),
	status: connectionStatusEnum("status").notNull().default("disconnected"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});


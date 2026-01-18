import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * Browser history entries - stores visited URLs
 */
export const browserHistory = sqliteTable("browser_history", {
	id: text("id").primaryKey(),
	url: text("url").notNull(),
	title: text("title"),
	favicon: text("favicon"),
	visitedAt: integer("visited_at", { mode: "timestamp" }).notNull(),
	source: text("source").notNull().default("browser"), // For timeline integration
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Browser sessions - stores tab state for restoration
 */
export const browserSessions = sqliteTable("browser_sessions", {
	id: text("id").primaryKey(),
	tabs: text("tabs", { mode: "json" }).$type<Array<{
		id: string;
		url: string;
		title: string;
		favicon?: string;
	}>>(),
	activeTabId: text("active_tab_id"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const browserHistoryRelations = relations(browserHistory, () => ({}));

export const browserSessionsRelations = relations(browserSessions, () => ({}));

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const flyBrowseSessions = sqliteTable("fly_browse_sessions", {
	id: text("id").primaryKey(),
	startedAt: integer("started_at", { mode: "number" }).notNull(),
	endedAt: integer("ended_at", { mode: "number" }),
});

export const flyVisits = sqliteTable(
	"fly_visits",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id").references(() => flyBrowseSessions.id),
		tabId: text("tab_id").notNull(),
		url: text("url").notNull(),
		title: text("title"),
		faviconUrl: text("favicon_url"),
		domain: text("domain").notNull(),
		visitedAt: integer("visited_at", { mode: "number" }).notNull(),
		referrerUrl: text("referrer_url"),
		transition: text("transition").notNull().default("unknown"),
		precedingVisitId: text("preceding_visit_id"),
		durationMs: integer("duration_ms", { mode: "number" }),
	},
	(t) => ({
		visitedAtIdx: index("fly_visits_visited_at_idx").on(t.visitedAt),
		domainIdx: index("fly_visits_domain_idx").on(t.domain),
		tabVisitedIdx: index("fly_visits_tab_id_visited_at_idx").on(t.tabId, t.visitedAt),
		sessionIdx: index("fly_visits_session_id_idx").on(t.sessionId),
	}),
);

export const flySearches = sqliteTable(
	"fly_searches",
	{
		id: text("id").primaryKey(),
		query: text("query").notNull(),
		searchedAt: integer("searched_at", { mode: "number" }).notNull(),
		engine: text("engine"),
		sourceVisitId: text("source_visit_id").references(() => flyVisits.id),
	},
	(t) => ({
		searchedAtIdx: index("fly_searches_searched_at_idx").on(t.searchedAt),
	}),
);

export const flyWindowState = sqliteTable("fly_window_state", {
	id: text("id").primaryKey(),
	tabsJson: text("tabs_json").notNull(),
	updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

-- Add browser_history and browser_sessions tables

CREATE TABLE IF NOT EXISTS "browser_history" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"favicon" text,
	"visited_at" integer NOT NULL,
	"source" text DEFAULT 'browser' NOT NULL,
	"created_at" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "browser_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"tabs" text,
	"active_tab_id" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "browser_history_url_idx" ON "browser_history"("url");
CREATE INDEX IF NOT EXISTS "browser_history_visited_at_idx" ON "browser_history"("visited_at");
CREATE INDEX IF NOT EXISTS "browser_history_source_idx" ON "browser_history"("source");

-- Fly in-app browser history and window persistence (idempotent)

CREATE TABLE IF NOT EXISTS "fly_browse_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"started_at" integer NOT NULL,
	"ended_at" integer
);

CREATE TABLE IF NOT EXISTS "fly_visits" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text REFERENCES "fly_browse_sessions"("id"),
	"tab_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"favicon_url" text,
	"domain" text NOT NULL,
	"visited_at" integer NOT NULL,
	"referrer_url" text,
	"transition" text DEFAULT 'unknown' NOT NULL,
	"preceding_visit_id" text,
	"duration_ms" integer
);

CREATE INDEX IF NOT EXISTS "fly_visits_visited_at_idx" ON "fly_visits" ("visited_at");
CREATE INDEX IF NOT EXISTS "fly_visits_domain_idx" ON "fly_visits" ("domain");
CREATE INDEX IF NOT EXISTS "fly_visits_tab_id_visited_at_idx" ON "fly_visits" ("tab_id", "visited_at");
CREATE INDEX IF NOT EXISTS "fly_visits_session_id_idx" ON "fly_visits" ("session_id");

CREATE TABLE IF NOT EXISTS "fly_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"searched_at" integer NOT NULL,
	"engine" text,
	"source_visit_id" text REFERENCES "fly_visits"("id")
);

CREATE INDEX IF NOT EXISTS "fly_searches_searched_at_idx" ON "fly_searches" ("searched_at");

CREATE TABLE IF NOT EXISTS "fly_window_state" (
	"id" text PRIMARY KEY NOT NULL,
	"tabs_json" text NOT NULL,
	"updated_at" integer NOT NULL
);

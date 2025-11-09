CREATE TABLE IF NOT EXISTS "items" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"type" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "items_source_apps_id_fk" FOREIGN KEY ("source") REFERENCES "apps"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_source_idx" ON "items"("source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_type_idx" ON "items"("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "items_timestamp_idx" ON "items"("timestamp");


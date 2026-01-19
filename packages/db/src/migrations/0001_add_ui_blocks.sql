-- Add UI Blocks table for storing AI-generated json-render UIs

-- UI Blocks table: stores generated UI JSON for persistence
CREATE TABLE IF NOT EXISTS "ui_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"message_id" text,
	"title" text,
	"ui_json" text NOT NULL,
	"data_context" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "ui_blocks_session_id_idx" ON "ui_blocks"("session_id");
CREATE INDEX IF NOT EXISTS "ui_blocks_created_at_idx" ON "ui_blocks"("created_at");

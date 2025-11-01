ALTER TABLE IF EXISTS "apps" ADD COLUMN IF NOT EXISTS "connection_type" text;--> statement-breakpoint
UPDATE "apps" SET "connection_type" = 'mcp' WHERE "connection_type" IS NULL;--> statement-breakpoint
ALTER TABLE IF EXISTS "apps" ALTER COLUMN "connection_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE IF EXISTS "apps" ALTER COLUMN "connection_type" SET DEFAULT 'mcp';--> statement-breakpoint


ALTER TABLE IF EXISTS "apps" ADD COLUMN IF NOT EXISTS "created_at" timestamp;--> statement-breakpoint
ALTER TABLE IF EXISTS "apps" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;--> statement-breakpoint
UPDATE "apps" SET "created_at" = "last_updated", "updated_at" = "last_updated" WHERE "created_at" IS NULL;--> statement-breakpoint
ALTER TABLE IF EXISTS "apps" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE IF EXISTS "apps" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE IF EXISTS "apps" DROP COLUMN IF EXISTS "last_updated";--> statement-breakpoint
ALTER TABLE IF EXISTS "apps" DROP COLUMN IF EXISTS "domains";--> statement-breakpoint


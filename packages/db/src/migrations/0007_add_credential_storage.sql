ALTER TABLE IF EXISTS "connections" ADD COLUMN IF NOT EXISTS "secret_uri" text;--> statement-breakpoint
ALTER TABLE IF EXISTS "connections" ADD COLUMN IF NOT EXISTS "credential_storage" text DEFAULT 'onepassword' NOT NULL;--> statement-breakpoint


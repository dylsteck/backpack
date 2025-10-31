DO $$ 
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'https' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transport_type')) THEN
  ALTER TYPE "public"."transport_type" ADD VALUE 'https' BEFORE 'sse';
 END IF;
END $$;--> statement-breakpoint
DO $$ 
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'streamable-http' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transport_type')) THEN
  ALTER TYPE "public"."transport_type" ADD VALUE 'streamable-http';
 END IF;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_server_registry" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"transport" json NOT NULL,
	"oauth" boolean DEFAULT false NOT NULL,
	"icon_url" text NOT NULL,
	"config" json NOT NULL,
	"domains" json,
	"last_updated" timestamp NOT NULL
);

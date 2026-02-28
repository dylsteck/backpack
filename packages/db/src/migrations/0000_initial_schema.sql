-- Initial SQLite schema for Backpack

-- Apps table: stores available integrations
CREATE TABLE IF NOT EXISTS "apps" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"transport" text,
	"oauth" integer DEFAULT 0 NOT NULL,
	"icon_url" text NOT NULL,
	"config" text NOT NULL,
	"connection_type" text DEFAULT 'mcp' NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);

-- Connections table: stores user's app connections
CREATE TABLE IF NOT EXISTS "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"server_name" text NOT NULL,
	"vendor" text,
	"transport_type" text NOT NULL,
	"transport_config" text NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"secret_uri" text,
	"credential_storage" text DEFAULT 'onepassword' NOT NULL,
	"encrypted_credentials" text,
	"connection_metadata" text,
	"last_synced_at" integer,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);

-- Items table: stores synced data from apps
CREATE TABLE IF NOT EXISTS "items" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL REFERENCES "apps"("id") ON DELETE CASCADE,
	"type" text NOT NULL,
	"timestamp" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS "items_source_idx" ON "items"("source");
CREATE INDEX IF NOT EXISTS "items_timestamp_idx" ON "items"("timestamp");
CREATE INDEX IF NOT EXISTS "items_type_idx" ON "items"("type");
CREATE INDEX IF NOT EXISTS "connections_server_id_idx" ON "connections"("server_id");


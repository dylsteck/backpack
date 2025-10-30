ALTER TYPE "public"."transport_type" ADD VALUE 'https' BEFORE 'sse';--> statement-breakpoint
ALTER TYPE "public"."transport_type" ADD VALUE 'streamable-http';--> statement-breakpoint
CREATE TABLE "mcp_server_registry" (
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

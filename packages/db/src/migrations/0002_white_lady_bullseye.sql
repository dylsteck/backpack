ALTER TABLE IF EXISTS "account" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "session" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "user" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "verification" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "account" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "session" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "user" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "verification" CASCADE;--> statement-breakpoint
DO $$ 
BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'mcp_connection_user_id_user_id_fk' AND table_name = 'mcp_connection') THEN
  ALTER TABLE "mcp_connection" DROP CONSTRAINT "mcp_connection_user_id_user_id_fk";
 END IF;
END $$;
--> statement-breakpoint
DO $$ 
BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mcp_connection' AND column_name = 'user_id') THEN
  ALTER TABLE "mcp_connection" DROP COLUMN "user_id";
 END IF;
END $$;

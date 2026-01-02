import { Database } from "bun:sqlite";
import { drizzle, BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema/mcp";
import path from "path";
import fs from "fs";

// Global database instance
let db: BunSQLiteDatabase<typeof schema> | null = null;
let sqliteDb: Database | null = null;

/**
 * Check if database exists at the given path
 */
export function databaseExists(dbPath: string): boolean {
	return fs.existsSync(dbPath);
}

/**
 * Initialize the database at the given path
 * Creates the directory and database file if they don't exist
 * Returns true if this is a fresh database (needs seeding)
 */
export function initDatabase(dbPath: string): { db: BunSQLiteDatabase<typeof schema>; isNew: boolean } {
	// Ensure directory exists
	const dir = path.dirname(dbPath);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	// Check if database file exists (before we create it)
	const isNew = !fs.existsSync(dbPath);

	// Create SQLite connection using Bun's native SQLite
	sqliteDb = new Database(dbPath, { create: true });
	
	// Use DELETE journal mode for a single file (no -wal/-shm files)
	sqliteDb.exec("PRAGMA journal_mode = DELETE");
	
	// Create drizzle instance with schema
	db = drizzle(sqliteDb, { schema });

	// Run schema creation if new database
	if (isNew) {
		// Create tables manually since we're not using migrations at runtime
		sqliteDb.exec(`
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
			
			CREATE TABLE IF NOT EXISTS "items" (
				"id" text PRIMARY KEY NOT NULL,
				"source" text NOT NULL REFERENCES "apps"("id") ON DELETE CASCADE,
				"type" text NOT NULL,
				"timestamp" integer NOT NULL,
				"data" text NOT NULL,
				"created_at" integer NOT NULL,
				"updated_at" integer NOT NULL
			);
			
			CREATE INDEX IF NOT EXISTS "items_source_idx" ON "items"("source");
			CREATE INDEX IF NOT EXISTS "items_timestamp_idx" ON "items"("timestamp");
			CREATE INDEX IF NOT EXISTS "items_type_idx" ON "items"("type");
			CREATE INDEX IF NOT EXISTS "connections_server_id_idx" ON "connections"("server_id");
		`);
	}

	return { db, isNew };
}

/**
 * Get the current database instance
 * Throws if database hasn't been initialized
 */
export function getDatabase(): BunSQLiteDatabase<typeof schema> {
	if (!db) {
		throw new Error("Database not initialized. Call initDatabase() first.");
	}
	return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
	if (sqliteDb) {
		sqliteDb.close();
		sqliteDb = null;
		db = null;
	}
}

// For backwards compatibility, export db as a getter
// This will throw if accessed before initialization
export { db };

// Export schemas
export * from "./schema/mcp";

// Export seed function
export { seedDatabase, DEFAULT_APPS } from "./seed";

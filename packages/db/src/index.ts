import { Database } from "bun:sqlite";
import { drizzle, BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema/mcp";
import * as coreSchema from "./schema/core";
import path from "path";
import fs from "fs";
import { readFileSync } from "fs";

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

	// Always ensure all tables exist
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
			"source" text NOT NULL,
			"type" text NOT NULL,
			"timestamp" integer NOT NULL,
			"data" text NOT NULL,
			"created_at" integer NOT NULL,
			"updated_at" integer NOT NULL
		);

		CREATE TABLE IF NOT EXISTS "timeline_items" (
			"id" text PRIMARY KEY NOT NULL,
			"source" text NOT NULL,
			"type" text NOT NULL,
			"external_id" text,
			"title" text,
			"content" text,
			"raw_data" text,
			"url" text,
			"timestamp" integer NOT NULL,
			"created_at" integer NOT NULL,
			"updated_at" integer NOT NULL,
			"sync_status" text DEFAULT 'pending' NOT NULL,
			"error_message" text
		);

		CREATE TABLE IF NOT EXISTS "sources" (
			"id" text PRIMARY KEY NOT NULL,
			"name" text NOT NULL,
			"type" text NOT NULL,
			"config" text,
			"last_sync_at" integer,
			"is_enabled" integer DEFAULT 1 NOT NULL,
			"created_at" integer NOT NULL,
			"updated_at" integer NOT NULL
		);

		CREATE TABLE IF NOT EXISTS "embeddings" (
			"id" text PRIMARY KEY NOT NULL,
			"item_id" text NOT NULL REFERENCES "timeline_items"("id") ON DELETE CASCADE,
			"vector" blob,
			"model" text NOT NULL,
			"created_at" integer NOT NULL
		);

		CREATE INDEX IF NOT EXISTS "items_source_idx" ON "items"("source");
		CREATE INDEX IF NOT EXISTS "items_timestamp_idx" ON "items"("timestamp");
		CREATE INDEX IF NOT EXISTS "items_type_idx" ON "items"("type");
		CREATE INDEX IF NOT EXISTS "connections_server_id_idx" ON "connections"("server_id");
		CREATE INDEX IF NOT EXISTS "timeline_items_source_idx" ON "timeline_items"("source");
		CREATE INDEX IF NOT EXISTS "timeline_items_type_idx" ON "timeline_items"("type");
		CREATE INDEX IF NOT EXISTS "timeline_items_timestamp_idx" ON "timeline_items"("timestamp");
		CREATE INDEX IF NOT EXISTS "timeline_items_external_id_idx" ON "timeline_items"("external_id");
		CREATE INDEX IF NOT EXISTS "timeline_items_sync_status_idx" ON "timeline_items"("sync_status");
		CREATE INDEX IF NOT EXISTS "sources_type_idx" ON "sources"("type");
		CREATE INDEX IF NOT EXISTS "sources_enabled_idx" ON "sources"("is_enabled");
		CREATE INDEX IF NOT EXISTS "embeddings_item_id_idx" ON "embeddings"("item_id");
		CREATE INDEX IF NOT EXISTS "embeddings_model_idx" ON "embeddings"("model");
	`);
	
	// Run migrations
	const migrations = [
		"0002_add_browser_tables.sql",
		"0003_remove_unused_tables.sql",
		"0004_remove_browser_tables.sql",
	];
	
	for (const migrationFile of migrations) {
		try {
			const migrationPath = path.join(__dirname, "migrations", migrationFile);
			if (fs.existsSync(migrationPath)) {
				const migrationSQL = readFileSync(migrationPath, "utf-8");
				sqliteDb.exec(migrationSQL);
				console.log(`[Database] Applied migration: ${migrationFile}`);
			}
		} catch (error) {
			console.error(`[Database] Failed to run migration ${migrationFile}:`, error);
			// Continue anyway - migrations might already be applied
		}
	}
	
	// Seed all default apps (for both new and existing databases)
	// This ensures all apps are available in the UI
	try {
		const { seedDatabase } = require("./seed");
		seedDatabase(db);
	} catch (error) {
		// Log but don't throw - seeding is optional
		console.error("[Database] Failed to seed apps:", error instanceof Error ? error.message : error);
		// Continue anyway - apps might already be seeded or database might be read-only
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

/**
 * Execute a raw SQL query (SELECT only for safety)
 * Returns the results as an array of objects
 */
export function executeRawQuery(query: string): { success: boolean; data?: Record<string, unknown>[]; error?: string } {
	if (!sqliteDb) {
		return { success: false, error: "Database not initialized" };
	}

	// Safety: only allow SELECT queries
	const trimmedQuery = query.trim().toUpperCase();
	if (!trimmedQuery.startsWith("SELECT")) {
		return { success: false, error: "Only SELECT queries are allowed for safety" };
	}

	try {
		const results = sqliteDb.query(query).all() as Record<string, unknown>[];
		return { success: true, data: results };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
	}
}

/**
 * Get the database schema for AI context
 */
export function getDatabaseSchema(): string {
	return `
Database Tables:
- apps: id (text PK), name, description, transport, oauth (int), icon_url, config, connection_type, created_at, updated_at
- connections: id (text PK), server_id, server_name, vendor, transport_type, transport_config, status, secret_uri, credential_storage, encrypted_credentials, connection_metadata, last_synced_at, created_at, updated_at
- items: id (text PK), source (e.g. 'farcaster', 'teller', 'chrome', 'brave'), type (e.g. 'cast', 'transaction', 'browser-history'), timestamp (unix ms), data (JSON text), created_at, updated_at
- timeline_items: id (text PK), source, type, external_id, title, content, raw_data, url, timestamp, created_at, updated_at, sync_status, error_message
- sources: id (text PK), name, type, config, last_sync_at, is_enabled, created_at, updated_at
- embeddings: id (text PK), item_id (FK timeline_items), vector (blob), model, created_at
Note: timestamps are stored as Unix milliseconds (integer). The 'data' column in items is JSON text containing the raw data from each source.
`.trim();
}

// For backwards compatibility, export db as a getter
// This will throw if accessed before initialization
export { db };

// Export schemas
export * from "./schema/mcp";
export * from "./schema/core";

// Export seed function
export { seedDatabase, DEFAULT_APPS } from "./seed";

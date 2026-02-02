import { Database } from "bun:sqlite";
import { drizzle, BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema/mcp";
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
				"source" text NOT NULL,
				"type" text NOT NULL,
				"timestamp" integer NOT NULL,
				"data" text NOT NULL,
				"created_at" integer NOT NULL,
				"updated_at" integer NOT NULL
			);
			
			CREATE TABLE IF NOT EXISTS "chat_sessions" (
				"id" text PRIMARY KEY NOT NULL,
				"title" text,
				"created_at" integer NOT NULL,
				"updated_at" integer NOT NULL
			);
			
			CREATE TABLE IF NOT EXISTS "chat_messages" (
				"id" text PRIMARY KEY NOT NULL,
				"session_id" text NOT NULL REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
				"role" text NOT NULL,
				"content" text NOT NULL,
				"created_at" integer NOT NULL
			);
			
			CREATE INDEX IF NOT EXISTS "items_source_idx" ON "items"("source");
			CREATE INDEX IF NOT EXISTS "items_timestamp_idx" ON "items"("timestamp");
			CREATE INDEX IF NOT EXISTS "items_type_idx" ON "items"("type");
			CREATE INDEX IF NOT EXISTS "connections_server_id_idx" ON "connections"("server_id");
			CREATE INDEX IF NOT EXISTS "chat_messages_session_idx" ON "chat_messages"("session_id");
		`);
	}
	
	// Always ensure chat tables exist (for existing databases)
	sqliteDb.exec(`
		CREATE TABLE IF NOT EXISTS "chat_sessions" (
			"id" text PRIMARY KEY NOT NULL,
			"title" text,
			"created_at" integer NOT NULL,
			"updated_at" integer NOT NULL
		);
		
		CREATE TABLE IF NOT EXISTS "chat_messages" (
			"id" text PRIMARY KEY NOT NULL,
			"session_id" text NOT NULL REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
			"role" text NOT NULL,
			"content" text NOT NULL,
			"created_at" integer NOT NULL
		);
		
		CREATE INDEX IF NOT EXISTS "chat_messages_session_idx" ON "chat_messages"("session_id");
	`);
	
	// Always ensure core tables exist (for existing databases)
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
		
		CREATE INDEX IF NOT EXISTS "items_source_idx" ON "items"("source");
		CREATE INDEX IF NOT EXISTS "items_timestamp_idx" ON "items"("timestamp");
		CREATE INDEX IF NOT EXISTS "items_type_idx" ON "items"("type");
		CREATE INDEX IF NOT EXISTS "connections_server_id_idx" ON "connections"("server_id");
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
- chat_sessions: id (text PK), title, created_at, updated_at
- chat_messages: id (text PK), session_id, role, content, created_at
Note: timestamps are stored as Unix milliseconds (integer). The 'data' column in items is JSON text containing the raw data from each source. Browser history entries are stored in the items table with source='chrome' or source='brave'.
`.trim();
}

// For backwards compatibility, export db as a getter
// This will throw if accessed before initialization
export { db };

// Export schemas
export * from "./schema/mcp";

// Export seed function
export { seedDatabase, DEFAULT_APPS } from "./seed";

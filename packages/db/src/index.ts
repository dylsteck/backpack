import { Database } from "bun:sqlite";
import { drizzle, BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema/mcp";
import * as browserSchema from "./schema/browser";
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
			
			CREATE TABLE IF NOT EXISTS "browser_history" (
				"id" text PRIMARY KEY NOT NULL,
				"url" text NOT NULL,
				"title" text,
				"favicon" text,
				"visited_at" integer NOT NULL,
				"source" text DEFAULT 'browser' NOT NULL,
				"created_at" integer NOT NULL
			);
			
			CREATE TABLE IF NOT EXISTS "browser_sessions" (
				"id" text PRIMARY KEY NOT NULL,
				"tabs" text,
				"active_tab_id" text,
				"created_at" integer NOT NULL,
				"updated_at" integer NOT NULL
			);
			
			CREATE INDEX IF NOT EXISTS "browser_history_url_idx" ON "browser_history"("url");
			CREATE INDEX IF NOT EXISTS "browser_history_visited_at_idx" ON "browser_history"("visited_at");
			CREATE INDEX IF NOT EXISTS "browser_history_source_idx" ON "browser_history"("source");
		`);
	}
	
	// Always ensure browser tables exist (for existing databases)
	sqliteDb.exec(`
		CREATE TABLE IF NOT EXISTS "browser_history" (
			"id" text PRIMARY KEY NOT NULL,
			"url" text NOT NULL,
			"title" text,
			"favicon" text,
			"visited_at" integer NOT NULL,
			"source" text DEFAULT 'browser' NOT NULL,
			"created_at" integer NOT NULL
		);
		
		CREATE TABLE IF NOT EXISTS "browser_sessions" (
			"id" text PRIMARY KEY NOT NULL,
			"tabs" text,
			"active_tab_id" text,
			"created_at" integer NOT NULL,
			"updated_at" integer NOT NULL
		);
		
		CREATE INDEX IF NOT EXISTS "browser_history_url_idx" ON "browser_history"("url");
		CREATE INDEX IF NOT EXISTS "browser_history_visited_at_idx" ON "browser_history"("visited_at");
		CREATE INDEX IF NOT EXISTS "browser_history_source_idx" ON "browser_history"("source");
	`);
	
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
	
	// Always ensure apps table exists (for existing databases)
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
	`);
	
	// Ensure Obsidian exists in apps table (migration for existing DBs)
	const obsidianExists = sqliteDb.query('SELECT 1 FROM apps WHERE id = ?').get('obsidian');
	if (!obsidianExists) {
		const now = Date.now();
		sqliteDb.run(
			`INSERT INTO apps (id, name, description, transport, oauth, icon_url, config, connection_type, created_at, updated_at) 
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				'obsidian',
				'Obsidian',
				'Connect your Obsidian vault to see notes on your timeline and use AI to edit them.',
				'[]',
				0,
				'https://obsidian.md/images/obsidian-logo-gradient.svg',
				'{}',
				'local',
				now,
				now
			]
		);
		console.log('[Database] Added Obsidian to existing database');
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
- items: id (text PK), source (e.g. 'farcaster', 'teller'), type (e.g. 'cast', 'transaction'), timestamp (unix ms), data (JSON text), created_at, updated_at
- chat_sessions: id (text PK), title, created_at, updated_at
- chat_messages: id (text PK), session_id, role, content, created_at
- browser_history: id (text PK), url, title, favicon, visited_at (unix ms), source (default 'browser'), created_at
- browser_sessions: id (text PK), tabs (JSON array), active_tab_id, created_at, updated_at

Note: timestamps are stored as Unix milliseconds (integer). The 'data' column in items is JSON text containing the raw data from each source. Browser history entries can appear in the timeline when source='browser'.
`.trim();
}

// For backwards compatibility, export db as a getter
// This will throw if accessed before initialization
export { db };

// Export schemas
export * from "./schema/mcp";
export * from "./schema/browser";

// Export seed function
export { seedDatabase, DEFAULT_APPS } from "./seed";

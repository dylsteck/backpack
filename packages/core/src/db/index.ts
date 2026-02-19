import { Database } from "bun:sqlite";
import { drizzle, BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.js";
import { indexes } from "./schema.js";
import path from "path";
import os from "os";
import fs from "fs";

// Re-export schema
export * from "./schema.js";

// Global database instance
let db: BunSQLiteDatabase<typeof schema> | null = null;
let sqliteDb: Database | null = null;
let currentDbPath: string | null = null;

/**
 * Get the default database path based on OS
 */
export function getDefaultDbPath(): string {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  switch (platform) {
    case "darwin":
      return path.join(homeDir, "Library", "Application Support", "cortex", "cortex.db");
    case "linux":
      return path.join(homeDir, ".local", "share", "cortex", "cortex.db");
    case "win32":
      return path.join(homeDir, "AppData", "Roaming", "cortex", "cortex.db");
    default:
      // Fallback to home directory
      return path.join(homeDir, ".cortex", "cortex.db");
  }
}

/**
 * Ensure directory exists, creating it if necessary
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Initialize the database with schema
 */
function initializeSchema(database: Database): void {
  // Create tables
  database.exec(`
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
  `);
  
  // Create indexes
  Object.values(indexes).forEach((indexSql) => {
    database.exec(indexSql);
  });
}

/**
 * Get or create database instance
 * @param customPath Optional custom database path
 * @returns Database instance
 */
export function getDatabase(customPath?: string): BunSQLiteDatabase<typeof schema> {
  // Return existing instance if path matches
  if (db && currentDbPath === (customPath || getDefaultDbPath())) {
    return db;
  }
  
  // Close existing connection if switching paths
  if (db) {
    closeDatabase();
  }
  
  // Determine database path
  const dbPath = customPath || getDefaultDbPath();
  currentDbPath = dbPath;
  
  // Ensure parent directory exists
  const dir = path.dirname(dbPath);
  ensureDir(dir);
  
  try {
    // Create bun:sqlite connection
    sqliteDb = new Database(dbPath, { create: true });
    
    // Enable WAL mode for better performance
    sqliteDb.exec("PRAGMA journal_mode = WAL");
    
    // Enable foreign keys
    sqliteDb.exec("PRAGMA foreign_keys = ON");
    
    // Create drizzle instance
    db = drizzle(sqliteDb, { schema });
    
    // Initialize schema (tables and indexes)
    initializeSchema(sqliteDb);
    
    return db;
  } catch (error) {
    throw new Error(
      `Failed to initialize database at ${dbPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get the current database file path
 */
export function getDbPath(): string | null {
  return currentDbPath;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
    db = null;
    currentDbPath = null;
  }
}

/**
 * Check if database file exists
 */
export function databaseExists(customPath?: string): boolean {
  const dbPath = customPath || getDefaultDbPath();
  return fs.existsSync(dbPath);
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): {
  timelineItems: number;
  sources: number;
  embeddings: number;
  dbSize: number;
} {
  if (!sqliteDb) {
    throw new Error("Database not initialized");
  }
  
  const timelineItems = sqliteDb.query("SELECT COUNT(*) as count FROM timeline_items").get() as { count: number };
  const sources = sqliteDb.query("SELECT COUNT(*) as count FROM sources").get() as { count: number };
  const embeddings = sqliteDb.query("SELECT COUNT(*) as count FROM embeddings").get() as { count: number };
  
  const dbPath = currentDbPath || getDefaultDbPath();
  const stats = fs.statSync(dbPath);
  
  return {
    timelineItems: timelineItems.count,
    sources: sources.count,
    embeddings: embeddings.count,
    dbSize: stats.size,
  };
}

/**
 * Execute a raw SQL query (SELECT only for safety)
 */
export function executeRawQuery(
  query: string
): { success: boolean; data?: Record<string, unknown>[]; error?: string } {
  if (!sqliteDb) {
    return { success: false, error: "Database not initialized" };
  }
  
  // Safety: only allow SELECT queries
  const trimmedQuery = query.trim().toUpperCase();
  if (!trimmedQuery.startsWith("SELECT") && !trimmedQuery.startsWith("PRAGMA")) {
    return { success: false, error: "Only SELECT and PRAGMA queries are allowed for safety" };
  }
  
  try {
    const results = sqliteDb.query(query).all() as Record<string, unknown>[];
    return { success: true, data: results };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

import { initDatabase, getDatabase } from "@cortex/db";
import path from "path";
import os from "os";
import fs from "fs";

/**
 * Get Electron app userData directory (same as desktop app)
 */
function getElectronUserDataPath(): string {
	const platform = os.platform();
	const appName = "Cortex";
	
	if (platform === "darwin") {
		return path.join(os.homedir(), "Library", "Application Support", appName);
	} else if (platform === "win32") {
		return path.join(os.homedir(), "AppData", "Roaming", appName);
	} else {
		// Linux and others
		return path.join(os.homedir(), ".config", appName.toLowerCase());
	}
}

/**
 * Load database path from config file (same location as desktop app)
 */
function loadDatabasePathFromConfig(): string | null {
	try {
		const configPath = path.join(getElectronUserDataPath(), "cortex-config.json");
		if (fs.existsSync(configPath)) {
			const data = fs.readFileSync(configPath, "utf-8");
			const config = JSON.parse(data) as { databasePath?: string };
			if (config.databasePath) {
				return config.databasePath;
			}
		}
	} catch (error) {
		// Config file doesn't exist or is invalid, use default
	}
	return null;
}

/**
 * Get the default database path based on platform
 */
export function getDefaultDbPath(): string {
	const platform = os.platform();
	
	if (platform === "darwin") {
		return path.join(os.homedir(), "Library", "Application Support", "Cortex", "cortex.db");
	} else if (platform === "win32") {
		return path.join(os.homedir(), "AppData", "Roaming", "Cortex", "cortex.db");
	} else {
		// Linux and others
		return path.join(os.homedir(), ".config", "cortex", "cortex.db");
	}
}

/**
 * Get the actual database path (from config, env, or default)
 */
export function getDatabasePath(): string {
	// 1. Check environment variable
	if (process.env.DATABASE_PATH) {
		return process.env.DATABASE_PATH;
	}
	
	// 2. Try to load from config file (same as desktop app)
	const configPath = loadDatabasePathFromConfig();
	if (configPath) {
		return configPath;
	}
	
	// 3. Fall back to default
	return getDefaultDbPath();
}

/**
 * Ensure database is initialized and return the instance
 */
export function ensureDatabase() {
	const dbPath = getDatabasePath();
	
	// Debug: log database path (only in verbose mode or if DATABASE_DEBUG is set)
	if (process.env.DATABASE_DEBUG) {
		console.error(`[CLI] Using database: ${dbPath}`);
		console.error(`[CLI] Database exists: ${fs.existsSync(dbPath)}`);
	}
	
	try {
		// Try to get existing database first
		const db = getDatabase();
		// Verify tables exist by checking for items table
		// If tables don't exist, re-initialize
		try {
			db.query.items.findFirst();
		} catch {
			// Tables don't exist, need to initialize
			if (process.env.DATABASE_DEBUG) {
				console.error(`[CLI] Tables missing, re-initializing database`);
			}
			const { db: newDb } = initDatabase(dbPath);
			return newDb;
		}
		return db;
	} catch {
		// Initialize if not already done
		if (process.env.DATABASE_DEBUG) {
			console.error(`[CLI] Database not initialized, creating at: ${dbPath}`);
		}
		const { db } = initDatabase(dbPath);
		return db;
	}
}

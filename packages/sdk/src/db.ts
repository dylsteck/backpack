import { initDatabase, getDatabase } from "@cortex/db";
import path from "path";
import os from "os";
import fs from "fs";

function getElectronUserDataPath(): string {
	const platform = os.platform();
	const appName = "Cortex";

	if (platform === "darwin") {
		return path.join(os.homedir(), "Library", "Application Support", appName);
	} else if (platform === "win32") {
		return path.join(os.homedir(), "AppData", "Roaming", appName);
	} else {
		return path.join(os.homedir(), ".config", appName.toLowerCase());
	}
}

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
	} catch {
		// Config file doesn't exist or is invalid
	}
	return null;
}

export function getDefaultDbPath(): string {
	const platform = os.platform();

	if (platform === "darwin") {
		return path.join(os.homedir(), "Library", "Application Support", "Cortex", "cortex.db");
	} else if (platform === "win32") {
		return path.join(os.homedir(), "AppData", "Roaming", "Cortex", "cortex.db");
	} else {
		return path.join(os.homedir(), ".config", "cortex", "cortex.db");
	}
}

export function getDatabasePath(customPath?: string): string {
	if (customPath) {
		return customPath;
	}

	if (process.env.DATABASE_PATH) {
		return process.env.DATABASE_PATH;
	}

	const configPath = loadDatabasePathFromConfig();
	if (configPath) {
		return configPath;
	}

	return getDefaultDbPath();
}

export function ensureDatabase(customPath?: string) {
	const dbPath = getDatabasePath(customPath);

	try {
		const db = getDatabase();
		try {
			db.query.items.findFirst();
		} catch {
			const { db: newDb } = initDatabase(dbPath);
			return newDb;
		}
		return db;
	} catch {
		const { db } = initDatabase(dbPath);
		return db;
	}
}

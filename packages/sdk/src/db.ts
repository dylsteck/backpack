import { initDatabase, getDatabase } from "@backpack/db";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const APP_NAME = "Backpack";

function getUserDataDir(): string {
	const platform = os.platform();
	if (platform === "darwin") {
		return path.join(os.homedir(), "Library", "Application Support", APP_NAME);
	}
	if (platform === "win32") {
		return path.join(os.homedir(), "AppData", "Roaming", APP_NAME);
	}
	return path.join(os.homedir(), ".config", APP_NAME.toLowerCase());
}

function loadDatabasePathFromConfig(): string | null {
	try {
		const configPath = path.join(getUserDataDir(), "backpack-config.json");
		if (!fs.existsSync(configPath)) return null;
		const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as { databasePath?: string };
		return config.databasePath ?? null;
	} catch {
		return null;
	}
}

export function getDefaultDbPath(): string {
	return path.join(getUserDataDir(), "backpack.db");
}

export function getDatabasePath(customPath?: string): string {
	if (customPath) return customPath;
	if (process.env.DATABASE_PATH) return process.env.DATABASE_PATH;
	const configPath = loadDatabasePathFromConfig();
	if (configPath) return configPath;
	return getDefaultDbPath();
}

export function setDatabasePathInConfig(dbPath: string): void {
	const userDir = getUserDataDir();
	if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
	const configPath = path.join(userDir, "backpack-config.json");
	let config: Record<string, unknown> = {};
	if (fs.existsSync(configPath)) {
		try {
			config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
		} catch {
			config = {};
		}
	}
	config.databasePath = dbPath;
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function ensureDatabase(customPath?: string) {
	const dbPath = getDatabasePath(customPath);
	try {
		const db = getDatabase();
		try {
			db.query.items.findFirst();
			return db;
		} catch {
			const { db: newDb } = initDatabase(dbPath);
			return newDb;
		}
	} catch {
		const { db } = initDatabase(dbPath);
		return db;
	}
}

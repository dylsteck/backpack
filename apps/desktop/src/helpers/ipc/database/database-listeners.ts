import { ipcMain, dialog, app } from "electron";
import * as path from "path";
import * as fs from "fs";
import {
	DATABASE_SELECT_FOLDER_CHANNEL,
	DATABASE_GET_PATH_CHANNEL,
	DATABASE_SET_PATH_CHANNEL,
	DATABASE_GET_DEFAULT_PATH_CHANNEL,
	DATABASE_INIT_CHANNEL,
} from "./database-channels";

// Store the database path
let databasePath: string | null = null;

// Store the server port for API calls
let serverPort: number = 3000;

// Config file to persist database path
const CONFIG_FILE = "cortex-config.json";

function getConfigPath(): string {
	return path.join(app.getPath("userData"), CONFIG_FILE);
}

function loadConfig(): { databasePath?: string } {
	try {
		const configPath = getConfigPath();
		if (fs.existsSync(configPath)) {
			const data = fs.readFileSync(configPath, "utf-8");
			return JSON.parse(data);
		}
	} catch (error) {
		console.error("Failed to load config:", error);
	}
	return {};
}

function saveConfig(config: { databasePath?: string }): void {
	try {
		const configPath = getConfigPath();
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
	} catch (error) {
		console.error("Failed to save config:", error);
	}
}

export function getDefaultDatabasePath(): string {
	return path.join(app.getPath("userData"), "cortex.db");
}

export function getDatabasePath(): string | null {
	if (databasePath) return databasePath;
	
	// Try to load from config
	const config = loadConfig();
	if (config.databasePath) {
		databasePath = config.databasePath;
		return databasePath;
	}
	
	return null;
}

export function setDatabasePath(newPath: string): void {
	databasePath = newPath;
	saveConfig({ databasePath: newPath });
}

export function setServerPort(port: number): void {
	serverPort = port;
}

export function addDatabaseEventListeners(): void {
	// Get default database path
	ipcMain.handle(DATABASE_GET_DEFAULT_PATH_CHANNEL, () => {
		return getDefaultDatabasePath();
	});

	// Get current database path
	ipcMain.handle(DATABASE_GET_PATH_CHANNEL, () => {
		return getDatabasePath();
	});

	// Set database path
	ipcMain.handle(DATABASE_SET_PATH_CHANNEL, (_event, newPath: string) => {
		setDatabasePath(newPath);
		return { success: true };
	});

	// Open folder picker dialog
	ipcMain.handle(DATABASE_SELECT_FOLDER_CHANNEL, async () => {
		const result = await dialog.showOpenDialog({
			title: "Choose Data Location",
			defaultPath: app.getPath("documents"),
			properties: ["openDirectory", "createDirectory"],
			buttonLabel: "Select Folder",
		});

		if (result.canceled || result.filePaths.length === 0) {
			return null;
		}

		// Return the selected folder path (we'll add cortex.db to it)
		return result.filePaths[0];
	});

	// Initialize database at path - calls the server's init endpoint
	ipcMain.handle(DATABASE_INIT_CHANNEL, async (_event, dbPath: string) => {
		try {
			// Ensure directory exists
			const dir = path.dirname(dbPath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			
			// Call the server's init-database endpoint
			const response = await fetch(`http://127.0.0.1:${serverPort}/api/init-database`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ path: dbPath }),
			});
			
			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Server returned ${response.status}: ${errorText}`);
			}
			
			const result = await response.json() as { success: boolean; path?: string };
			
			if (result.success) {
				// Store the path locally
				setDatabasePath(dbPath);
				return { success: true, path: dbPath };
			} else {
				throw new Error("Server failed to initialize database");
			}
		} catch (error) {
			console.error("Failed to initialize database:", error);
			return { success: false, error: String(error) };
		}
	});
}

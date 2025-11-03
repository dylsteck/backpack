import { ipcMain, app } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import Database from "better-sqlite3";
import {
	CHROME_DETECT_HISTORY_PATH_CHANNEL,
	CHROME_READ_HISTORY_CHANNEL,
	CHROME_VERIFY_PATH_CHANNEL,
} from "./chrome-channels";

function expandPath(filePath: string): string {
	if (filePath.startsWith("~")) {
		const homeDir = os.homedir();
		return filePath.replace(/^~/, homeDir);
	}
	return filePath;
}

function getChromeHistoryPath(): string {
	const platform = process.platform;
	const homeDir = os.homedir();

	if (platform === "darwin") {
		return path.join(
			homeDir,
			"Library",
			"Application Support",
			"Google",
			"Chrome",
			"Default",
			"History",
		);
	} else if (platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA || "";
		return path.join(localAppData, "Google", "Chrome", "User Data", "Default", "History");
	} else {
		return path.join(homeDir, ".config", "google-chrome", "Default", "History");
	}
}

function detectChromeProfiles(): string[] {
	const platform = process.platform;
	const homeDir = os.homedir();
	const profiles: string[] = [];

	if (platform === "darwin") {
		const chromeDir = path.join(
			homeDir,
			"Library",
			"Application Support",
			"Google",
			"Chrome",
		);
		if (fs.existsSync(chromeDir)) {
			const entries = fs.readdirSync(chromeDir, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isDirectory()) {
					const historyPath = path.join(chromeDir, entry.name, "History");
					if (fs.existsSync(historyPath)) {
						profiles.push(historyPath);
					}
				}
			}
		}
	} else if (platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA || "";
		const chromeDir = path.join(localAppData, "Google", "Chrome", "User Data");
		if (fs.existsSync(chromeDir)) {
			const entries = fs.readdirSync(chromeDir, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isDirectory() && !entry.name.startsWith(".")) {
					const historyPath = path.join(chromeDir, entry.name, "History");
					if (fs.existsSync(historyPath)) {
						profiles.push(historyPath);
					}
				}
			}
		}
	} else {
		const chromeDir = path.join(homeDir, ".config", "google-chrome");
		if (fs.existsSync(chromeDir)) {
			const entries = fs.readdirSync(chromeDir, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isDirectory() && !entry.name.startsWith(".")) {
					const historyPath = path.join(chromeDir, entry.name, "History");
					if (fs.existsSync(historyPath)) {
						profiles.push(historyPath);
					}
				}
			}
		}
	}

	return profiles;
}

function readChromeHistory(historyPath: string): any[] {
	let db: Database.Database | null = null;
	let tempPath: string | null = null;

	try {
		try {
			db = new Database(historyPath, { readonly: true });
		} catch (error: any) {
			if (error.code === "SQLITE_BUSY" || error.message?.includes("locked")) {
				const tempDir = app.getPath("temp");
				tempPath = path.join(tempDir, `chrome-history-${Date.now()}.db`);
				fs.copyFileSync(historyPath, tempPath);
				db = new Database(tempPath, { readonly: true });
			} else {
				throw error;
			}
		}

		const query = `
			SELECT 
				datetime(last_visit_time/1000000-11644473600, 'unixepoch', 'localtime') as last_visited,
				url,
				title,
				visit_count,
				last_visit_time
			FROM urls
			ORDER BY last_visit_time DESC
			LIMIT 1000
		`;

		const rows = db.prepare(query).all() as any[];

		return rows.map((row) => ({
			url: row.url,
			title: row.title || row.url,
			timestamp: new Date(row.last_visited).toISOString(),
			visitCount: row.visit_count || 0,
			lastVisitTime: row.last_visit_time,
		}));
	} finally {
		if (db) {
			db.close();
		}
		if (tempPath && fs.existsSync(tempPath)) {
			fs.unlinkSync(tempPath);
		}
	}
}

export function addChromeEventListeners() {
	ipcMain.handle(CHROME_DETECT_HISTORY_PATH_CHANNEL, () => {
		try {
			const defaultPath = getChromeHistoryPath();
			const profiles = detectChromeProfiles();
			return {
				success: true,
				defaultPath,
				profiles: profiles.length > 0 ? profiles : [defaultPath],
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.message,
				defaultPath: getChromeHistoryPath(),
				profiles: [],
			};
		}
	});

	ipcMain.handle(CHROME_VERIFY_PATH_CHANNEL, (_event, filePath: string) => {
		try {
			const expandedPath = expandPath(filePath);
			if (!fs.existsSync(expandedPath)) {
				return { success: false, error: "File does not exist" };
			}

			const stats = fs.statSync(expandedPath);
			if (!stats.isFile()) {
				return { success: false, error: "Path is not a file" };
			}

			try {
				const db = new Database(expandedPath, { readonly: true });
				const tables = db
					.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='urls'")
					.get();
				db.close();

				if (!tables) {
					return { success: false, error: "File is not a valid Chrome history database" };
				}

				return { success: true };
			} catch (error: any) {
				if (error.code === "SQLITE_BUSY" || error.message?.includes("locked")) {
					return { success: true, locked: true };
				}
				return { success: false, error: error.message };
			}
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle(CHROME_READ_HISTORY_CHANNEL, (_event, historyPath: string) => {
		try {
			const expandedPath = expandPath(historyPath);
			if (!fs.existsSync(expandedPath)) {
				return { success: false, error: `History file does not exist at: ${expandedPath}` };
			}

			const history = readChromeHistory(expandedPath);
			return { success: true, data: history };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	});
}

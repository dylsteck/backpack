import { Command } from "commander";
import chalk from "chalk";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { ensureDatabase } from "../utils/db";
import { getDatabase, items, connections } from "@cortex/db";
import { desc, gt, eq } from "drizzle-orm";
import { createSpinner, success, error as logError, info, warn } from "../utils/output";

const QMD_ITEMS_DIR = path.join(os.homedir(), ".cache", "cortex", "qmd-items");
const QMD_STATE_FILE = path.join(os.homedir(), ".cache", "cortex", "qmd-state.json");

interface QMDState {
	lastExportAt: string | null;
	collections: string[];
}

function loadState(): QMDState {
	try {
		if (fs.existsSync(QMD_STATE_FILE)) {
			return JSON.parse(fs.readFileSync(QMD_STATE_FILE, "utf-8"));
		}
	} catch {
		// Ignore
	}
	return { lastExportAt: null, collections: [] };
}

function saveState(state: QMDState): void {
	const dir = path.dirname(QMD_STATE_FILE);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	fs.writeFileSync(QMD_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Execute a shell command and return success status
 */
async function execCommand(cmd: string, args: string[]): Promise<{ success: boolean; output: string }> {
	return new Promise((resolve) => {
		// Ensure Bun's bin directory is in PATH
		const bunBinPath = path.join(os.homedir(), ".bun", "bin");
		const currentPath = process.env.PATH || "";
		const env = {
			...process.env,
			PATH: currentPath.includes(bunBinPath) ? currentPath : `${bunBinPath}:${currentPath}`,
		};

		const proc = spawn(cmd, args, {
			stdio: ["ignore", "pipe", "pipe"],
			shell: true, // Use shell to find commands in PATH (e.g., ~/.bun/bin)
			env,
		});

		let output = "";
		proc.stdout.on("data", (data) => {
			output += data.toString();
		});
		proc.stderr.on("data", (data) => {
			output += data.toString();
		});

		proc.on("close", (code) => {
			resolve({ success: code === 0, output });
		});

		proc.on("error", (err) => {
			resolve({ success: false, output: err.message });
		});
	});
}

/**
 * Check if QMD is installed
 * QMD doesn't have a --version flag, so we check if the command exists
 * by trying to run it - if it exists, we'll get output (even if it's usage/help)
 */
async function isQmdInstalled(): Promise<boolean> {
	// Try running qmd with any command - if it exists, it will respond with output
	// If command not found, spawn will error or return empty output
	const result = await execCommand("qmd", ["status"]);
	
	// QMD is installed if:
	// 1. We got output (even if it's an error message)
	// 2. The output doesn't contain "not found" errors
	const hasOutput = result.output && result.output.length > 0;
	const notFound = result.output.toLowerCase().includes("not found") || 
	                 result.output.toLowerCase().includes("command not found") ||
	                 result.output.toLowerCase().includes("no such file");
	
	return hasOutput && !notFound;
}

/**
 * Export a timeline item to markdown file
 */
function exportItemToMarkdown(item: {
	id: string;
	source: string;
	type: string;
	timestamp: Date;
	data: unknown;
}): string {
	const data = item.data as Record<string, unknown>;
	const lines: string[] = [];

	// Frontmatter
	lines.push("---");
	lines.push(`source: ${item.source}`);
	lines.push(`type: ${item.type}`);
	lines.push(`id: ${item.id}`);
	lines.push(`timestamp: ${item.timestamp.toISOString()}`);
	lines.push("---");
	lines.push("");

	// Content based on source/type
	if (item.source === "farcaster" && item.type === "cast") {
		const cast = data as {
			text?: string;
			author?: { username?: string; display_name?: string };
			reactions?: { likes_count?: number; recasts_count?: number };
			channel?: { name?: string };
		};

		lines.push(`# Cast by @${cast.author?.username || "unknown"}`);
		lines.push("");
		lines.push(cast.text || "");
		lines.push("");
		
		if (cast.channel?.name) {
			lines.push(`**Channel:** /${cast.channel.name}`);
		}
		if (cast.reactions) {
			lines.push(`**Likes:** ${cast.reactions.likes_count || 0}`);
			lines.push(`**Recasts:** ${cast.reactions.recasts_count || 0}`);
		}
	} else if (item.source === "teller" && item.type === "transaction") {
		const txn = data as {
			description?: string;
			amount?: string;
			details?: { 
				category?: string; 
				counterparty?: { name?: string };
				processing_status?: string;
			};
			account_id?: string;
			type?: string;
		};

		const amount = parseFloat(txn.amount || "0");
		const amountStr = amount < 0 ? `-$${Math.abs(amount).toFixed(2)}` : `+$${amount.toFixed(2)}`;

		lines.push(`# Transaction: ${txn.description || "Unknown"}`);
		lines.push("");
		lines.push(`**Amount:** ${amountStr}`);
		
		if (txn.details?.counterparty?.name) {
			lines.push(`**Merchant:** ${txn.details.counterparty.name}`);
		}
		if (txn.details?.category) {
			lines.push(`**Category:** ${txn.details.category}`);
		}
		if (txn.type) {
			lines.push(`**Type:** ${txn.type}`);
		}
	} else if (item.source === "user" && item.type === "note") {
		const note = data as { title?: string; content?: string };
		lines.push(`# ${note.title || "Note"}`);
		lines.push("");
		lines.push(note.content || "");
	} else {
		// Generic fallback
		lines.push(`# ${item.type}`);
		lines.push("");
		lines.push("```json");
		lines.push(JSON.stringify(data, null, 2));
		lines.push("```");
	}

	return lines.join("\n");
}

export const embedCommand = new Command("embed")
	.description("Export timeline items and generate QMD embeddings for search")
	.option("--setup", "First-time setup: create QMD collections and contexts")
	.option("--export-only", "Only export items, skip embedding")
	.option("--force", "Re-export all items (not just new ones)")
	.option("--json", "Output as JSON")
	.action(async (options) => {
		try {
			ensureDatabase();
			const db = getDatabase();

			// Check if QMD is installed
			const qmdInstalled = await isQmdInstalled();

			if (!qmdInstalled && !options.exportOnly) {
				if (options.json) {
					console.log(JSON.stringify({ 
						success: false, 
						error: "QMD not installed. Install with: bun install -g https://github.com/tobi/qmd" 
					}));
				} else {
					logError("QMD is not installed.");
					info("Install with: bun install -g https://github.com/tobi/qmd");
				}
				process.exit(1);
			}

			const state = loadState();

			// Setup mode
			if (options.setup) {
				if (!options.json) {
					console.log(chalk.bold("\n🛠️  Setting up QMD for Cortex...\n"));
				}

				// Create cache directory
				if (!fs.existsSync(QMD_ITEMS_DIR)) {
					fs.mkdirSync(QMD_ITEMS_DIR, { recursive: true });
				}

				// Create subdirectories for each source
				const sources = ["farcaster", "teller", "user", "obsidian", "chrome", "brave"];
				for (const source of sources) {
					const sourceDir = path.join(QMD_ITEMS_DIR, source);
					if (!fs.existsSync(sourceDir)) {
						fs.mkdirSync(sourceDir, { recursive: true });
					}
				}

				if (qmdInstalled) {
					// Add QMD collection
					const spinner = options.json ? null : createSpinner("Adding QMD collection...");
					spinner?.start();

					const addResult = await execCommand("qmd", [
						"collection", "add", QMD_ITEMS_DIR, "--name", "cortex-items"
					]);

					if (addResult.success) {
						spinner?.succeed("Added cortex-items collection");
						state.collections.push("cortex-items");
					} else {
						spinner?.fail("Failed to add collection (may already exist)");
					}

					// Add context
					const contextSpinner = options.json ? null : createSpinner("Adding QMD context...");
					contextSpinner?.start();

					await execCommand("qmd", [
						"context", "add", "qmd://cortex-items",
						"Farcaster posts, banking transactions, notes, and browser history from Cortex"
					]);

					contextSpinner?.succeed("Added context for cortex-items");
				}

				saveState(state);

				if (options.json) {
					console.log(JSON.stringify({ success: true, message: "Setup complete" }));
				} else {
					success("Setup complete!");
					info(`Items will be exported to: ${QMD_ITEMS_DIR}`);
					console.log();
				}
				return;
			}

			// Export items
			const exportSpinner = options.json ? null : createSpinner("Exporting items...");
			exportSpinner?.start();

			// Get items to export
			const conditions = [];
			if (!options.force && state.lastExportAt) {
				const lastExport = new Date(state.lastExportAt);
				conditions.push(gt(items.updatedAt, lastExport));
			}

			let query = db.select().from(items);
			if (conditions.length > 0) {
				query = query.where(conditions[0]) as typeof query;
			}

			const itemsToExport = await query.orderBy(desc(items.timestamp));

			// Ensure directories exist
			if (!fs.existsSync(QMD_ITEMS_DIR)) {
				fs.mkdirSync(QMD_ITEMS_DIR, { recursive: true });
			}

			let exportedCount = 0;
			for (const item of itemsToExport) {
				const sourceDir = path.join(QMD_ITEMS_DIR, item.source);
				if (!fs.existsSync(sourceDir)) {
					fs.mkdirSync(sourceDir, { recursive: true });
				}

				const filename = `${item.type}-${item.id}.md`;
				const filepath = path.join(sourceDir, filename);
				const content = exportItemToMarkdown(item);
				
				fs.writeFileSync(filepath, content);
				exportedCount++;
			}

			state.lastExportAt = new Date().toISOString();
			saveState(state);

			exportSpinner?.succeed(`Exported ${exportedCount} items`);

			// Run QMD embed (unless --export-only)
			if (!options.exportOnly && qmdInstalled) {
				const embedSpinner = options.json ? null : createSpinner("Generating embeddings...");
				embedSpinner?.start();

				const embedResult = await execCommand("qmd", ["embed"]);

				if (embedResult.success) {
					embedSpinner?.succeed("Embeddings updated");
				} else {
					embedSpinner?.fail("Failed to generate embeddings");
					if (!options.json) {
						warn("You may need to run 'qmd embed' manually");
					}
				}
			}

			if (options.json) {
				console.log(JSON.stringify({
					success: true,
					exportedCount,
					exportDir: QMD_ITEMS_DIR,
					lastExportAt: state.lastExportAt,
				}));
			} else {
				console.log();
				success(`Done! Exported ${exportedCount} items.`);
				if (!options.exportOnly) {
					info("Search with: cortex search <query>");
				}
				console.log();
			}
		} catch (err) {
			if (options.json) {
				console.log(JSON.stringify({ 
					success: false, 
					error: err instanceof Error ? err.message : "Unknown error" 
				}));
			} else {
				console.error(chalk.red("Error:"), err instanceof Error ? err.message : err);
			}
			process.exit(1);
		}
	});

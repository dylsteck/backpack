import { Command } from "commander";
import chalk from "chalk";
import { ensureDatabase } from "../utils/db";
import { getDatabase, connections } from "@cortex/db";
import { eq } from "drizzle-orm";
import { SyncService } from "@cortex/api/services/sync/service";
import { createSpinner, success, error as logError, info } from "../utils/output";

export const syncCommand = new Command("sync")
	.description("Sync data from connected apps")
	.argument("[app]", "App ID to sync (or 'all' for all apps)")
	.option("--json", "Output as JSON")
	.action(async (app: string | undefined, options) => {
		try {
			ensureDatabase();
			const db = getDatabase();
			const syncService = new SyncService();

			// Get all connections
			const allConnections = await db.select().from(connections);
			const connectedApps = allConnections.filter((c) => c.status === "connected");

			if (connectedApps.length === 0) {
				if (options.json) {
					console.log(JSON.stringify({ success: false, error: "No connected apps" }));
				} else {
					console.log(chalk.yellow("\nNo connected apps to sync.\n"));
				}
				return;
			}

			const results: Array<{
				appId: string;
				success: boolean;
				itemsSynced?: number;
				error?: string;
			}> = [];

			if (!app || app === "all") {
				// Sync all connected apps
				if (!options.json) {
					console.log(chalk.bold(`\n🔄 Syncing ${connectedApps.length} apps...\n`));
				}

				for (const conn of connectedApps) {
					const spinner = options.json ? null : createSpinner(`Syncing ${conn.serverName}...`);
					spinner?.start();

					try {
						const result = await syncService.syncApp(conn.serverId);
						results.push({
							appId: conn.serverId,
							success: true,
							itemsSynced: result.itemsSynced,
						});
						spinner?.succeed(`${conn.serverName}: ${result.itemsSynced} items synced`);
					} catch (err) {
						const errorMsg = err instanceof Error ? err.message : "Unknown error";
						results.push({
							appId: conn.serverId,
							success: false,
							error: errorMsg,
						});
						spinner?.fail(`${conn.serverName}: ${errorMsg}`);
					}
				}
			} else {
				// Sync specific app
				const conn = connectedApps.find((c) => c.serverId === app);
				if (!conn) {
					if (options.json) {
						console.log(JSON.stringify({ success: false, error: `App '${app}' not found or not connected` }));
					} else {
						logError(`App '${app}' not found or not connected.`);
						info(`Available apps: ${connectedApps.map((c) => c.serverId).join(", ")}`);
					}
					process.exit(1);
				}

				const spinner = options.json ? null : createSpinner(`Syncing ${conn.serverName}...`);
				spinner?.start();

				try {
					const result = await syncService.syncApp(conn.serverId);
					results.push({
						appId: conn.serverId,
						success: true,
						itemsSynced: result.itemsSynced,
					});
					spinner?.succeed(`${conn.serverName}: ${result.itemsSynced} items synced`);
				} catch (err) {
					const errorMsg = err instanceof Error ? err.message : "Unknown error";
					results.push({
						appId: conn.serverId,
						success: false,
						error: errorMsg,
					});
					spinner?.fail(`${conn.serverName}: ${errorMsg}`);
				}
			}

			if (options.json) {
				console.log(JSON.stringify({
					success: results.every((r) => r.success),
					results,
				}, null, 2));
			} else {
				console.log();
				const successCount = results.filter((r) => r.success).length;
				const totalSynced = results.reduce((acc, r) => acc + (r.itemsSynced || 0), 0);
				
				if (successCount === results.length) {
					success(`Synced ${successCount} apps (${totalSynced} total items)`);
				} else {
					info(`Synced ${successCount}/${results.length} apps (${totalSynced} total items)`);
				}
				console.log();
			}
		} catch (err) {
			if (options.json) {
				console.log(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }));
			} else {
				console.error(chalk.red("Error:"), err instanceof Error ? err.message : err);
			}
			process.exit(1);
		}
	});

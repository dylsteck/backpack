import { Command } from "commander";
import chalk from "chalk";
import { ensureDatabase, getDatabasePath } from "../utils/db";
import { getDatabase, connections, items, apps } from "@cortex/db";
import { eq, sql } from "drizzle-orm";
import { formatTimestamp } from "../utils/output";

export const statusCommand = new Command("status")
	.description("Show Cortex status and connection information")
	.option("--json", "Output as JSON")
	.option("-i, --interactive", "Interactive dashboard mode")
	.action(async (options) => {
		try {
			ensureDatabase();
			const db = getDatabase();

			// Get all connections
			const allConnections = await db.select().from(connections);

			// Get item counts by source
			const itemCounts = await db
				.select({
					source: items.source,
					type: items.type,
					count: sql<number>`count(*)`,
				})
				.from(items)
				.groupBy(items.source, items.type);

			// Get all apps
			const allApps = await db.select().from(apps);

			const statusData = {
				connections: allConnections.map((conn) => ({
					id: conn.serverId,
					name: conn.serverName,
					status: conn.status,
					lastSyncedAt: conn.lastSyncedAt ? new Date(conn.lastSyncedAt).toISOString() : null,
				})),
				items: itemCounts.map((ic) => ({
					source: ic.source,
					type: ic.type,
					count: ic.count,
				})),
				apps: allApps.map((app) => ({
					id: app.id,
					name: app.name,
					connectionType: app.connectionType,
				})),
			};

			if (options.json) {
				console.log(JSON.stringify(statusData, null, 2));
				return;
			}

			if (options.interactive) {
				const { runDashboardTUI } = await import("../tui/dashboard");
				await runDashboardTUI({
					connections: statusData.connections.map((c) => ({
						id: c.id,
						name: c.name,
						status: c.status as "connected" | "disconnected" | "error",
						lastSyncedAt: c.lastSyncedAt ? new Date(c.lastSyncedAt) : null,
					})),
					dataSummary: statusData.items,
					totalItems: statusData.items.reduce((acc, i) => acc + i.count, 0),
				});
				return;
			}

			// Pretty output
			console.log(chalk.bold("\n📊 Cortex Status\n"));

			// Database path (debug info)
			if (!options.json) {
				console.log(chalk.dim(`Database: ${getDatabasePath()}\n`));
			}

			// Connections section
			console.log(chalk.bold.underline("Connections"));
			if (allConnections.length === 0) {
				console.log(chalk.dim("  No connections configured\n"));
			} else {
				for (const conn of allConnections) {
					const statusIcon = conn.status === "connected" ? chalk.green("●") : chalk.red("○");
					const syncInfo = conn.lastSyncedAt
						? chalk.dim(` (synced ${formatTimestamp(conn.lastSyncedAt)})`)
						: chalk.dim(" (never synced)");
					console.log(`  ${statusIcon} ${conn.serverName}${syncInfo}`);
				}
				console.log();
			}

			// Items section
			console.log(chalk.bold.underline("Data"));
			if (itemCounts.length === 0) {
				console.log(chalk.dim("  No items yet\n"));
			} else {
				const totalItems = itemCounts.reduce((acc, ic) => acc + ic.count, 0);
				console.log(chalk.dim(`  Total: ${totalItems} items\n`));
				
				// Group by source
				const bySource: Record<string, Array<{ type: string; count: number }>> = {};
				for (const ic of itemCounts) {
					if (!bySource[ic.source]) {
						bySource[ic.source] = [];
					}
					bySource[ic.source].push({ type: ic.type, count: ic.count });
				}

				for (const [source, types] of Object.entries(bySource)) {
					const sourceTotal = types.reduce((acc, t) => acc + t.count, 0);
					console.log(`  ${chalk.cyan(source)}: ${sourceTotal} items`);
					for (const t of types) {
						console.log(chalk.dim(`    - ${t.type}: ${t.count}`));
					}
				}
				console.log();
			}

			// Available apps section
			console.log(chalk.bold.underline("Available Apps"));
			const connectedIds = new Set(allConnections.map((c) => c.serverId));
			for (const app of allApps) {
				const isConnected = connectedIds.has(app.id);
				const icon = isConnected ? chalk.green("✓") : chalk.dim("○");
				console.log(`  ${icon} ${app.name}`);
			}
			console.log();
		} catch (err) {
			console.error(chalk.red("Error:"), err instanceof Error ? err.message : err);
			process.exit(1);
		}
	});

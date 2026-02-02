import { Command } from "commander";
import chalk from "chalk";
import { ensureDatabase } from "../utils/db";
import { getDatabase, connections, apps } from "@cortex/db";
import { eq } from "drizzle-orm";
import { formatTimestamp } from "../utils/output";

export const connectionsCommand = new Command("connections")
	.description("List and manage app connections")
	.option("--json", "Output as JSON")
	.action(async (options) => {
		try {
			ensureDatabase();
			const db = getDatabase();

			// Get all connections with app info
			const allConnections = await db.select().from(connections);
			const allApps = await db.select().from(apps);

			const appMap = new Map(allApps.map((a) => [a.id, a]));

			const connectionData = allConnections.map((conn) => {
				const app = appMap.get(conn.serverId);
				return {
					id: conn.id,
					appId: conn.serverId,
					appName: app?.name || conn.serverName,
					status: conn.status,
					transportType: conn.transportType,
					lastSyncedAt: conn.lastSyncedAt ? new Date(conn.lastSyncedAt).toISOString() : null,
					createdAt: new Date(conn.createdAt).toISOString(),
				};
			});

			if (options.json) {
				console.log(JSON.stringify(connectionData, null, 2));
				return;
			}

			// Pretty output
			console.log(chalk.bold("\n🔗 Connections\n"));

			if (connectionData.length === 0) {
				console.log(chalk.dim("No connections configured."));
				console.log(chalk.dim("Use the Cortex desktop app to add connections.\n"));
				return;
			}

			for (const conn of connectionData) {
				const statusColor = conn.status === "connected" ? chalk.green : chalk.red;
				const statusIcon = conn.status === "connected" ? "●" : "○";

				console.log(`${statusColor(statusIcon)} ${chalk.bold(conn.appName)}`);
				console.log(chalk.dim(`  ID: ${conn.id}`));
				console.log(chalk.dim(`  Status: ${conn.status}`));
				console.log(chalk.dim(`  Transport: ${conn.transportType}`));
				if (conn.lastSyncedAt) {
					console.log(chalk.dim(`  Last synced: ${formatTimestamp(conn.lastSyncedAt)}`));
				}
				console.log(chalk.dim(`  Connected: ${formatTimestamp(conn.createdAt)}`));
				console.log();
			}
		} catch (err) {
			console.error(chalk.red("Error:"), err instanceof Error ? err.message : err);
			process.exit(1);
		}
	});

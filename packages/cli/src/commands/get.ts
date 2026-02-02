import { Command } from "commander";
import chalk from "chalk";
import { ensureDatabase } from "../utils/db";
import { getDatabase, items } from "@cortex/db";
import { eq } from "drizzle-orm";
import { formatSource, formatType, formatTimestamp, formatAmount } from "../utils/output";

export const getCommand = new Command("get")
	.description("Get a specific item by ID")
	.argument("<id>", "Item ID to retrieve")
	.option("--json", "Output as JSON")
	.action(async (id: string, options) => {
		try {
			ensureDatabase();
			const db = getDatabase();

			const [item] = await db.select().from(items).where(eq(items.id, id)).limit(1);

			if (!item) {
				console.error(chalk.red(`Item not found: ${id}`));
				process.exit(1);
			}

			if (options.json) {
				console.log(JSON.stringify({
					id: item.id,
					source: item.source,
					type: item.type,
					timestamp: item.timestamp.toISOString(),
					data: item.data,
					createdAt: item.createdAt.toISOString(),
					updatedAt: item.updatedAt.toISOString(),
				}, null, 2));
				return;
			}

			// Pretty output
			console.log();
			console.log(`${formatSource(item.source)} ${formatType(item.type)} ${chalk.dim(formatTimestamp(item.timestamp))}`);
			console.log(chalk.dim(`ID: ${item.id}`));
			console.log();

			// Format based on type
			const data = item.data as Record<string, unknown>;

			if (item.source === "farcaster" && item.type === "cast") {
				const cast = data as {
					text?: string;
					author?: { username?: string; display_name?: string };
					reactions?: { likes_count?: number; recasts_count?: number };
					channel?: { name?: string };
				};

				if (cast.author) {
					console.log(chalk.bold(`@${cast.author.username || "unknown"}`));
					if (cast.author.display_name) {
						console.log(chalk.dim(cast.author.display_name));
					}
				}
				console.log();
				console.log(cast.text || "");
				console.log();
				if (cast.channel?.name) {
					console.log(chalk.dim(`Channel: /${cast.channel.name}`));
				}
				if (cast.reactions) {
					console.log(chalk.dim(`❤️ ${cast.reactions.likes_count || 0}  🔁 ${cast.reactions.recasts_count || 0}`));
				}
			} else if (item.source === "teller" && item.type === "transaction") {
				const txn = data as {
					description?: string;
					amount?: string;
					details?: { category?: string; counterparty?: { name?: string } };
					account_id?: string;
				};

				const amount = parseFloat(txn.amount || "0");
				console.log(chalk.bold(txn.description || "Transaction"));
				console.log(formatAmount(amount));
				console.log();
				if (txn.details?.counterparty?.name) {
					console.log(chalk.dim(`Merchant: ${txn.details.counterparty.name}`));
				}
				if (txn.details?.category) {
					console.log(chalk.dim(`Category: ${txn.details.category}`));
				}
			} else {
				// Generic output
				console.log(JSON.stringify(data, null, 2));
			}

			console.log();
		} catch (err) {
			console.error(chalk.red("Error:"), err instanceof Error ? err.message : err);
			process.exit(1);
		}
	});

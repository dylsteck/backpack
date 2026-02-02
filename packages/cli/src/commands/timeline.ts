import { Command } from "commander";
import chalk from "chalk";
import { ensureDatabase } from "../utils/db";
import { getDatabase, items, connections } from "@cortex/db";
import { eq, and, desc, lt } from "drizzle-orm";
import { formatSource, formatType, formatTimestamp, formatAmount, truncate } from "../utils/output";

export const timelineCommand = new Command("timeline")
	.description("Get timeline items")
	.option("--json", "Output as JSON")
	.option("-s, --source <source>", "Filter by source (farcaster, teller, obsidian, etc.)")
	.option("-t, --type <type>", "Filter by type (cast, transaction, note, etc.)")
	.option("-l, --limit <number>", "Number of items to return", "25")
	.option("-c, --cursor <cursor>", "Pagination cursor (ISO timestamp)")
	.action(async (options) => {
		try {
			ensureDatabase();
			const db = getDatabase();

			const limit = parseInt(options.limit, 10) || 25;
			const conditions = [];

			if (options.source) {
				conditions.push(eq(items.source, options.source));
			}
			if (options.type) {
				conditions.push(eq(items.type, options.type));
			}
			if (options.cursor) {
				const cursorDate = new Date(options.cursor);
				if (!isNaN(cursorDate.getTime())) {
					conditions.push(lt(items.timestamp, cursorDate));
				}
			}

			let query = db.select().from(items);
			if (conditions.length > 0) {
				query = query.where(and(...conditions)) as typeof query;
			}

			const results = await query
				.orderBy(desc(items.timestamp))
				.limit(limit + 1);

			const hasMore = results.length > limit;
			const itemsList = hasMore ? results.slice(0, limit) : results;
			const lastItem = itemsList[itemsList.length - 1];
			const nextCursor = hasMore && lastItem ? lastItem.timestamp.toISOString() : null;

			if (options.json) {
				console.log(JSON.stringify({
					items: itemsList.map((item) => ({
						id: item.id,
						source: item.source,
						type: item.type,
						timestamp: item.timestamp.toISOString(),
						data: item.data,
					})),
					nextCursor,
					count: itemsList.length,
				}, null, 2));
				return;
			}

			// Pretty output
			if (itemsList.length === 0) {
				console.log(chalk.dim("\nNo items found.\n"));
				return;
			}

			console.log(chalk.bold(`\n📅 Timeline (${itemsList.length} items)\n`));

			for (const item of itemsList) {
				const data = item.data as Record<string, unknown>;
				
				// Header line
				console.log(
					`${formatSource(item.source)} ${formatType(item.type)} ${chalk.dim(formatTimestamp(item.timestamp))}`
				);

				// Content based on type
				if (item.source === "farcaster" && item.type === "cast") {
					const cast = data as { text?: string; author?: { username?: string } };
					const author = cast.author?.username ? `@${cast.author.username}: ` : "";
					console.log(`  ${author}${truncate(cast.text || "", 80)}`);
				} else if (item.source === "teller" && item.type === "transaction") {
					const txn = data as { description?: string; amount?: string };
					const amount = parseFloat(txn.amount || "0");
					console.log(`  ${txn.description || "Transaction"} ${formatAmount(amount)}`);
				} else if (item.source === "user" && item.type === "note") {
					const note = data as { title?: string; content?: string };
					console.log(`  ${note.title || truncate(note.content || "", 60)}`);
				} else {
					// Generic fallback
					const preview = JSON.stringify(data).slice(0, 60);
					console.log(`  ${preview}...`);
				}

				console.log(chalk.dim(`  ID: ${item.id}`));
				console.log();
			}

			if (nextCursor) {
				console.log(chalk.dim(`Use --cursor "${nextCursor}" to see more items\n`));
			}
		} catch (err) {
			console.error(chalk.red("Error:"), err instanceof Error ? err.message : err);
			process.exit(1);
		}
	});

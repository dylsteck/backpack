import { Command } from "commander";
import chalk from "chalk";
import { ensureDatabase } from "../utils/db";
import { getDatabase, items } from "@cortex/db";
import { eq, and, desc, lt, sql } from "drizzle-orm";
import { formatSource, formatType, formatTimestamp, formatAmount, truncate, output } from "../utils/output";

export const itemsCommand = new Command("items")
	.description("Get items by source with pagination and format options")
	.option("--json", "Output as JSON")
	.option("--csv", "Output as CSV")
	.option("-s, --source <source>", "Filter by source (required for bulk export)")
	.option("-t, --type <type>", "Filter by type")
	.option("-l, --limit <number>", "Number of items to return", "100")
	.option("-c, --cursor <cursor>", "Pagination cursor (ISO timestamp)")
	.option("--all", "Return all items (paginate automatically)")
	.action(async (options) => {
		try {
			ensureDatabase();
			const db = getDatabase();

			const limit = options.all ? 1000 : (parseInt(options.limit, 10) || 100);
			let allItems: Array<{
				id: string;
				source: string;
				type: string;
				timestamp: Date;
				data: unknown;
			}> = [];
			let cursor = options.cursor;
			let hasMore = true;

			// Fetch items (with auto-pagination if --all)
			while (hasMore) {
				const conditions = [];

				if (options.source) {
					conditions.push(eq(items.source, options.source));
				}
				if (options.type) {
					conditions.push(eq(items.type, options.type));
				}
				if (cursor) {
					const cursorDate = new Date(cursor);
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

				const batchHasMore = results.length > limit;
				const batch = batchHasMore ? results.slice(0, limit) : results;
				
				allItems = allItems.concat(batch);

				if (options.all && batchHasMore) {
					const lastItem = batch[batch.length - 1];
					cursor = lastItem?.timestamp.toISOString();
				} else {
					hasMore = false;
					if (batchHasMore && !options.all) {
						const lastItem = batch[batch.length - 1];
						cursor = lastItem?.timestamp.toISOString();
					} else {
						cursor = null;
					}
				}
			}

			// Get total count
			const countConditions = [];
			if (options.source) {
				countConditions.push(eq(items.source, options.source));
			}
			if (options.type) {
				countConditions.push(eq(items.type, options.type));
			}

			let countQuery = db.select({ count: sql<number>`count(*)` }).from(items);
			if (countConditions.length > 0) {
				countQuery = countQuery.where(and(...countConditions)) as typeof countQuery;
			}
			const [{ count: total }] = await countQuery;

			// Format output
			const outputData = allItems.map((item) => ({
				id: item.id,
				source: item.source,
				type: item.type,
				timestamp: item.timestamp.toISOString(),
				data: item.data,
			}));

			if (options.json) {
				console.log(JSON.stringify({
					items: outputData,
					nextCursor: cursor,
					total,
					count: outputData.length,
				}, null, 2));
				return;
			}

			if (options.csv) {
				// Flatten data for CSV
				const csvData = outputData.map((item) => {
					const data = item.data as Record<string, unknown>;
					return {
						id: item.id,
						source: item.source,
						type: item.type,
						timestamp: item.timestamp,
						// Include common fields from data
						...(item.source === "farcaster" ? {
							text: (data.text as string) || "",
							author: (data.author as { username?: string })?.username || "",
						} : {}),
						...(item.source === "teller" ? {
							description: (data.description as string) || "",
							amount: (data.amount as string) || "",
							category: ((data.details as { category?: string })?.category) || "",
						} : {}),
					};
				});
				output(csvData, { format: "csv" });
				return;
			}

			// Pretty output
			if (outputData.length === 0) {
				console.log(chalk.dim("\nNo items found.\n"));
				return;
			}

			const sourceLabel = options.source ? ` from ${options.source}` : "";
			const typeLabel = options.type ? ` (${options.type})` : "";
			console.log(chalk.bold(`\n📦 Items${sourceLabel}${typeLabel} (${outputData.length}/${total})\n`));

			for (const item of outputData) {
				const data = item.data as Record<string, unknown>;
				
				console.log(
					`${formatSource(item.source)} ${formatType(item.type)} ${chalk.dim(formatTimestamp(item.timestamp))}`
				);

				if (item.source === "farcaster") {
					const cast = data as { text?: string; author?: { username?: string } };
					console.log(`  ${truncate(cast.text || "", 80)}`);
				} else if (item.source === "teller") {
					const txn = data as { description?: string; amount?: string };
					const amount = parseFloat(txn.amount || "0");
					console.log(`  ${txn.description || "Transaction"} ${formatAmount(amount)}`);
				} else {
					console.log(`  ${truncate(JSON.stringify(data), 80)}`);
				}

				console.log(chalk.dim(`  ${item.id}`));
				console.log();
			}

			if (cursor && !options.all) {
				console.log(chalk.dim(`Use --cursor "${cursor}" to see more items\n`));
			}
		} catch (err) {
			console.error(chalk.red("Error:"), err instanceof Error ? err.message : err);
			process.exit(1);
		}
	});

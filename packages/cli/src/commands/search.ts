import { Command } from "commander";
import chalk from "chalk";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import { ensureDatabase } from "../utils/db";
import { getDatabase, items } from "@cortex/db";
import { desc, or, sql } from "drizzle-orm";
import { formatSource, formatType, formatTimestamp, truncate } from "../utils/output";

interface QMDResult {
	path: string;
	title?: string;
	score: number;
	snippet?: string;
	docid?: string;
}

interface QMDSearchResponse {
	results: QMDResult[];
}

/**
 * Execute QMD search command with timeout
 */
async function execQmd(args: string[], timeoutMs: number = 10000): Promise<QMDSearchResponse> {
	return new Promise((resolve) => {
		// Ensure Bun's bin directory is in PATH
		const bunBinPath = path.join(os.homedir(), ".bun", "bin");
		const currentPath = process.env.PATH || "";
		const env = {
			...process.env,
			PATH: currentPath.includes(bunBinPath) ? currentPath : `${bunBinPath}:${currentPath}`,
		};

		const proc = spawn("qmd", args, {
			stdio: ["ignore", "pipe", "pipe"],
			shell: true, // Use shell to find commands in PATH
			env,
		});

		let stdout = "";
		let stderr = "";
		let timedOut = false;

		// Set timeout
		const timeout = setTimeout(() => {
			timedOut = true;
			proc.kill('SIGKILL');
			console.error('[Search] QMD command timed out after', timeoutMs, 'ms');
			resolve({ results: [] });
		}, timeoutMs);

		proc.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		proc.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		proc.on("close", (code) => {
			clearTimeout(timeout);
			if (timedOut) {
				return; // Already resolved with empty results
			}
			if (code !== 0) {
				// QMD not installed or error
				resolve({ results: [] });
				return;
			}
			try {
				const parsed = JSON.parse(stdout);
				resolve(parsed);
			} catch {
				resolve({ results: [] });
			}
		});

		proc.on("error", () => {
			clearTimeout(timeout);
			if (!timedOut) {
				// QMD not installed
				resolve({ results: [] });
			}
		});
	});
}

/**
 * Simple database text search as fallback
 */
async function searchDatabase(query: string, limit: number) {
	const db = getDatabase();
	
	// Case-insensitive LIKE search on JSON data
	// Search in multiple fields for better results
	const lowerPattern = `%${query.toLowerCase()}%`;
	
	// Search in JSON data (case-insensitive)
	const results = await db
		.select()
		.from(items)
		.where(
			or(
				sql`LOWER(CAST(${items.data} AS TEXT)) LIKE ${lowerPattern}`,
				sql`LOWER(${items.id}) LIKE ${lowerPattern}`,
				sql`LOWER(${items.type}) LIKE ${lowerPattern}`,
				sql`LOWER(${items.source}) LIKE ${lowerPattern}`,
				sql`LOWER(json_extract(${items.data}, '$.description')) LIKE ${lowerPattern}`,
				sql`LOWER(json_extract(${items.data}, '$.text')) LIKE ${lowerPattern}`,
				sql`LOWER(json_extract(${items.data}, '$.title')) LIKE ${lowerPattern}`,
				sql`LOWER(json_extract(${items.data}, '$.name')) LIKE ${lowerPattern}`
			)
		)
		.orderBy(desc(items.timestamp))
		.limit(limit * 2); // Get more to merge with QMD results

	return results;
}

export const searchCommand = new Command("search")
	.description("Search across all Cortex data using hybrid search (QMD + database)")
	.argument("<query>", "Search query")
	.option("--json", "Output as JSON")
	.option("-n, --limit <number>", "Number of results", "10")
	.option("-i, --interactive", "Interactive mode (requires OpenTUI)")
	.option("--db-only", "Search database only (skip QMD)")
	.action(async (query: string, options) => {
		try {
			// Ensure database is available, but don't fail if seeding fails
			try {
				ensureDatabase();
			} catch (dbError) {
				console.error('[Search] Database initialization warning:', dbError instanceof Error ? dbError.message : dbError);
				// Continue anyway - database might be read-only but search can still work
			}

			const normalizedQuery = query.trim();
			const limit = parseInt(options.limit, 10) || 10;
			if (!normalizedQuery) {
				if (options.json) {
					console.log(JSON.stringify({ query: '', results: [], count: 0 }, null, 2));
					return;
				}
				console.log(chalk.dim(`\nPlease provide a search query.\n`));
				return;
			}
			
			interface SearchResult {
				id: string;
				source: string;
				type: string;
				title?: string;
				snippet?: string;
				score: number;
				timestamp?: string;
				data?: unknown;
			}

			const results: SearchResult[] = [];
			const seenIds = new Set<string>();

			// Search QMD and database in parallel for speed (if not --db-only)
			if (!options.dbOnly) {
				// Start both searches in parallel
				const qmdPromise = Promise.race([
					execQmd([
						"query",
						normalizedQuery,
						"--json",
						"-n",
						String(limit * 2), // Get more to merge
					], 3000), // 3 second timeout - fail fast
					new Promise<QMDSearchResponse>((resolve) => {
						setTimeout(() => resolve({ results: [] }), 3000);
					}),
				]);
				
				const dbPromise = searchDatabase(normalizedQuery, limit).catch(() => []);
				
				// Wait for both in parallel
				const [qmdResponse, dbResults] = await Promise.allSettled([
					qmdPromise,
					dbPromise,
				]);
				
				// Process DB results first (usually faster)
				if (dbResults.status === 'fulfilled') {
					for (const item of dbResults.value) {
						if (!seenIds.has(item.id)) {
							seenIds.add(item.id);
							
							const data = item.data as Record<string, unknown>;
							let title = "";
							let snippet = "";

							if (item.source === "farcaster") {
								const cast = data as { text?: string; author?: { username?: string } };
								title = `@${cast.author?.username || "unknown"}`;
								snippet = cast.text || "";
							} else if (item.source === "teller") {
								const txn = data as { description?: string; amount?: string };
								title = txn.description || "Transaction";
								snippet = `$${txn.amount || "0"}`;
							} else {
								title = String(data.title || data.name || item.type);
								snippet = JSON.stringify(data).slice(0, 100);
							}

							results.push({
								id: item.id,
								source: item.source,
								type: item.type,
								title,
								snippet,
								score: 0.5, // Lower score for DB results
								timestamp: item.timestamp.toISOString(),
								data: item.data,
							});
						}
					}
				}
				
				// Then add QMD results (higher scores)
				try {
					const qmdData = qmdResponse.status === 'fulfilled' ? qmdResponse.value : { results: [] };

					if (qmdData.results && qmdData.results.length > 0) {
						for (const result of qmdData.results) {
							// Parse source from path (e.g., ~/.cache/cortex/qmd-items/farcaster/cast-xxx.md)
							const pathParts = result.path.split("/");
							const filename = pathParts[pathParts.length - 1];
							const sourceDir = pathParts[pathParts.length - 2];

							// Extract ID from filename (e.g., cast-abc123.md -> abc123)
							const idMatch = filename?.match(/^[^-]+-(.+)\.md$/);
							const id = idMatch ? idMatch[1] : result.docid || filename;

							if (id && !seenIds.has(id)) {
								seenIds.add(id);
								results.push({
									id,
									source: sourceDir || "unknown",
									type: filename?.split("-")[0] || "item",
									title: result.title,
									snippet: result.snippet,
									score: result.score,
								});
							}
						}
					}
				} catch (err) {
					// QMD not available or error, continue with database search
					console.error('[Search] QMD error:', err instanceof Error ? err.message : err);
				}
			} else {
				// --db-only mode: search database only
				let dbResults: Awaited<ReturnType<typeof searchDatabase>> = [];
				try {
					dbResults = await searchDatabase(normalizedQuery, limit);
				} catch (dbError) {
					console.error('[Search] Database search error:', dbError instanceof Error ? dbError.message : dbError);
				}
				
				for (const item of dbResults) {
					if (!seenIds.has(item.id)) {
						seenIds.add(item.id);
						
						const data = item.data as Record<string, unknown>;
						let title = "";
						let snippet = "";

						if (item.source === "farcaster") {
							const cast = data as { text?: string; author?: { username?: string } };
							title = `@${cast.author?.username || "unknown"}`;
							snippet = cast.text || "";
						} else if (item.source === "teller") {
							const txn = data as { description?: string; amount?: string };
							title = txn.description || "Transaction";
							snippet = `$${txn.amount || "0"}`;
						} else {
							title = String(data.title || data.name || item.type);
							snippet = JSON.stringify(data).slice(0, 100);
						}

						results.push({
							id: item.id,
							source: item.source,
							type: item.type,
							title,
							snippet,
							score: 0.5, // Lower score for DB results
							timestamp: item.timestamp.toISOString(),
							data: item.data,
						});
					}
				}
			}

			// Sort by score
			results.sort((a, b) => b.score - a.score);
			const finalResults = results.slice(0, limit);

			if (options.json) {
				console.log(JSON.stringify({
					query: normalizedQuery,
					results: finalResults,
					count: finalResults.length,
				}, null, 2));
				return;
			}

			if (options.interactive) {
				const { runSearchTUI } = await import("../tui/search");
				const selected = await runSearchTUI({
					query,
					results: finalResults,
					onSelect: (result) => {
						console.log(JSON.stringify(result, null, 2));
					},
				});
				
				if (selected) {
					// Output the selected item's full data
					console.log(chalk.bold(`\nSelected: ${selected.title || selected.id}`));
					console.log(chalk.dim(`ID: ${selected.id}`));
				}
				return;
			}

			// Pretty output
			if (finalResults.length === 0) {
				console.log(chalk.dim(`\nNo results found for "${query}"\n`));
				return;
			}

			console.log(chalk.bold(`\n🔍 Search results for "${normalizedQuery}" (${finalResults.length})\n`));

			for (const result of finalResults) {
				const scoreColor = result.score > 0.7 ? chalk.green : result.score > 0.4 ? chalk.yellow : chalk.dim;
				const scoreLabel = scoreColor(`${Math.round(result.score * 100)}%`);

				console.log(
					`${formatSource(result.source)} ${formatType(result.type)} ${scoreLabel}`
				);
				
				if (result.title) {
					console.log(chalk.bold(`  ${result.title}`));
				}
				
				if (result.snippet) {
					console.log(`  ${truncate(result.snippet, 80)}`);
				}
				
				console.log(chalk.dim(`  ID: ${result.id}`));
				console.log();
			}
		} catch (err) {
			console.error(chalk.red("Error:"), err instanceof Error ? err.message : err);
			process.exit(1);
		}
	});

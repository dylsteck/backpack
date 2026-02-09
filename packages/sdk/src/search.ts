import { spawn } from "child_process";
import path from "path";
import os from "os";
import { getDatabase, items } from "@cortex/db";
import { desc, or, sql } from "drizzle-orm";
import type { SearchResultItem } from "./types";

interface QMDSearchResponse {
	results: Array<{
		path: string;
		title?: string;
		score: number;
		snippet?: string;
		docid?: string;
	}>;
}

async function execQmd(args: string[], timeoutMs: number = 10000): Promise<QMDSearchResponse> {
	return new Promise((resolve) => {
		const bunBinPath = path.join(os.homedir(), ".bun", "bin");
		const currentPath = process.env.PATH || "";
		const env = {
			...process.env,
			PATH: currentPath.includes(bunBinPath) ? currentPath : `${bunBinPath}:${currentPath}`,
		};

		const proc = spawn("qmd", args, {
			stdio: ["ignore", "pipe", "pipe"],
			shell: true,
			env,
		});

		let stdout = "";
		let timedOut = false;

		const timeout = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGKILL");
			resolve({ results: [] });
		}, timeoutMs);

		proc.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		proc.stderr.on("data", () => {});

		proc.on("close", (code) => {
			clearTimeout(timeout);
			if (timedOut) return;
			if (code !== 0) {
				resolve({ results: [] });
				return;
			}
			try {
				resolve(JSON.parse(stdout));
			} catch {
				resolve({ results: [] });
			}
		});

		proc.on("error", () => {
			clearTimeout(timeout);
			if (!timedOut) {
				resolve({ results: [] });
			}
		});
	});
}

async function searchDatabase(query: string, limit: number) {
	const db = getDatabase();
	const lowerPattern = `%${query.toLowerCase()}%`;

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
		.limit(limit * 2);

	return results;
}

function extractItemMeta(item: { source: string; type: string; data: Record<string, any> }): {
	title: string;
	snippet: string;
} {
	const data = item.data;
	if (item.source === "farcaster") {
		const cast = data as { text?: string; author?: { username?: string } };
		return {
			title: `@${cast.author?.username || "unknown"}`,
			snippet: cast.text || "",
		};
	} else if (item.source === "teller") {
		const txn = data as { description?: string; amount?: string };
		return {
			title: txn.description || "Transaction",
			snippet: `$${txn.amount || "0"}`,
		};
	}
	return {
		title: String(data.title || data.name || item.type),
		snippet: JSON.stringify(data).slice(0, 100),
	};
}

export async function hybridSearch(
	query: string,
	limit: number,
	dbOnly: boolean
): Promise<SearchResultItem[]> {
	const results: SearchResultItem[] = [];
	const seenIds = new Set<string>();

	if (!dbOnly) {
		const qmdPromise = execQmd(["query", query, "--json", "-n", String(limit * 2)], 3000);

		const dbPromise = searchDatabase(query, limit).catch(() => []);

		const [qmdResponse, dbResults] = await Promise.allSettled([qmdPromise, dbPromise]);

		// Process DB results first
		if (dbResults.status === "fulfilled") {
			for (const item of dbResults.value) {
				if (!seenIds.has(item.id)) {
					seenIds.add(item.id);
					const meta = extractItemMeta(item);
					results.push({
						id: item.id,
						source: item.source,
						type: item.type,
						title: meta.title,
						snippet: meta.snippet,
						score: 0.5,
						timestamp: item.timestamp.toISOString(),
						data: item.data as Record<string, any>,
					});
				}
			}
		}

		// Then QMD results (higher scores)
		const qmdData = qmdResponse.status === "fulfilled" ? qmdResponse.value : { results: [] };
		if (qmdData.results && qmdData.results.length > 0) {
			for (const result of qmdData.results) {
				const pathParts = result.path.split("/");
				const filename = pathParts[pathParts.length - 1];
				const sourceDir = pathParts[pathParts.length - 2];
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
	} else {
		const dbResults = await searchDatabase(query, limit).catch(() => []);
		for (const item of dbResults) {
			if (!seenIds.has(item.id)) {
				seenIds.add(item.id);
				const meta = extractItemMeta(item);
				results.push({
					id: item.id,
					source: item.source,
					type: item.type,
					title: meta.title,
					snippet: meta.snippet,
					score: 0.5,
					timestamp: item.timestamp.toISOString(),
					data: item.data as Record<string, any>,
				});
			}
		}
	}

	results.sort((a, b) => b.score - a.score);
	return results.slice(0, limit);
}

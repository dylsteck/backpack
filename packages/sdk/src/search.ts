import { getDatabase, items } from "@backpack/db";
import { desc, or, sql } from "drizzle-orm";
import type { SearchResultItem } from "./types";

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
				sql`LOWER(json_extract(${items.data}, '$.name')) LIKE ${lowerPattern}`,
			),
		)
		.orderBy(desc(items.timestamp))
		.limit(limit * 2);

	return results;
}

function extractItemMeta(item: { source: string; type: string; data: Record<string, unknown> }): {
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
	}
	if (item.source === "teller") {
		const txn = data as { description?: string; amount?: string };
		return {
			title: txn.description || "Transaction",
			snippet: `$${txn.amount || "0"}`,
		};
	}
	const titleVal = data["title"];
	const nameVal = data["name"];
	const title =
		(typeof titleVal === "string" ? titleVal : undefined) ??
		(typeof nameVal === "string" ? nameVal : undefined) ??
		item.type;
	return {
		title: String(title),
		snippet: JSON.stringify(data).slice(0, 100),
	};
}

export async function dbSearch(query: string, limit: number): Promise<SearchResultItem[]> {
	const results = await searchDatabase(query, limit).catch(() => []);
	const seen = new Set<string>();
	const out: SearchResultItem[] = [];

	for (const item of results) {
		if (seen.has(item.id)) continue;
		seen.add(item.id);
		const meta = extractItemMeta(item);
		out.push({
			id: item.id,
			source: item.source,
			type: item.type,
			title: meta.title,
			snippet: meta.snippet,
			score: 0.5,
			timestamp: item.timestamp.toISOString(),
			data: item.data as Record<string, unknown>,
		});
	}

	return out.slice(0, limit);
}

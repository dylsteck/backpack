import { Backpack } from "../src";

const c = new Backpack();

const queries = ["uber", "payment", "amazon"];

for (const q of queries) {
  const result = await c.search(q, { limit: 5, dbOnly: true });
  console.log(`=== Search: "${q}" (${result.count} results) ===`);
  for (const r of result.results) {
    console.log(`  [${r.source}/${r.type}] score=${r.score} — ${r.title ?? r.id}`);
    if (r.snippet) console.log(`    ${r.snippet.slice(0, 80)}`);
  }
  console.log();
}

// Test empty query
const empty = await c.search("", { limit: 5 });
console.log(`Empty query returns: ${JSON.stringify(empty)}`);

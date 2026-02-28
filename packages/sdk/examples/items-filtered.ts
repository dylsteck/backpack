import { Backpack } from "../src";

const c = new Backpack();

// Get teller transactions with a small limit
const txns = await c.items({ source: "teller", type: "transaction", limit: 5 });
console.log(`=== Teller Transactions (${txns.count}/${txns.total}) ===`);
for (const item of txns.items) {
  const d = item.data as { description?: string; amount?: string; date?: string };
  console.log(`  ${d.date ?? item.timestamp.toISOString().slice(0, 10)}  $${d.amount ?? "?"}  ${d.description ?? "—"}`);
}
console.log(`nextCursor: ${txns.nextCursor}\n`);

// Get all items with --all pagination
const all = await c.items({ source: "teller", all: true });
console.log(`=== All teller items: ${all.count} fetched / ${all.total} total ===`);

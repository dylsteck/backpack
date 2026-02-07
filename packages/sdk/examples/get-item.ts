import { Cortex } from "../src";

const c = new Cortex();

// Grab the most recent item id from timeline
const tl = await c.timeline({ limit: 1 });
if (tl.items.length === 0) {
  console.log("No items in timeline");
  process.exit(0);
}

const id = tl.items[0].id;
console.log(`Fetching item: ${id}\n`);

const item = await c.get(id);
if (!item) {
  console.log("Item not found!");
  process.exit(1);
}

console.log(`source:    ${item.source}`);
console.log(`type:      ${item.type}`);
console.log(`timestamp: ${item.timestamp.toISOString()}`);
console.log(`data keys: ${Object.keys(item.data).join(", ")}`);
console.log(`\nFull data:\n${JSON.stringify(item.data, null, 2).slice(0, 500)}`);

// Also test a missing item
const missing = await c.get("nonexistent-id-12345");
console.log(`\nMissing item returns: ${missing}`);

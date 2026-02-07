import { Cortex } from "../src";

const c = new Cortex();

// Get first page
const page1 = await c.timeline({ limit: 3 });
console.log("=== Page 1 ===");
for (const item of page1.items) {
  console.log(`[${item.source}/${item.type}] ${item.timestamp.toISOString()} — ${item.id}`);
}
console.log(`nextCursor: ${page1.nextCursor}`);

// Get second page using cursor
if (page1.nextCursor) {
  const page2 = await c.timeline({ limit: 3, cursor: page1.nextCursor });
  console.log("\n=== Page 2 ===");
  for (const item of page2.items) {
    console.log(`[${item.source}/${item.type}] ${item.timestamp.toISOString()} — ${item.id}`);
  }
  console.log(`nextCursor: ${page2.nextCursor}`);
}

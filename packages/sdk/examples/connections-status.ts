import { Backpack } from "../src";

const c = new Backpack();

// Connections
const conns = await c.connections();
console.log(`=== Connections (${conns.length}) ===`);
for (const conn of conns) {
  console.log(`  ${conn.status === "connected" ? "●" : "○"} ${conn.appName} (${conn.appId})`);
  console.log(`    transport: ${conn.transportType}`);
  console.log(`    lastSync:  ${conn.lastSyncedAt ?? "never"}`);
  console.log(`    created:   ${conn.createdAt}`);
}

// Full status
console.log("\n=== Status ===");
const status = await c.status();
console.log(`Connections: ${status.connections.length}`);
console.log(`Apps: ${status.apps.length}`);
console.log(`Item breakdown:`);
for (const ic of status.items) {
  console.log(`  ${ic.source}/${ic.type}: ${ic.count}`);
}
const totalItems = status.items.reduce((sum, ic) => sum + ic.count, 0);
console.log(`Total items: ${totalItems}`);

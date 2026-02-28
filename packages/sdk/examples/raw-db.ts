import { Backpack } from "../src";
import { items } from "@backpack/db";
import { sql, desc } from "drizzle-orm";

const c = new Backpack();

// Use the raw drizzle instance for a custom query
const db = c.db;

// Top 5 most recent distinct dates with transaction counts
const result = await db
  .select({
    date: sql<string>`date(${items.timestamp} / 1000, 'unixepoch')`.as("date"),
    count: sql<number>`count(*)`.as("count"),
  })
  .from(items)
  .groupBy(sql`date(${items.timestamp} / 1000, 'unixepoch')`)
  .orderBy(desc(sql`date(${items.timestamp} / 1000, 'unixepoch')`))
  .limit(10);

console.log("=== Items per day (last 10 days with data) ===");
for (const row of result) {
  const bar = "█".repeat(Math.min(row.count, 40));
  console.log(`  ${row.date}  ${String(row.count).padStart(4)}  ${bar}`);
}

import { Command, Flags } from "@oclif/core";
import { getDatabase, timelineItems } from "@backpack/core";
import { inArray, gte, lte, and } from "drizzle-orm";
import { formatItem, formatItemJson } from "../utils/formatters.js";
import { parseDate } from "../utils/date.js";

export default class Timeline extends Command {
  static description = "View timeline of all items";

  static flags = {
    limit: Flags.integer({ char: "n", default: 50, description: "Number of items" }),
    source: Flags.string({
      char: "s",
      options: ["obsidian", "farcaster", "teller", "chrome", "brave", "safari", "manual"],
      multiple: true,
      description: "Filter by source",
    }),
    since: Flags.string({ description: "Show items since date (e.g., 1d, 1w, 2024-01-01)" }),
    until: Flags.string({ description: "Show items until date" }),
    json: Flags.boolean({ char: "j", description: "Output as JSON" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Timeline);
    const db = getDatabase();

    const conditions = [];
    if (flags.source?.length) {
      conditions.push(inArray(timelineItems.source, flags.source));
    }
    if (flags.since) {
      conditions.push(gte(timelineItems.timestamp, parseDate(flags.since)));
    }
    if (flags.until) {
      conditions.push(lte(timelineItems.timestamp, parseDate(flags.until)));
    }

    const items = await db.query.timelineItems.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: (items, { desc }) => [desc(items.timestamp)],
      limit: flags.limit,
    });

    if (flags.json) {
      this.log(JSON.stringify(items.map((i) => formatItemJson(i as unknown as Record<string, unknown>)), null, 2));
      return;
    }

    if (items.length === 0) {
      this.log("No items found.");
      return;
    }

    this.log(`Showing ${items.length} items:\n`);
    for (const item of items) {
      const row = item as { source: string; title?: string; content?: string; timestamp: number };
      this.log(formatItem(row));
      this.log("");
    }
  }
}

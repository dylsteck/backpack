import { Command, Flags, Args } from "@oclif/core";
import { getDatabase, timelineItems } from "@backpack/core";
import { eq, and } from "drizzle-orm";
import { formatItem, formatItemJson, formatHeader, colorSource } from "../utils/formatters.js";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const SOURCES = ["obsidian", "farcaster", "teller", "chrome", "brave", "safari", "manual"] as const;

export default class Items extends Command {
  static description = "List items with filtering by source";

  static args = {
    source: Args.string({
      required: true,
      options: SOURCES as unknown as string[],
      description: "Source to list items from",
    }),
  };

  static flags = {
    limit: Flags.integer({ char: "n", default: 25, description: "Number of items" }),
    type: Flags.string({ description: "Filter by item type" }),
    json: Flags.boolean({ char: "j", description: "Output as JSON" }),
    csv: Flags.boolean({ description: "Output as CSV" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Items);
    const db = getDatabase();

    const conditions = [eq(timelineItems.source, args.source)];
    if (flags.type) {
      conditions.push(eq(timelineItems.type, flags.type));
    }

    const items = await db.query.timelineItems.findMany({
      where: and(...conditions),
      orderBy: (items, { desc }) => [desc(items.timestamp)],
      limit: flags.limit,
    });

    if (flags.json) {
      this.log(JSON.stringify(items.map((i) => formatItemJson(i as unknown as Record<string, unknown>)), null, 2));
      return;
    }

    if (flags.csv) {
      this.log("id,source,type,title,timestamp,url");
      for (const item of items) {
        const row = item as { id: string; source: string; type: string; title?: string; timestamp: number; url?: string };
        const title = (row.title ?? "").replace(/"/g, '""');
        this.log(`${row.id},${row.source},${row.type},"${title}",${row.timestamp},${row.url ?? ""}`);
      }
      return;
    }

    if (items.length === 0) {
      this.log(formatHeader(`Items: ${args.source}`));
      this.log("");
      this.log(`  No items found for ${colorSource(args.source)}. Run \`backpack sync -s ${args.source}\` to fetch data.`);
      return;
    }

    this.log(formatHeader(`Items: ${args.source}`));
    this.log(`  ${DIM}${items.length} items${RESET}`);
    this.log("");
    for (const item of items) {
      const row = item as { source: string; title?: string; content?: string; timestamp: number };
      this.log(`  ${formatItem(row)}`);
    }
    this.log("");
  }
}

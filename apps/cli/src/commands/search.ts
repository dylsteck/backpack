import { Command, Flags, Args } from "@oclif/core";
import { getDatabase, search } from "@backpack/core";
import { formatItem } from "../utils/formatters.js";
import { parseDate } from "../utils/date.js";

export default class Search extends Command {
  static description = "Search timeline items (semantic + full-text)";

  static args = {
    query: Args.string({ required: true, description: "Search query" }),
  };

  static flags = {
    limit: Flags.integer({ char: "n", default: 20, description: "Max results" }),
    source: Flags.string({
      char: "s",
      options: ["obsidian", "farcaster", "teller", "chrome", "brave", "safari", "manual"],
      multiple: true,
      description: "Filter by source",
    }),
    since: Flags.string({ description: "Filter by start date" }),
    until: Flags.string({ description: "Filter by end date" }),
    semantic: Flags.boolean({ default: true, description: "Use semantic search" }),
    text: Flags.boolean({ description: "Use full-text search only" }),
    json: Flags.boolean({ char: "j", description: "Output as JSON" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Search);
    const db = getDatabase();

    if (!flags.json) {
      this.log(`Searching: "${args.query}"\n`);
    }

    const results = await search(db, {
      query: args.query,
      limit: flags.limit,
      useSemantic: flags.semantic && !flags.text,
      useFullText: flags.text || !flags.semantic,
      filters: {
        sources: flags.source?.length ? flags.source : undefined,
        startDate: flags.since ? parseDate(flags.since) : undefined,
        endDate: flags.until ? parseDate(flags.until) : undefined,
      },
    });

    if (flags.json) {
      this.log(
        JSON.stringify(
          {
            results: results.results.map((r) => ({
              item: r.item,
              score: r.score,
              matchType: r.matchType,
              highlights: r.highlights,
            })),
            total: results.total,
            query: results.query,
            durationMs: results.durationMs,
          },
          null,
          2
        )
      );
      return;
    }

    if (results.results.length === 0) {
      this.log("No results found.");
      return;
    }

    this.log(`Found ${results.results.length} results (${results.durationMs}ms):\n`);

    for (let i = 0; i < results.results.length; i++) {
      const r = results.results[i];
      const item = r.item as { source: string; title?: string; content?: string; timestamp: number };
      this.log(`${i + 1}. ${formatItem(item)}`);
      this.log(`   Score: ${(r.score * 100).toFixed(1)}% | Match: ${r.matchType}`);
      if (r.highlights?.length) {
        this.log(`   Highlights: ${r.highlights.join(" ... ")}`);
      }
      this.log("");
    }
  }
}

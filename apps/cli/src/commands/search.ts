import { Command, Flags, Args } from "@oclif/core";
import { getDatabase, search } from "@backpack/core";
import { formatItem, formatHeader, colorSource } from "../utils/formatters.js";
import { parseDate } from "../utils/date.js";

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";

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
      this.log(formatHeader("Search"));
      this.log(`  ${DIM}Query:${RESET} ${CYAN}"${args.query}"${RESET}\n`);
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
      this.log("  No results found. Try a different query or broaden your filters.");
      return;
    }

    this.log(`  ${DIM}${results.results.length} results (${results.durationMs}ms)${RESET}\n`);

    for (let i = 0; i < results.results.length; i++) {
      const r = results.results[i];
      const item = r.item as { source: string; title?: string; content?: string; timestamp: number };
      const score = `${YELLOW}${(r.score * 100).toFixed(0)}%${RESET}`;
      this.log(`  ${BOLD}${i + 1}.${RESET} ${formatItem(item)}`);
      this.log(`     ${score} ${DIM}${r.matchType}${RESET}`);
      if (r.highlights?.length) {
        this.log(`     ${DIM}${r.highlights.join(" ... ")}${RESET}`);
      }
      this.log("");
    }
  }
}

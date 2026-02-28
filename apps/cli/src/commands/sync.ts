import { Command, Flags } from "@oclif/core";
import { getDatabase, getConfig, initSyncers } from "@backpack/core";
import { formatHeader, formatSyncResult, formatSyncError } from "../utils/formatters.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";

export default class Sync extends Command {
  static description = "Sync data from all sources";

  static flags = {
    source: Flags.string({
      char: "s",
      options: ["obsidian", "farcaster", "teller", "chrome", "all"],
      default: "all",
      description: "Source to sync",
    }),
    daemon: Flags.boolean({ description: "Run as daemon (continuous sync)" }),
    interval: Flags.integer({ default: 300, description: "Sync interval in seconds (daemon mode)" }),
    json: Flags.boolean({ char: "j", description: "Output as JSON" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Sync);

    const db = getDatabase();
    const config = getConfig();
    const manager = initSyncers(db, config);

    if (flags.daemon) {
      this.log(`${DIM}Starting daemon (sync every ${flags.interval}s)...${RESET}`);
      this.log(`${DIM}Press Ctrl+C to stop${RESET}\n`);

      while (true) {
        await this.runOnce(manager, flags);
        this.log(`\n${DIM}Next sync in ${flags.interval}s...${RESET}\n`);
        await sleep(flags.interval * 1000);
      }
    }

    await this.runOnce(manager, flags);
  }

  private async runOnce(
    manager: Awaited<ReturnType<typeof initSyncers>>,
    flags: { source: string; json: boolean }
  ): Promise<void> {
    const sources = flags.source === "all" ? undefined : ([flags.source] as Parameters<typeof manager.syncAll>[0]["sources"]);

    if (!flags.json) {
      this.log(formatHeader("Sync"));
      this.log("");
    }

    const startTime = Date.now();
    const sourceStartTimes: Record<string, number> = {};

    const result = await manager.syncAll({
      sources,
      onProgress: (progress) => {
        if (!flags.json) {
          if (!sourceStartTimes[progress.source]) {
            sourceStartTimes[progress.source] = Date.now();
          }
        }
      },
    });

    const duration = Date.now() - startTime;

    if (flags.json) {
      this.log(
        JSON.stringify(
          {
            result: {
              overall: result.overall,
              sourceResults: result.sourceResults,
            },
            durationMs: duration,
          },
          null,
          2
        )
      );
    } else {
      for (const [source, progress] of Object.entries(result.sourceResults)) {
        if (progress) {
          const sourceDuration = sourceStartTimes[source]
            ? Date.now() - sourceStartTimes[source]
            : duration;
          this.log(formatSyncResult(source, progress.itemsAdded, progress.itemsUpdated, sourceDuration));
        }
      }
      this.log("");
      this.log(`  ${GREEN}✓${RESET} ${BOLD}Sync complete${RESET} ${DIM}(${(duration / 1000).toFixed(1)}s)${RESET}`);
    }
  }
}

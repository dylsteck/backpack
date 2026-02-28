import { Command, Flags } from "@oclif/core";
import { getDatabase, getConfig, initSyncers } from "@backpack/core";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      this.log(`Starting daemon (sync every ${flags.interval}s)...`);
      this.log("Press Ctrl+C to stop\n");

      while (true) {
        await this.runOnce(manager, flags);
        this.log(`\nNext sync in ${flags.interval}s...\n`);
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
      this.log("Starting sync...\n");
    }

    const startTime = Date.now();

    const result = await manager.syncAll({
      sources,
      onProgress: (progress) => {
        if (!flags.json) {
          this.log(`${progress.source}: ${progress.status} (${progress.itemsAdded} added)`);
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
      this.log(`\nSync complete in ${duration}ms`);
      this.log(`Overall: ${result.overall}`);
      for (const [source, progress] of Object.entries(result.sourceResults)) {
        if (progress) {
          this.log(`  ${source}: ${progress.itemsAdded} added, ${progress.itemsUpdated} updated`);
        }
      }
    }
  }
}

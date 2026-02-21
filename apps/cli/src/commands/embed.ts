import { Command, Flags } from "@oclif/core";
import { getDatabase, generateForNewItems, isQmdAvailable } from "@cortex/core";

export default class Embed extends Command {
  static description = "Generate embeddings for timeline items (requires QMD)";

  static flags = {
    setup: Flags.boolean({ description: "Setup QMD collection" }),
    json: Flags.boolean({ char: "j", description: "Output as JSON" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Embed);

    const available = await isQmdAvailable();
    if (!available) {
      this.error(
        "QMD not found. Install it first:\n  bun install -g qmd\n  # or: npm install -g qmd"
      );
    }

    if (flags.setup) {
      if (!flags.json) {
        this.log("QMD is available. Run 'cortex embed' to generate embeddings.");
      } else {
        this.log(JSON.stringify({ qmdAvailable: true }));
      }
      return;
    }

    const db = getDatabase();
    if (!flags.json) {
      this.log("Generating embeddings for new items...");
    }

    await generateForNewItems(db);

    if (!flags.json) {
      this.log("Done.");
    } else {
      this.log(JSON.stringify({ success: true }));
    }
  }
}

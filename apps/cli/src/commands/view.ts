import { Command, Flags, Args } from "@oclif/core";
import { getDatabase, timelineItems } from "@backpack/core";
import { eq } from "drizzle-orm";
import { spawn } from "child_process";

function showInPager(content: string): Promise<void> {
  const pager = process.env.PAGER || "less";
  const args = pager === "less" ? ["-R"] : [];

  return new Promise((resolve, reject) => {
    const proc = spawn(pager, args, {
      stdio: ["pipe", process.stdout, process.stderr],
    });
    proc.stdin.write(content);
    proc.stdin.end();
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Pager exited ${code}`))));
    proc.on("error", reject);
  });
}

function renderMarkdown(content: string): string {
  return content
    .replace(/^# (.*$)/gm, "\x1b[1m$1\x1b[0m")
    .replace(/^## (.*$)/gm, "\x1b[1m  $1\x1b[0m")
    .replace(/^### (.*$)/gm, "\x1b[1m\x1b[2m$1\x1b[0m")
    .replace(/\*\*(.*?)\*\*/g, "\x1b[1m$1\x1b[0m")
    .replace(/\*(.*?)\*/g, "\x1b[3m$1\x1b[0m")
    .replace(/`(.*?)`/g, "\x1b[36m$1\x1b[0m")
    .replace(/\[\[(.*?)\]\]/g, "\x1b[4m$1\x1b[0m");
}

export default class View extends Command {
  static description = "View full details of an item";

  static args = {
    id: Args.string({ required: true, description: "Item ID" }),
  };

  static flags = {
    json: Flags.boolean({ char: "j", description: "Output as JSON" }),
    raw: Flags.boolean({ description: "Show raw content without formatting" }),
    "no-pager": Flags.boolean({ description: "Disable pager" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(View);
    const db = getDatabase();

    const item = await db.query.timelineItems.findFirst({
      where: eq(timelineItems.id, args.id),
    });

    if (!item) {
      this.error(`Item not found: ${args.id}`);
    }

    const row = item as {
      id: string;
      source: string;
      type: string;
      title?: string;
      content?: string;
      rawData?: string;
      url?: string;
      timestamp: number;
      externalId?: string;
    };

    if (flags.json) {
      this.log(JSON.stringify(item, null, 2));
      return;
    }

    let output = "";
    if (flags.raw) {
      output = row.content || row.rawData || "No content";
    } else {
      output += "═".repeat(80) + "\n";
      output += `${row.title || "Untitled"}\n`;
      output += `${row.source} • ${new Date(row.timestamp).toLocaleString()}\n`;
      output += `ID: ${row.id}\n`;
      output += "═".repeat(80) + "\n\n";

      if (row.source === "obsidian" && row.content) {
        output += renderMarkdown(row.content);
      } else {
        output += row.content || "No content";
      }

      output += "\n\n" + "─".repeat(80) + "\n";
      output += `Type: ${row.type}\n`;
      output += `URL: ${row.url || "N/A"}\n`;
      output += `External ID: ${row.externalId || "N/A"}\n`;
    }

    if (flags["no-pager"] || !process.stdout.isTTY) {
      this.log(output);
    } else {
      await showInPager(output);
    }
  }
}

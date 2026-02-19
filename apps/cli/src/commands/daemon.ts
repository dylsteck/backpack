import { Command, Args, Flags } from "@oclif/core";
import { spawn } from "child_process";
import { readFile, writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

function getPidFile(): string {
  return join(tmpdir(), "cortex-daemon.pid");
}

async function getPid(): Promise<number | null> {
  try {
    const content = await readFile(getPidFile(), "utf8");
    return parseInt(content.trim(), 10);
  } catch {
    return null;
  }
}

async function writePid(pid: number): Promise<void> {
  await writeFile(getPidFile(), String(pid));
}

async function removePid(): Promise<void> {
  try {
    await unlink(getPidFile());
  } catch {
    // Ignore
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export default class Daemon extends Command {
  static description = "Manage the Cortex sync daemon";

  static args = {
    action: Args.string({
      required: true,
      options: ["start", "stop", "status", "restart"],
      description: "Action to perform",
    }),
  };

  static flags = {
    interval: Flags.integer({ default: 300, description: "Sync interval in seconds" }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Daemon);

    switch (args.action) {
      case "start":
        await this.start(flags.interval);
        break;
      case "stop":
        await this.stop();
        break;
      case "status":
        await this.status();
        break;
      case "restart":
        await this.stop();
        await this.start(flags.interval);
        break;
    }
  }

  private async start(interval: number = 300): Promise<void> {
    const pid = await getPid();
    if (pid && isProcessRunning(pid)) {
      this.log(`Daemon is already running (PID: ${pid})`);
      return;
    }

    this.log("Starting daemon...");

    const cliPath = process.argv[1] ?? join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "run.js");
    const child = spawn(process.execPath, [
      cliPath,
      "sync",
      "--daemon",
      "--interval",
      String(interval),
    ], {
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    if (child.pid) {
      await writePid(child.pid);
      this.log(`Daemon started (PID: ${child.pid})`);
      this.log(`Syncing every ${interval} seconds`);
    } else {
      this.error("Failed to start daemon");
    }
  }

  private async stop(): Promise<void> {
    const pid = await getPid();
    if (!pid) {
      this.log("Daemon is not running");
      return;
    }

    try {
      process.kill(pid, "SIGTERM");
      await removePid();
      this.log("Daemon stopped");
    } catch (error) {
      this.error(`Failed to stop daemon: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async status(): Promise<void> {
    const pid = await getPid();
    if (pid && isProcessRunning(pid)) {
      this.log(`Daemon is running (PID: ${pid})`);
    } else {
      this.log("Daemon is not running");
      if (pid) {
        await removePid();
      }
    }
  }
}

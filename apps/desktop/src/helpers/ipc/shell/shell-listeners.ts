import { ipcMain, shell } from "electron";
import { spawn } from "child_process";
import * as path from "path";
import { SHELL_OPEN_EXTERNAL_CHANNEL, SHELL_CHECK_CLI_INSTALLED, SHELL_INSTALL_CLI, SHELL_CHECK_QMD_INSTALLED, SHELL_INSTALL_QMD } from "./shell-channels";

export function addShellEventListeners() {
  ipcMain.handle(SHELL_OPEN_EXTERNAL_CHANNEL, async (_event, url: string) => {
    try {
      await shell.openExternal(url);
    } catch (error) {
      console.error("[Shell] Failed to open external URL:", error);
      throw error;
    }
  });

  // Check if Cortex CLI is installed
  ipcMain.handle(SHELL_CHECK_CLI_INSTALLED, async () => {
    return new Promise((resolve) => {
      const proc = spawn("cortex", ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });

      let stdout = "";
      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.on("close", (code) => {
        resolve({
          installed: code === 0,
          version: code === 0 ? stdout.trim() : undefined,
        });
      });

      proc.on("error", () => {
        resolve({ installed: false });
      });
    });
  });

  // Install Cortex CLI
  ipcMain.handle(SHELL_INSTALL_CLI, async () => {
    return new Promise((resolve) => {
      const cliPath = path.join(process.cwd(), "packages", "cli");
      
      // First build the CLI
      const buildProc = spawn("bun", ["run", "build"], {
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
        cwd: cliPath,
      });

      let buildStderr = "";
      buildProc.stderr.on("data", (data) => {
        buildStderr += data.toString();
      });

      buildProc.on("close", (buildCode) => {
        if (buildCode !== 0) {
          resolve({
            success: false,
            error: `Build failed: ${buildStderr}`,
          });
          return;
        }

        // Then link it globally
        const linkProc = spawn("bun", ["link"], {
          stdio: ["ignore", "pipe", "pipe"],
          shell: true,
          cwd: cliPath,
        });

        let linkStderr = "";
        linkProc.stderr.on("data", (data) => {
          linkStderr += data.toString();
        });

        linkProc.on("close", (linkCode) => {
          resolve({
            success: linkCode === 0,
            error: linkCode !== 0 ? linkStderr : undefined,
          });
        });

        linkProc.on("error", (err) => {
          resolve({
            success: false,
            error: err.message,
          });
        });
      });

      buildProc.on("error", (err) => {
        resolve({
          success: false,
          error: err.message,
        });
      });
    });
  });

  // Check if QMD is installed
  ipcMain.handle(SHELL_CHECK_QMD_INSTALLED, async () => {
    return new Promise((resolve) => {
      const proc = spawn("qmd", ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });

      let stdout = "";
      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.on("close", (code) => {
        resolve({
          installed: code === 0,
          version: code === 0 ? stdout.trim() : undefined,
        });
      });

      proc.on("error", () => {
        resolve({ installed: false });
      });
    });
  });

  // Install QMD
  ipcMain.handle(SHELL_INSTALL_QMD, async () => {
    return new Promise((resolve) => {
      const proc = spawn("bun", ["install", "-g", "https://github.com/tobi/qmd"], {
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });

      let stderr = "";
      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        resolve({
          success: code === 0,
          error: code !== 0 ? stderr : undefined,
        });
      });

      proc.on("error", (err) => {
        resolve({
          success: false,
          error: err.message,
        });
      });
    });
  });
}


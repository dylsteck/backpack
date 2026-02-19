import { Command } from "@oclif/core";
import { render } from "ink";
import React from "react";
import { getDatabase, getConfig } from "@cortex/core";
import { App } from "../tui/App.js";

export default class Tui extends Command {
  static description = "Launch interactive TUI";

  async run(): Promise<void> {
    const db = getDatabase();
    const config = getConfig();

    const { waitUntilExit } = render(
      React.createElement(App, { db, config }),
      { exitOnCtrlC: true }
    );

    await waitUntilExit();
  }
}

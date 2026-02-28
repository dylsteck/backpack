import { Command } from "@oclif/core";
import { render } from "ink";
import React from "react";
import { getDatabase, getConfig, setConfig, initSyncers } from "@backpack/core";
import { InitWizard } from "../tui/InitWizard.js";

export default class Init extends Command {
  static description = "Interactive setup wizard for Backpack";

  async run(): Promise<void> {
    const db = getDatabase();
    const config = getConfig();

    const { waitUntilExit } = render(
      React.createElement(InitWizard, { db, config }),
      { exitOnCtrlC: true }
    );

    await waitUntilExit();
  }
}

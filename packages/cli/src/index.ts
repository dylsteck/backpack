#!/usr/bin/env bun
import { Command } from "commander";
import { timelineCommand } from "./commands/timeline";
import { statusCommand } from "./commands/status";
import { connectionsCommand } from "./commands/connections";
import { getCommand } from "./commands/get";
import { itemsCommand } from "./commands/items";
import { syncCommand } from "./commands/sync";
import { searchCommand } from "./commands/search";
import { embedCommand } from "./commands/embed";

const program = new Command();

program
	.name("cortex")
	.description("CLI for interacting with Cortex - your personal data operating system")
	.version("0.1.0");

// Register all commands
program.addCommand(timelineCommand);
program.addCommand(statusCommand);
program.addCommand(connectionsCommand);
program.addCommand(getCommand);
program.addCommand(itemsCommand);
program.addCommand(syncCommand);
program.addCommand(searchCommand);
program.addCommand(embedCommand);

program.parse();

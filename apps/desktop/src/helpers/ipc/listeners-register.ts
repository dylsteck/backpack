import { BrowserWindow } from "electron";
import { addWindowEventListeners } from "./window/window-listeners";
import { addChromeEventListeners } from "./chrome/chrome-listeners";
import { addBraveEventListeners } from "./brave/brave-listeners";
import { addDatabaseEventListeners } from "./database/database-listeners";
import { addShellEventListeners } from "./shell/shell-listeners";
import { addObsidianEventListeners } from "./obsidian/obsidian-listeners";

export default function registerListeners(mainWindow: BrowserWindow) {
  addWindowEventListeners(mainWindow);
  addChromeEventListeners();
  addBraveEventListeners();
  addDatabaseEventListeners();
  addShellEventListeners();
  addObsidianEventListeners();
}

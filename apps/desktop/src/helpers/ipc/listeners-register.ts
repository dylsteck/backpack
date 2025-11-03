import { BrowserWindow } from "electron";
import { addThemeEventListeners } from "./theme/theme-listeners";
import { addWindowEventListeners } from "./window/window-listeners";
import { addChromeEventListeners } from "./chrome/chrome-listeners";
import { addBraveEventListeners } from "./brave/brave-listeners";

export default function registerListeners(mainWindow: BrowserWindow) {
  addWindowEventListeners(mainWindow);
  addThemeEventListeners();
  addChromeEventListeners();
  addBraveEventListeners();
}

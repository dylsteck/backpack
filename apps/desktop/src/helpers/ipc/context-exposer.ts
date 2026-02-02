import { exposeWindowContext } from "./window/window-context";
import { exposeChromeContext } from "./chrome/chrome-context";
import { exposeBraveContext } from "./brave/brave-context";
import { exposeDeepLinkContext } from "./deeplink/deeplink-context";
import { exposeServerContext } from "./server/server-context";
import { exposeDatabaseContext } from "./database/database-context";
import { exposeShellContext } from "./shell/shell-context";
import { exposeObsidianContext } from "./obsidian/obsidian-context";

export default function exposeContexts() {
  exposeWindowContext();
  exposeChromeContext();
  exposeBraveContext();
  exposeDeepLinkContext();
  exposeServerContext();
  exposeDatabaseContext();
  exposeShellContext();
  exposeObsidianContext();
}

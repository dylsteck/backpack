import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeChromeContext } from "./chrome/chrome-context";
import { exposeBraveContext } from "./brave/brave-context";
import { exposeDeepLinkContext } from "./deeplink/deeplink-context";

export default function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeChromeContext();
  exposeBraveContext();
  exposeDeepLinkContext();
}

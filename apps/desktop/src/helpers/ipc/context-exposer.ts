import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeChromeContext } from "./chrome/chrome-context";

export default function exposeContexts() {
  exposeWindowContext();
  exposeThemeContext();
  exposeChromeContext();
}

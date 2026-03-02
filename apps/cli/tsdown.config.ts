import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "bin/run": "bin/run.ts",
    "commands/config": "src/commands/config.ts",
    "commands/timeline": "src/commands/timeline.ts",
    "commands/items": "src/commands/items.ts",
    "commands/sync": "src/commands/sync.ts",
    "commands/search": "src/commands/search.ts",
    "commands/view": "src/commands/view.ts",
    "commands/daemon": "src/commands/daemon.ts",
    "commands/tui": "src/commands/tui.tsx",
    "commands/embed": "src/commands/embed.ts",
    "commands/serve": "src/commands/serve.ts",
    "commands/mcp": "src/commands/mcp.ts",
    "tui/App": "src/tui/App.tsx",
  },
  outDir: "./dist",
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
});

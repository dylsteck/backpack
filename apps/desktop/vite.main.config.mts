import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      external: [
        "better-sqlite3",
        "react",
        "react-dom",
        "scheduler",
        "@json-render/react",
        "@json-render/core",
      ],
    },
  },
});

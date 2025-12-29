import * as path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Vanilla TypeScript config - no React plugins needed
export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize for vanilla TS
    target: "chrome120",
    minify: "esbuild",
    sourcemap: true,
  },
  esbuild: {
    // Faster builds with esbuild
    target: "chrome120",
  },
});

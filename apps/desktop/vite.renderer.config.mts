import * as path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    tailwindcss(),
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "@radix-ui/react-use-callback-ref",
      "@radix-ui/react-use-effect-event",
      "@radix-ui/react-use-escape-keydown",
      "@radix-ui/react-use-size",
      "@radix-ui/react-collection",
      "@radix-ui/react-arrow",
      "@floating-ui/react-dom",
      "@floating-ui/dom",
      "@floating-ui/core",
      "@floating-ui/utils",
      "@tanstack/store",
      "seroval",
      "tslib",
      "use-callback-ref",
      "use-sidecar",
      "react-remove-scroll-bar",
      "react-style-singleton",
      "detect-node-es",
      "get-nonce",
      "void-elements",
    ],
  },
  optimizeDeps: {
    include: [
      "@radix-ui/react-use-callback-ref",
      "@radix-ui/react-use-effect-event",
      "@radix-ui/react-use-escape-keydown",
      "@radix-ui/react-use-size",
      "@radix-ui/react-collection",
      "@radix-ui/react-arrow",
      "@floating-ui/react-dom",
      "@floating-ui/dom",
      "@floating-ui/core",
      "@floating-ui/utils",
      "@tanstack/store",
      "seroval",
      "seroval-plugins/web",
      "tslib",
      "use-callback-ref",
      "use-sidecar",
      "react-remove-scroll-bar",
      "react-style-singleton",
      "detect-node-es",
      "get-nonce",
      "void-elements",
    ],
  },
});

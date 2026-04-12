/**
 * Default Vite config for tooling (e.g. shadcn CLI). Electron Forge builds the renderer via vite.renderer.config.mts.
 */
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss(), react()],
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
});

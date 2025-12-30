import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-config-prettier";
import path from "node:path";
import { includeIgnoreFile } from "@eslint/compat";
import { fileURLToPath } from "node:url";
import { defineConfig } from "eslint/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prettierIgnorePath = path.resolve(__dirname, ".prettierignore");

/** @type {import('eslint').Linter.Config[]} */
export default defineConfig([
  includeIgnoreFile(prettierIgnorePath),
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
  },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  eslintPluginPrettierRecommended,
  ...tseslint.configs.recommended,
]);

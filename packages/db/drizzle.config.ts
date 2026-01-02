import { defineConfig } from "drizzle-kit";
import path from "path";
import os from "os";

// Default database path for development
const defaultDbPath = path.join(os.homedir(), "Library", "Application Support", "Cortex", "cortex.db");

export default defineConfig({
	schema: "./src/schema",
	out: "./src/migrations",
	dialect: "sqlite",
	dbCredentials: {
		url: process.env.DATABASE_PATH || defaultDbPath,
	},
});

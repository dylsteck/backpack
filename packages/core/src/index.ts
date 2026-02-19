// Main exports for @cortex/core

// Database exports (schema re-exports removed to avoid conflicts)
export {
  getDatabase,
  closeDatabase,
  getDbPath,
  getDefaultDbPath,
  databaseExists,
  getDatabaseStats,
  executeRawQuery,
} from "./db/index.js";
export {
  timelineItems,
  sources,
  embeddings,
  timelineItemsRelations,
  sourcesRelations,
  embeddingsRelations,
  indexes,
} from "./db/schema.js";

// Types exports
export * from "./types/index.js";

// Config exports (selective to avoid conflicts with types)
export {
  getConfig,
  setConfig,
  resetConfig,
  initConfig,
  configExists,
  getConfigPath,
  getDefaultConfigDir,
  getSourceConfig,
  setSourceConfig,
} from "./config/index.js";
export {
  sourceTypeSchema,
  obsidianConfigSchema,
  farcasterConfigSchema,
  tellerConfigSchema,
  chromeConfigSchema,
  sourceConfigSchema,
  sourceEntrySchema,
  coreConfigSchema,
  partialConfigSchema,
  getDefaultConfig,
  validateConfig,
  validateConfigSafe,
} from "./config/schema.js";

// Auth exports
export * from "./auth/index.js";

// Sync exports
export * from "./sync/index.js";

// Re-export sync sources specifically
export { ObsidianSyncer } from "./sync/sources/obsidian.js";
export { initSyncers, createSyncersForSources } from "./sync/index.js";

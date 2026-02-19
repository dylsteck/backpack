import { z } from "zod";

/**
 * Source type definitions
 */
export const sourceTypeSchema = z.enum([
  "farcaster",
  "obsidian",
  "teller",
  "chrome",
  "brave",
  "safari",
  "manual",
]);

export type SourceType = z.infer<typeof sourceTypeSchema>;

/**
 * Source-specific configuration schemas
 */
export const obsidianConfigSchema = z.object({
  vaultPath: z.string(),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
});

export type ObsidianConfig = z.infer<typeof obsidianConfigSchema>;

export const farcasterConfigSchema = z.object({
  fid: z.number().optional(),
  signerUuid: z.string().optional(),
  username: z.string().optional(),
});

export type FarcasterConfig = z.infer<typeof farcasterConfigSchema>;

export const tellerConfigSchema = z.object({
  environment: z.enum(["sandbox", "production"]),
  accountIds: z.array(z.string()).optional(),
});

export type TellerConfig = z.infer<typeof tellerConfigSchema>;

export const chromeConfigSchema = z.object({
  profilePath: z.string().optional(),
});

export type ChromeConfig = z.infer<typeof chromeConfigSchema>;

/**
 * Union of all source configs
 */
export const sourceConfigSchema = z.union([
  obsidianConfigSchema,
  farcasterConfigSchema,
  tellerConfigSchema,
  chromeConfigSchema,
  z.record(z.string(), z.unknown()), // Fallback for any other config
]);

export type SourceConfig = z.infer<typeof sourceConfigSchema>;

/**
 * Individual source configuration with metadata
 */
export const sourceEntrySchema = z.object({
  type: sourceTypeSchema,
  enabled: z.boolean().default(true),
  config: sourceConfigSchema,
  lastSyncAt: z.number().optional(), // Unix timestamp
});

export type SourceEntry = z.infer<typeof sourceEntrySchema>;

/**
 * Core configuration schema
 */
export const coreConfigSchema = z.object({
  // Database
  databasePath: z.string().optional(),
  
  // Timeline settings
  defaultTimelineLimit: z.number().default(50),
  
  // Sync settings
  syncIntervalSeconds: z.number().default(300), // 5 minutes
  
  // Embedding settings
  embeddingModel: z.string().default("text-embedding-3-small"),
  
  // Sources configuration
  sources: z.record(z.string(), sourceEntrySchema).default({}),
  
  // Version for migrations
  version: z.string().default("1.0.0"),
});

export type CoreConfig = z.infer<typeof coreConfigSchema>;

/**
 * Default configuration
 */
export function getDefaultConfig(): CoreConfig {
  return {
    databasePath: undefined,
    defaultTimelineLimit: 50,
    syncIntervalSeconds: 300,
    embeddingModel: "text-embedding-3-small",
    sources: {},
    version: "1.0.0",
  };
}

/**
 * Validate a configuration object
 * @throws {z.ZodError} if validation fails
 */
export function validateConfig(config: unknown): CoreConfig {
  return coreConfigSchema.parse(config);
}

/**
 * Validate a configuration object, returning null on failure
 */
export function validateConfigSafe(config: unknown): CoreConfig | null {
  const result = coreConfigSchema.safeParse(config);
  return result.success ? result.data : null;
}

/**
 * Partial config for updates
 */
export const partialConfigSchema = coreConfigSchema.partial();
export type PartialConfig = z.infer<typeof partialConfigSchema>;

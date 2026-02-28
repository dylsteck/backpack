import fs from "fs";
import path from "path";
import os from "os";
import type {
  CoreConfig,
  PartialConfig,
  SourceType,
} from "./schema.js";
import {
  getDefaultConfig,
  validateConfig,
  validateConfigSafe,
} from "./schema.js";

// Re-export schema types
export * from "./schema.js";

/**
 * Get the default config directory based on OS
 */
export function getDefaultConfigDir(): string {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  switch (platform) {
    case "darwin":
      return path.join(homeDir, "Library", "Application Support", "backpack");
    case "linux":
      return path.join(homeDir, ".config", "backpack");
    case "win32":
      return path.join(homeDir, "AppData", "Roaming", "backpack");
    default:
      // Fallback to home directory
      return path.join(homeDir, ".backpack");
  }
}

/**
 * Get the full path to the config file
 */
export function getConfigPath(): string {
  const configDir = getDefaultConfigDir();
  return path.join(configDir, "config.json");
}

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
  const configDir = getDefaultConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

/**
 * Set file permissions to 0600 (user read/write only)
 * Only applicable on POSIX systems
 */
function setSecurePermissions(filePath: string): void {
  if (os.platform() !== "win32") {
    try {
      fs.chmodSync(filePath, 0o600);
    } catch {
      // Ignore permission errors on systems that don't support chmod
    }
  }
}

/**
 * Read config file
 * @returns Config object or null if file doesn't exist
 */
function readConfigFile(): CoreConfig | null {
  const configPath = getConfigPath();
  
  if (!fs.existsSync(configPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    return validateConfigSafe(parsed);
  } catch (error) {
    console.error("Failed to read config file:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Write config file atomically
 * Uses temp file + rename for atomicity
 */
function writeConfigFile(config: CoreConfig): void {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);
  const tempPath = path.join(configDir, `.config.json.tmp.${process.pid}`);
  
  try {
    // Write to temp file
    const content = JSON.stringify(config, null, 2);
    fs.writeFileSync(tempPath, content, "utf-8");
    
    // Set secure permissions
    setSecurePermissions(tempPath);
    
    // Atomic rename
    fs.renameSync(tempPath, configPath);
  } catch (error) {
    // Clean up temp file on error
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Deep merge two config objects
 */
function deepMerge(base: CoreConfig, partial: PartialConfig): CoreConfig {
  const merged: CoreConfig = {
    databasePath: partial.databasePath !== undefined ? partial.databasePath : base.databasePath,
    defaultTimelineLimit: partial.defaultTimelineLimit !== undefined ? partial.defaultTimelineLimit : base.defaultTimelineLimit,
    syncIntervalSeconds: partial.syncIntervalSeconds !== undefined ? partial.syncIntervalSeconds : base.syncIntervalSeconds,
    embeddingModel: partial.embeddingModel !== undefined ? partial.embeddingModel : base.embeddingModel,
    sources: partial.sources !== undefined 
      ? { ...base.sources, ...partial.sources }
      : base.sources,
    version: partial.version !== undefined ? partial.version : base.version,
  };
  
  return merged;
}

/**
 * Get current configuration
 * Returns merged config from file + defaults
 */
export function getConfig(): CoreConfig {
  const defaults = getDefaultConfig();
  const fileConfig = readConfigFile();
  
  if (!fileConfig) {
    return defaults;
  }
  
  return deepMerge(defaults, fileConfig);
}

/**
 * Set configuration values
 * Merges with existing config and writes to file
 */
export function setConfig(partialConfig: PartialConfig): CoreConfig {
  // Ensure config directory exists
  ensureConfigDir();
  
  // Get current config
  const currentConfig = getConfig();
  
  // Merge with new values
  const mergedConfig = deepMerge(currentConfig, partialConfig);
  
  // Validate
  const validatedConfig = validateConfig(mergedConfig);
  
  // Write to file
  writeConfigFile(validatedConfig);
  
  return validatedConfig;
}

/**
 * Reset configuration to defaults
 * Deletes the config file
 */
export function resetConfig(): CoreConfig {
  const configPath = getConfigPath();
  
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch (error) {
    console.error("Failed to reset config:", error instanceof Error ? error.message : error);
  }
  
  return getDefaultConfig();
}

/**
 * Initialize config with defaults if it doesn't exist
 */
export function initConfig(): CoreConfig {
  const configPath = getConfigPath();
  
  if (!fs.existsSync(configPath)) {
    ensureConfigDir();
    const defaults = getDefaultConfig();
    writeConfigFile(defaults);
    return defaults;
  }
  
  return getConfig();
}

/**
 * Check if config file exists
 */
export function configExists(): boolean {
  return fs.existsSync(getConfigPath());
}

/**
 * Get source configuration
 */
export function getSourceConfig<T = unknown>(sourceType: string): T | undefined {
  const config = getConfig();
  const source = config.sources[sourceType];
  return source?.config as T | undefined;
}

/**
 * Set source configuration
 */
export function setSourceConfig(sourceType: string, sourceConfig: { type: SourceType; enabled: boolean; config: Record<string, unknown> }): CoreConfig {
  const config = getConfig();
  
  const updatedConfig: PartialConfig = {
    sources: {
      ...config.sources,
      [sourceType]: sourceConfig,
    },
  };
  
  return setConfig(updatedConfig);
}

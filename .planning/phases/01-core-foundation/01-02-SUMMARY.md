---
phase: 01-core-foundation
plan: 01-02
subsystem: core
tags: [config, keychain, secrets, zod, validation]
dependencies:
  - 01-01
provides:
  - Config file management with OS-specific paths
  - Zod schema validation for config
  - OS keychain integration for secrets
  - Source-specific configuration types
key-files:
  created:
    - packages/core/src/config/schema.ts
    - packages/core/src/config/index.ts
    - packages/core/src/auth/keychain.ts
    - packages/core/src/auth/index.ts
  modified:
    - packages/core/src/index.ts
decisions:
  - Config stored in JSON at OS-appropriate location
  - Secrets stored in OS keychain (keytar), never in config files
  - Zod for runtime validation and type inference
  - Atomic config writes (temp file + rename)
  - File permissions 0600 on POSIX systems
  - Support for source-specific configs (Obsidian, Farcaster, Teller, Chrome)
metrics:
  duration: 25m
  completed: 2026-02-19
---

# Phase 01 Plan 02: Config & Keychain Summary

## Overview

Implemented configuration management and secure secret storage for Cortex. Config files are stored in OS-appropriate locations, while secrets are stored in the OS keychain (never in plaintext files).

## What Was Built

### Package Structure Updates

```
packages/core/src/
├── config/
│   ├── schema.ts     # Zod schemas and validation
│   └── index.ts      # Config file read/write
├── auth/
│   ├── keychain.ts   # OS keychain integration
│   └── index.ts      # Auth module exports
└── index.ts          # Updated exports
```

### Configuration System

**Config File Location by OS:**
- macOS: `~/Library/Application Support/cortex/config.json`
- Linux: `~/.config/cortex/config.json`
- Windows: `~/AppData/Roaming/cortex/config.json`

**Config Schema (CoreConfig):**
- `databasePath` - Optional database location override
- `defaultTimelineLimit` - Default items per page (default: 50)
- `syncIntervalSeconds` - Background sync frequency (default: 300)
- `embeddingModel` - Embedding model for search (default: text-embedding-3-small)
- `sources` - Source-specific configurations
- `version` - Config version for migrations

**Source Configurations:**
```typescript
ObsidianConfig: { vaultPath, includePatterns?, excludePatterns? }
FarcasterConfig: { fid?, signerUuid?, username? }
TellerConfig: { environment, accountIds? }
ChromeConfig: { profilePath? }
```

**Config Features:**
- Zod validation with helpful error messages
- Atomic writes (temp file + rename)
- File permissions 0600 (user read/write only)
- Deep merge for partial updates
- Reset to defaults

### Keychain Integration

**Secrets stored in OS keychain:**
- `openrouter-api-key` - OpenRouter API key
- `teller-access-token` - Teller banking access
- `farcaster-signer` - Farcaster signer private key
- `farcaster-fid` - Farcaster FID

**Keychain Features:**
- Uses `keytar` library (supports macOS Keychain, Windows Credential Manager, Linux libsecret)
- Convenience functions for each secret type
- Graceful error handling
- Service name: "cortex"

### API Surface

```typescript
// Config
export function getConfig(): CoreConfig
export function setConfig(partial: PartialConfig): CoreConfig
export function resetConfig(): CoreConfig
export function getConfigPath(): string
export function configExists(): boolean

// Schema types
export type CoreConfig, PartialConfig, SourceType
export type ObsidianConfig, FarcasterConfig, TellerConfig, ChromeConfig

// Keychain
export function getSecret(key: string): Promise<string | null>
export function setSecret(key: string, value: string): Promise<void>
export function deleteSecret(key: string): Promise<void>

// Convenience functions
export function getOpenRouterKey(): Promise<string | null>
export function setOpenRouterKey(key: string): Promise<void>
export function getTellerToken(): Promise<string | null>
export function setTellerToken(token: string): Promise<void>
export function getFarcasterSigner(): Promise<string | null>
export function setFarcasterSigner(signer: string): Promise<void>

// Well-known keys
export const SECRET_KEYS = {
  OPENROUTER_API_KEY: 'openrouter-api-key',
  TELLER_ACCESS_TOKEN: 'teller-access-token',
  FARCASTER_SIGNER: 'farcaster-signer',
  FARCASTER_FID: 'farcaster-fid',
}
```

## Testing

Config tests verified:
- ✓ OS-specific config paths
- ✓ Default config loading
- ✓ Config update with validation
- ✓ Atomic file writes
- ✓ Config read back correctly
- ✓ Reset functionality

Keychain tests verified:
- ✓ Secret storage
- ✓ Secret retrieval
- ✓ Secret deletion
- ✓ Confirmation of deletion

## Technical Decisions

1. **Zod for Validation**: Chose Zod over Joi/Yup for TypeScript-native type inference and smaller bundle size.

2. **Separate Secrets from Config**: Secrets NEVER go in config files. This is a security requirement - config files may be shared or committed accidentally.

3. **Atomic Writes**: Use temp file + rename pattern to prevent corruption if process crashes during write.

4. **keytar Library**: Handles cross-platform keychain differences internally. Supports macOS Keychain, Windows Credential Manager, and Linux libsecret.

5. **File Permissions**: Set 0600 on POSIX systems so only the owner can read config (contains paths, but no secrets).

## Usage Example

```typescript
import { 
  getConfig, 
  setConfig, 
  setOpenRouterKey,
  getOpenRouterKey 
} from '@cortex/core';

// Read config
const config = getConfig();
console.log(config.defaultTimelineLimit); // 50

// Update config
setConfig({
  databasePath: '/custom/path.db',
  sources: {
    obsidian: {
      type: 'obsidian',
      enabled: true,
      config: { vaultPath: '/Users/me/Obsidian' }
    }
  }
});

// Store secret (never in config!)
await setOpenRouterKey('sk-or-v1-...');

// Retrieve secret
const apiKey = await getOpenRouterKey();
```

## Next Steps

Wave 2 (Sync Engine) will build on this foundation:
- Plan 02-03: Obsidian sync implementation
- Plan 02-04: Farcaster sync implementation

These will use the config system for source settings and keychain for API credentials.

## Commits

- `63ccc69` - feat(01-02): implement config management and keychain integration

---
phase: 01-core-foundation
plan: 01-01
subsystem: core
tags: [database, sqlite, schema, drizzle]
dependencies: []
provides:
  - SQLite database layer with OS-specific paths
  - Schema for timeline_items, sources, embeddings
  - TypeScript type definitions
  - Database connection utilities
key-files:
  created:
    - packages/core/package.json
    - packages/core/tsconfig.json
    - packages/core/tsdown.config.ts
    - packages/core/src/index.ts
    - packages/core/src/db/index.ts
    - packages/core/src/db/schema.ts
    - packages/core/src/types/index.ts
  modified: []
decisions:
  - Use bun:sqlite instead of better-sqlite3 for Bun compatibility
  - WAL mode enabled by default for performance
  - OS-specific default paths (macOS: ~/Library/Application Support/cortex/)
  - Drizzle ORM for type-safe queries
  - Separate schema file with full index definitions
metrics:
  duration: 30m
  completed: 2026-02-19
---

# Phase 01 Plan 01: Database & Schema Summary

## Overview

Created the `@cortex/core` package as the foundation for the entire Cortex system. This package provides a shared SQLite database layer with type-safe schema definitions using Drizzle ORM.

## What Was Built

### Package Structure

```
packages/core/
├── package.json              # Package definition with dependencies
├── tsconfig.json             # TypeScript configuration
├── tsdown.config.ts          # Build configuration
└── src/
    ├── index.ts              # Main exports
    ├── db/
    │   ├── index.ts          # Database connection and utilities
    │   └── schema.ts         # Drizzle schema definitions
    └── types/
        └── index.ts          # TypeScript type definitions
```

### Database Schema

**timeline_items** - Stores all timeline items from various sources
- `id` (text PK) - UUID
- `source` (text) - farcaster, obsidian, teller, chrome, etc.
- `type` (text) - post, note, transaction, visit, etc.
- `external_id` (text) - ID from source system
- `title`, `content`, `url` - Content fields
- `raw_data` (text) - JSON string of full source data
- `timestamp`, `created_at`, `updated_at` - Timestamps
- `sync_status` (text) - pending, syncing, synced, error, skipped
- `error_message` (text) - Error details

**sources** - Source configurations and metadata
- `id` (text PK)
- `name`, `type` - Source identification
- `config` (text) - JSON configuration
- `last_sync_at` - Last successful sync
- `is_enabled` (integer) - Boolean flag

**embeddings** - Vector embeddings for semantic search (QMD)
- `id` (text PK)
- `item_id` (text FK) - References timeline_items
- `vector` (blob) - Binary embedding data
- `model` (text) - Embedding model used

### Key Features

1. **OS-Specific Default Paths**
   - macOS: `~/Library/Application Support/cortex/cortex.db`
   - Linux: `~/.local/share/cortex/cortex.db`
   - Windows: `~/AppData/Roaming/cortex/cortex.db`

2. **Configurable Paths** - `getDatabase(customPath?)` allows overriding defaults

3. **WAL Mode** - Write-Ahead Logging enabled for better concurrency

4. **Full Index Coverage** - Indexes on all query fields (source, type, timestamp, etc.)

5. **Type Safety** - Full TypeScript types matching schema exactly

### API Surface

```typescript
// Database
export function getDatabase(customPath?: string): BunSQLiteDatabase<typeof schema>
export function getDbPath(): string | null
export function closeDatabase(): void
export function databaseExists(customPath?: string): boolean
export function getDatabaseStats(): { timelineItems, sources, embeddings, dbSize }
export function executeRawQuery(query: string): { success, data?, error? }

// Schema (re-exported)
export { timelineItems, sources, embeddings, indexes }
export type { SourceType, ItemType, SyncStatus }
export type { TimelineItem, Source, Embedding, TimelineFilters, TimelineResult }
```

## Testing

Database connection verified:
- ✓ Initialize database at custom path
- ✓ Create database file
- ✓ Insert and query timeline items
- ✓ WAL mode enabled
- ✓ Stats reporting

## Technical Decisions

1. **Bun SQLite vs better-sqlite3**: Chose `bun:sqlite` because better-sqlite3 is not supported in Bun runtime. This maintains consistency with the existing packages/db implementation.

2. **WAL Mode**: Enabled for better read concurrency and performance. SQLite defaults to DELETE mode which locks the database during writes.

3. **Schema Initialization**: Tables and indexes are created on first connection via `initializeSchema()`, not through migrations. This simplifies the core package.

4. **Unix Timestamps**: Stored as integers (milliseconds) for cross-platform compatibility and easy sorting.

## Usage Example

```typescript
import { getDatabase, TimelineItem } from '@cortex/core';

// Use default OS path
const db = getDatabase();

// Or specify custom path
const db = getDatabase('/path/to/custom.db');

// Insert item
await db.insert(db._.fullSchema.timelineItems).values({
  id: crypto.randomUUID(),
  source: 'manual',
  type: 'note',
  title: 'My Note',
  content: 'Note content',
  timestamp: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  syncStatus: 'synced',
});

// Query items
const items = db.query.timelineItems.findMany({
  where: (table, { eq }) => eq(table.source, 'manual'),
});
```

## Next Steps

Plan 01-02 will build on this foundation to add:
- Configuration management (config file read/write)
- OS keychain integration for secrets
- Source-specific configuration types

## Commits

- `aa2fd2e` - feat(01-01): create core package with SQLite database and schema

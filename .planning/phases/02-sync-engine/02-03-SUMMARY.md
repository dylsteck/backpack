# Phase 02 Plan 03: Sync Engine Framework Summary

## Overview

Created a comprehensive sync engine framework that orchestrates data synchronization from multiple sources (Farcaster, Obsidian, Teller, Chrome) with progress tracking, error handling, and concurrency control.

**Status:** ✅ Complete  
**Duration:** 30 minutes  
**Commits:** 5cf2ebe  

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SyncManager                            │
│  - Orchestrates multiple syncers                            │
│  - Limits concurrency (default 3)                          │
│  - Aggregates results                                       │
│  - Triggers auto-embed                                      │
└────────────┬────────────────────────────────────────────────┘
             │
     ┌───────┴───────┐
     ▼               ▼
┌──────────┐   ┌──────────┐
│BaseSyncer│   │BaseSyncer│  ... (one per source)
│(abstract)│   │(abstract)│
└────┬─────┘   └────┬─────┘
     │              │
┌────▼─────┐   ┌────▼─────┐
│Obsidian  │   │Farcaster │  ... (concrete implementations)
│  Syncer  │   │  Syncer  │
└──────────┘   └──────────┘
```

## Files Created

### Core Sync Module

| File | Purpose | Exports |
|------|---------|---------|
| `packages/core/src/sync/types.ts` | Type definitions | `SyncStatus`, `SyncProgress`, `SyncOptions`, `SyncResult`, `SyncerInterface` |
| `packages/core/src/sync/base.ts` | Abstract base class | `BaseSyncer` |
| `packages/core/src/sync/manager.ts` | Orchestration | `SyncManager`, `createSyncManager` |
| `packages/core/src/sync/index.ts` | Module exports | All sync types and classes |

### Type System Updates

| File | Changes |
|------|---------|
| `packages/core/src/types/index.ts` | Renamed `SyncResult` → `LegacySyncResult`, `SyncStatus` → `ItemSyncStatus` |
| `packages/core/src/config/schema.ts` | Fixed `z.record()` usage |
| `packages/core/src/db/schema.ts` | Removed unused `one` variable |

## Key Features

### 1. Sync Status Tracking

```typescript
type SyncStatus = "idle" | "running" | "completed" | "failed" | "partial";

interface SyncProgress {
  source: SourceType;
  status: SyncStatus;
  itemsFound: number;
  itemsAdded: number;
  itemsUpdated: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}
```

### 2. BaseSyncer Abstract Class

All syncers extend `BaseSyncer` which provides:

- **Common interface**: `isConfigured()`, `sync()`, `validateConfig()`
- **Progress tracking**: Automatic counter updates
- **Database integration**: `saveItem()` with upsert logic
- **Error handling**: Try/catch wrapper with error collection
- **Last sync time**: Automatic `lastSyncAt` updates in DB

```typescript
export abstract class BaseSyncer {
  abstract readonly name: SourceType;
  
  abstract isConfigured(): Promise<boolean>;
  abstract validateConfig(): Promise<boolean>;
  protected abstract doSync(progress: SyncProgress): Promise<SyncProgress>;
  
  async sync(options?: SyncOptions): Promise<SyncProgress>;
  protected async saveItem(item: TimelineItem): Promise<void>;
}
```

### 3. SyncManager Orchestration

Manages multiple syncers with:

- **Registration**: `register(syncer)`, `unregister(source)`
- **Bulk sync**: `syncAll(options)` with concurrency limiting
- **Individual sync**: `syncSource(source, options)`
- **Status queries**: `isSourceConfigured()`, `getRegisteredSources()`
- **Auto-embed trigger**: Optional embedding generation after sync

```typescript
const manager = createSyncManager(db, {
  maxConcurrent: 3,
  autoEmbed: true
});

manager.register(obsidianSyncer);
manager.register(farcasterSyncer);

const result = await manager.syncAll({
  onProgress: (progress) => console.log(progress)
});
```

### 4. Concurrency Control

Syncs run with controlled concurrency to avoid:
- API rate limiting
- System overload
- Database lock contention

```typescript
// Process in batches of 3 (configurable)
for (let i = 0; i < sources.length; i += concurrencyLimit) {
  const batch = sources.slice(i, i + concurrencyLimit);
  await Promise.all(batch.map(source => syncSource(source)));
}
```

### 5. Error Handling

- Individual sync failures don't block other sources
- Errors captured in `SyncProgress.errors[]`
- Overall status: `completed` | `failed` | `partial`
- Failed syncs still update `lastSyncAt` when partially successful

## Implementation Guide

### Creating a New Syncer

```typescript
import { BaseSyncer } from "@cortex/core/sync";
import type { SyncProgress } from "@cortex/core/sync";

export class MySourceSyncer extends BaseSyncer {
  readonly name = "my-source" as SourceType;

  async isConfigured(): Promise<boolean> {
    // Check if required config exists
    return !!this.config?.apiKey;
  }

  async validateConfig(): Promise<boolean> {
    // Test connection, validate credentials
    try {
      await this.testConnection();
      return true;
    } catch {
      return false;
    }
  }

  protected async doSync(progress: SyncProgress): Promise<SyncProgress> {
    // Main sync implementation
    const items = await this.fetchItems();
    
    for (const item of items) {
      await this.saveItem({
        id: generateId(),
        source: this.name,
        type: "post",
        externalId: item.id,
        title: item.title,
        content: item.content,
        timestamp: new Date(item.createdAt),
        // ...
      });
      
      progress.itemsFound++;
    }
    
    return progress;
  }
}
```

### Registering Syncers

```typescript
import { createSyncManager } from "@cortex/core/sync";
import { ObsidianSyncer } from "@cortex/core/sync/sources";
import { getDatabase } from "@cortex/core/db";
import { getConfig } from "@cortex/core/config";

const db = getDatabase();
const config = getConfig();

const manager = createSyncManager(db);

// Register with config
const obsidianSyncer = new ObsidianSyncer(
  db,
  config.sources.obsidian?.config
);

manager.register(obsidianSyncer);

// Run sync
const result = await manager.syncAll();
console.log(`Synced ${result.totalDurationMs}ms`);
```

## Progress Callbacks

```typescript
await manager.syncAll({
  onProgress: (progress) => {
    console.log(`${progress.source}: ${progress.status}`);
    console.log(`  Items: ${progress.itemsAdded} added, ${progress.itemsUpdated} updated`);
    
    if (progress.errors.length > 0) {
      console.error(`  Errors: ${progress.errors.join(", ")}`);
    }
  }
});
```

## Sync Flow

```
1. Call syncAll(options)
   ↓
2. Check if already running (throw if so)
   ↓
3. Get configured sources
   ↓
4. For each batch (max 3 concurrent):
   ├─ Call syncer.sync()
   │  ├─ Check isConfigured()
   │  ├─ Create progress object
   │  ├─ Call doSync() [implemented by subclass]
   │  │  ├─ Fetch items
   │  │  ├─ For each item: saveItem()
   │  │  │  ├─ Check if exists (by external_id)
   │  │  │  ├─ Insert or update
   │  │  │  └─ Update counters
   │  │  └─ Return progress
   │  ├─ Update lastSyncAt in DB
   │  └─ Return final progress
   └─ Collect result
   ↓
5. Calculate overall status
   ↓
6. Trigger auto-embed (if enabled)
   ↓
7. Return SyncResult
```

## Decisions Made

1. **Abstract Class vs Interface**: Used `BaseSyncer` abstract class instead of just interface to provide common functionality (saveItem, progress tracking, error handling)

2. **Partial Failure Handling**: If one source fails, others continue. Overall status is `partial` if some succeed and some fail

3. **Upsert Logic**: `saveItem()` checks `external_id` to determine insert vs update, avoiding duplicates

4. **Concurrency Limit**: Default 3 concurrent syncs to balance speed with resource usage

5. **Database Coupling**: BaseSyncer receives database in constructor to ensure all syncers use same connection

## Technical Details

- **Type Safety**: Full TypeScript with strict null checks
- **Error Boundaries**: Each syncer runs in isolated try/catch
- **Memory Efficiency**: Streaming/batch processing for large datasets (implementation detail left to subclasses)
- **Atomic Operations**: Database operations use transactions where appropriate

## Next Steps

→ **Plan 02-04**: Implement ObsidianSyncer (concrete syncer example)
→ **Plan 03-05**: Farcaster sync with Neynar API
→ **Plan 03-06**: Teller banking sync
→ **Plan 03-07**: Chrome history sync

## Testing

To test the sync framework:

```typescript
// Test file: packages/core/test-sync-framework.ts
import { getDatabase } from "@cortex/core/db";
import { SyncManager, BaseSyncer } from "@cortex/core/sync";

// Create mock syncer
class MockSyncer extends BaseSyncer {
  readonly name = "mock" as SourceType;
  
  async isConfigured() { return true; }
  async validateConfig() { return true; }
  
  protected async doSync(progress) {
    // Simulate work
    progress.itemsFound = 10;
    progress.itemsAdded = 10;
    return progress;
  }
}

const db = getDatabase(":memory:");
const manager = new SyncManager(db);
manager.register(new MockSyncer(db));

const result = await manager.syncAll();
console.assert(result.overall === "completed");
```

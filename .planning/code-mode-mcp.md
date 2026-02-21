# Code Mode MCP Implementation Plan

## Overview

Refactor the Cortex MCP server to use Cloudflare's "Code Mode" pattern with just **2 tools** instead of 7+ direct tool definitions:

- **`search(code)`** - Write JavaScript to search/discover available SDK methods
- **`execute(code)`** - Write JavaScript to call SDK methods and chain operations

This reduces token usage from ~10KB+ to ~1-2KB and provides a cleaner, more flexible interface for LLM agents.

## Motivation

Cloudflare's [Code Mode](https://blog.cloudflare.com/code-mode-mcp/) approach solves context window bloat:
- Traditional MCP: Each tool adds schema to context (~1-5KB per tool)
- Code Mode: Fixed ~1-2KB regardless of API size
- LLMs are better at writing code than using tool-calling directly

## Architecture

### Before (Current)
```
MCP Server → 7+ tools (search_items, analyze_data, query_database, 
                              search_obsidian, read_obsidian, write_obsidian, get_schema)
```

### After (Code Mode)
```
MCP Server → 2 tools (search, execute)
                  ↓
            V8 Sandbox → Typed SDK → Database
```

## Implementation

### Phase 1: SDK Enhancement

Move all tool functionality into the SDK so raw SQL isn't needed:

- `packages/sdk/src/cortex.ts` - Core class (existing)
- `packages/sdk/src/obsidian.ts` - NEW: Obsidian operations
- `packages/sdk/src/browser.ts` - NEW: Browser history operations
- `packages/sdk/src/spec.ts` - NEW: Typed spec for discovery

### Phase 2: Code Mode Infrastructure

- `apps/server/src/mcp/sandbox.ts` - V8 isolate sandbox using Node.js `vm` module
- `apps/server/src/mcp/codemode.ts` - search() and execute() tools

### Phase 3: MCP Server Refactor

- `apps/server/src/routes/mcp-server.ts` - Replace tool definitions

## Sandbox Strategy

Use Node.js built-in `vm` module (V8 isolate):
- No external dependencies
- Runs on local machine
- Can restrict `fetch`, file system, etc.
- Fast startup (milliseconds)

## SDK Methods Available

```typescript
interface Cortex {
  // Timeline
  timeline(opts?: TimelineOptions): Promise<TimelineResult>
  
  // Items
  items(opts?: ItemsOptions): Promise<ItemsResult>
  get(id: string): Promise<Item | null>
  
  // Search
  search(query: string, opts?: SearchOptions): Promise<SearchResult>
  
  // Connections
  connections(): Promise<Connection[]>
  sync(appId?: string): Promise<SyncResult[]>
  status(): Promise<StatusResult>
  
  // Obsidian
  obsidian: ObsidianService
  
  // Browser
  browser: BrowserService
}
```

## Example Usage

### Discovering capabilities
```javascript
// search tool - find methods related to timeline
async () => {
  const results = [];
  for (const [name, method] of Object.entries(cortex)) {
    if (name.includes('timeline')) {
      results.push({ name, description: method.description });
    }
  }
  return results;
}
```

### Executing operations
```javascript
// execute tool - get recent timeline items
async () => {
  const result = await cortex.timeline({ limit: 10 });
  return result.items.map(i => ({ id: i.id, source: i.source }));
}
```

### Chaining operations
```javascript
// execute tool - search and get details
async () => {
  const search = await cortex.search("farcaster posts");
  if (search.results.length > 0) {
    const item = await cortex.get(search.results[0].id);
    return item;
  }
  return null;
}
```

## Testing

1. Start the server: `pnpm dev:server`
2. Connect MCP client
3. Test `search()` - discover timeline methods
4. Test `execute()` - call timeline(), items(), search()
5. Test chaining - search + get
6. Verify token usage is minimal

## Files

### Modified
- `packages/sdk/src/cortex.ts` - Add methods
- `apps/server/src/routes/mcp-server.ts` - Replace tools

### Created
- `packages/sdk/src/obsidian.ts`
- `packages/sdk/src/browser.ts`
- `packages/sdk/src/spec.ts`
- `apps/server/src/mcp/sandbox.ts`
- `apps/server/src/mcp/codemode.ts`

## Status

- [x] Planning complete
- [ ] Phase 1: SDK Enhancement
- [ ] Phase 2: Code Mode Infrastructure  
- [ ] Phase 3: MCP Server Refactor
- [ ] Testing
- [ ] Commit & Push

---

**Created:** 2026-02-21
**Author:** Claude (AI Assistant)

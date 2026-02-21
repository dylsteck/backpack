# Cortex - AI Agent Development Guide

> **A comprehensive guide for AI agents working with the Cortex monorepo**
> This document explains the codebase structure, architecture decisions, development workflows, and best practices for working effectively with Cortex.
>
> **Planning docs:** See `.planning/` for detailed plans ([WEB-DESKTOP-APPS.md](.planning/WEB-DESKTOP-APPS.md), [STATE.md](.planning/STATE.md), [code-mode-mcp.md](.planning/code-mode-mcp.md)).

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Tech Stack](#tech-stack)
4. [MCP Server (Code Mode)](#mcp-server)
5. [Development Workflow](#development-workflow)
6. [Build System](#build-system)
7. [Database & API](#database--api)
8. [Common Tasks](#common-tasks)
9. [Best Practices](#best-practices)
10. [Cortex CLI](#cortex-cli)
11. [Deploy to VM](#deploy-to-vm)
12. [Troubleshooting](#troubleshooting)

---

## Project Overview {#project-overview}

**Cortex** is a personal operating system that aggregates data from multiple sources (Farcaster, Obsidian, Chrome, Teller banking, etc.) into a unified timeline and interface. The goal is to provide a cohesive view of your digital life with AI-powered interactions.

**Key Features:**
- CLI-first with optional TUI
- Timeline view aggregating data from multiple sources
- Obsidian vault integration with markdown rendering
- Chat interface with AI (OpenRouter)
- Banking transactions via Teller API
- Browser history tracking (Chrome/Brave)
- Local-first SQLite database
- MCP Server with Code Mode for AI agents

**Architecture Philosophy:**
- **Performance First**: CLI-first, optional TUI
- **Type Safety**: End-to-end TypeScript with tRPC for API calls
- **Local-First**: SQLite database
- **Monorepo**: Shared types and business logic across apps

---

## Monorepo Structure {#monorepo-structure}

```
cortex/
├── apps/
│   ├── cli/           # CLI + TUI (Ink/React)
│   ├── server/        # API server (Elysia + Bun)
│   ├── web/           # SolidJS + Vite SPA
│   └── desktop/       # Tauri v2 wrapping shared web UI
├── packages/
│   ├── api/           # tRPC routers + @cortex/api/client
│   ├── core/          # Database, sync, search, config
│   ├── sdk/           # TypeScript SDK (@cortex/sdk)
│   ├── ui/            # Shared SolidJS components (web + desktop)
│   └── db/            # Drizzle ORM schema
├── turbo.json         # Turborepo configuration
├── package.json       # Root workspace configuration
└── README.md          # Project documentation
```

### Apps

#### `apps/cli/` - CLI + TUI

Command-line interface with optional Ink/React TUI. Primary way for AI agents to interact with Cortex data.

#### `apps/server/` - API Server

Backend server built with **Elysia** (Bun framework) providing tRPC endpoints and MCP Code Mode.

**Key Files:**
```
apps/server/
├── src/
│   ├── index.ts          # Server entry point
│   ├── mcp/              # MCP Code Mode
│   │   ├── codemode.ts  # search() and execute() tools
│   │   └── sandbox.ts   # V8 sandbox for code execution
│   └── routes/          # API routes (tRPC integration)
├── package.json
└── compile script        # Bun standalone binary compilation
```

**Compilation:**
- Server compiles to standalone binary: `bun run compile`
- Binary is embedded in desktop app as sidecar (opencode pattern)
- Use `HOST=0.0.0.0` for VM deployment (see [Deploy to VM](#deploy-to-vm))

#### `apps/web/` - Web App

SolidJS + Vite SPA. Routes: `/` (timeline), `/connections`, `/settings`. Shares 100% UI with desktop via `packages/ui`. Uses `@cortex/api/client` with `VITE_API_URL` (default `http://localhost:3000`).

#### `apps/desktop/` - Desktop App

Tauri v2 wrapping the same SolidJS UI as web. Optional server sidecar (opencode pattern). On startup, invokes `ensure_server_ready` (health check + spawn sidecar if needed) before rendering. Native folder picker for Obsidian vault via `pickFolder()`. OAuth (Teller) opens system browser via `openExternalUrl()`. **Prerequisites:** Rust (`rustup default stable`), Bun. **Build order:** `bun run build:web` → `cd apps/server && bun run compile` → `bun run build:desktop`.

### Packages

#### `packages/api/` - Shared API Layer

Contains tRPC routers and `@cortex/api/client` (browser-safe tRPC client).

**Purpose:**
- Define API contracts with full TypeScript types
- Share logic between web, desktop, and server
- tRPC provides end-to-end type safety

#### `packages/ui/` - Shared UI Components

SolidJS + Tailwind components used by both web and desktop. Layout, ServerGate, ConnectionCard, Timeline, Settings. **Platform utils:** `isTauri()`, `openExternalUrl(url)` (OAuth – system browser on desktop, navigate on web), `pickFolder()` (desktop-only native folder picker). ServerGate waits for server health before rendering; on desktop, calls Tauri `ensure_server_ready` first.

#### `packages/db/` - Database Layer

Database schema and migrations using **Drizzle ORM**. Server uses SQLite locally.

**Commands:**
```bash
bun run db:push        # Sync schema to database
bun run db:generate    # Generate migrations
bun run db:migrate     # Run migrations
bun run db:studio      # Open Drizzle Studio
```

---

## Tech Stack {#tech-stack}

### Web + Desktop (Shared UI)

| Layer | Technology | Why |
|-------|-----------|-----|
| **UI Framework** | SolidJS | Fine-grained reactivity, 7kb, no VDOM |
| **Bundler** | Vite | Fast HMR, Tauri-native |
| **Styling** | Tailwind CSS v4 | Utility-first |
| **Desktop** | Tauri v2 | Lightweight (~3–5MB vs Electron 200MB+) |
| **API Client** | @cortex/api/client | tRPC proxy, type-safe |

### Backend

| Layer | Technology | Why |
|-------|-----------|-----|
| **Runtime** | Bun | Fast, built-in TypeScript, standalone compilation |
| **Framework** | Elysia | Type-safe, high-performance, Bun-native |
| **API** | tRPC | End-to-end type safety, no code generation |
| **MCP** | Code Mode | Reduced token usage (~1-2KB vs ~10KB+) |
| **Sandbox** | Node.js vm | V8 isolate for safe code execution |
| **Database** | SQLite | Local-first, embedded |

### Monorepo

| Tool | Purpose |
|------|---------|
| **Turborepo** | Build orchestration, caching, parallel execution |
| **Bun** | Package manager, runtime, fast installs |
| **TypeScript 5.9** | Type safety across entire monorepo |
| **ESLint + Prettier** | Code quality and formatting |

---

## MCP Server (Code Mode) {#mcp-server}

Cortex exposes an MCP server using Cloudflare's "Code Mode" pattern - just 2 tools that let AI agents write JavaScript to discover and call SDK methods.

### Why Code Mode?

- **Token savings**: ~1-2KB instead of ~10KB+ for tool schemas
- **Flexibility**: Agents write code to query data, not rigid tool calls
- **Type safety**: Full SDK available in sandbox

### Available Tools

| Tool | Description |
|------|-------------|
| `search` | Write JavaScript to search the SDK spec |
| `execute` | Write JavaScript to call SDK methods |

### How It Works

The MCP server uses Node.js `vm` module (V8 isolate) to sandbox code execution:

```typescript
// apps/server/src/mcp/sandbox.ts
import vm from "node:vm";
import { Cortex, cortexSpec } from "@cortex/sdk";

const context = vm.createContext({
  cortex: new Cortex(),
  cortexSpec,  // Typed spec for discovery
  console: { log: (...args) => logs.push(args.join(' ')) }
});

const script = new vm.Script(wrappedCode);
const result = script.runInContext(context, { timeout: 30000 });
```

### Usage Examples

**Discover available methods:**
```javascript
// search tool
async () => {
  const results = [];
  for (const [name, method] of Object.entries(cortexSpec)) {
    if (name.includes('timeline')) {
      results.push({ name, description: method.description });
    }
  }
  return results;
}
```

**Get timeline items:**
```javascript
// execute tool
async () => {
  const timeline = await cortex.timeline({ limit: 10 });
  return timeline.items.map(i => ({ id: i.id, source: i.source }));
}
```

**Chain operations:**
```javascript
// execute tool - search then get details
async () => {
  const search = await cortex.search("farcaster posts");
  if (search.results.length > 0) {
    const item = await cortex.get(search.results[0].id);
    return item;
  }
  return null;
}
```

### SDK Methods

```typescript
const cortex = new Cortex();

// Timeline & Items
await cortex.timeline({ limit: 10, source: 'farcaster', cursor: '...' })
await cortex.items({ source: 'teller', type: 'transaction', limit: 100, all: true })
await cortex.get(itemId)

// Search
await cortex.search("query", { limit: 10, dbOnly: false })

// Connections & Sync
await cortex.connections()
await cortex.status()
await cortex.sync()           // Sync all
await cortex.sync('obsidian') // Sync specific app

// Obsidian
await cortex.obsidian.listNotes({ limit: 10, folder: 'Notes' })
await cortex.obsidian.readNote('note-title')
await cortex.obsidian.createNote('Title', '# Content', { tags: ['tag'], folder: 'Notes' })
await cortex.obsidian.updateNote('Title', 'new content', 'append')
await cortex.obsidian.addBacklink('Note', 'TargetNote')
await cortex.obsidian.search('query', { searchIn: 'content', limit: 10 })

// Browser (if available)
await cortex.browser.navigate('https://example.com')
await cortex.browser.click('1_11')
await cortex.browser.fill('2_5', 'text')
await cortex.browser.snapshot()
await cortex.browser.screenshot()
```

### Connecting AI Agents

```json
// Claude Desktop, Cursor, etc.
{
  "mcpServers": {
    "cortex": {
      "url": "http://localhost:3000/mcp/sse"
    }
  }
}
```

### Testing

```bash
# Start server
bun run dev:server

# Test health
curl http://localhost:3000/mcp/health

# List tools (should show 2)
curl -X POST http://localhost:3000/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Test search
curl -X POST http://localhost:3000/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search","arguments":{"code":"async () => { const results = []; for (const [name, method] of Object.entries(cortexSpec)) { if (name.includes('\''timeline'\'')) results.push({ name }); } return results; }"}}}'

# Test execute
curl -X POST http://localhost:3000/mcp/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"execute","arguments":{"code":"async () => { const r = await cortex.timeline({ limit: 3 }); return { count: r.count }; }"}}}'
```

---

## Development Workflow {#development-workflow}

### Initial Setup

```bash
# Clone repository
git clone <repo-url>
cd cortex

# Install dependencies
bun install

# Build
bun run build

# Create .env files (if needed)
# apps/server/.env
TELLER_APPLICATION_ID=app_xxxx
TELLER_ENVIRONMENT=sandbox
```

### Running in Development

```bash
# From root - runs everything in parallel
bun run dev

# Or run individually
bun run dev:server   # API server (hot reload with Bun)
bun run dev:cli     # CLI (hot reload)
bun run dev:web     # Web app (Vite, http://localhost:5173)
bun run dev:desktop # Tauri desktop (wraps web UI)
```

### Building

```bash
# Build all apps
bun run build

# Build web or desktop
bun run build:web
bun run build:desktop

# Compile server to standalone binary
cd apps/server
bun run compile  # Creates standalone `server` binary
```

### Type Checking

```bash
# Check types across all packages
bun run check-types
```

---

## Build System {#build-system}

### Turborepo Configuration

**`turbo.json`:**
```json
{
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],    // Build dependencies first
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true           // Keep running
    }
  }
}
```

**How it works:**
- Runs tasks in parallel when possible
- Caches outputs for unchanged code
- Respects dependency order (`^build` means "build dependencies first")
- `persistent: true` keeps dev servers running

---

## Database & API {#database--api}

### Database Schema

**Drizzle ORM** with **SQLite** (local-first). Schema in `packages/db/src/schema/`.

**Commands:**
```bash
bun run db:push        # Sync schema to database
bun run db:generate    # Generate migrations
bun run db:migrate     # Run migrations
bun run db:studio      # Open Drizzle Studio
```

### Server HTTP Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /`, `GET /mcp/health` | Health check |
| `POST /api/init-database` | Initialize DB after onboarding |
| `GET /api/database-status` | DB readiness |
| `ALL /trpc/*` | tRPC (timeline, apps, sync, teller, farcaster, chat, obsidian) |
| `GET /teller/connect` | Teller OAuth initiation |
| `POST /mcp/sse` | MCP Code Mode (JSON-RPC) |

### tRPC API

**Defining routers** (`packages/api/src/routers/timeline.ts`):

```typescript
import { router, publicProcedure } from '../trpc';
import { z } from 'zod';

export const timelineRouter = router({
  getTimeline: publicProcedure
    .input(z.object({ limit: z.number().default(25) }))
    .query(async ({ input, ctx }) => {
      const items = await ctx.db.query.timelineItems.findMany({
        limit: input.limit,
        orderBy: (items, { desc }) => [desc(items.timestamp)],
      });
      return items;
    }),
});
```

**Using in web/desktop:**

```typescript
import { createCortexClient } from "@cortex/api/client";

const client = createCortexClient("http://localhost:3000");
const timeline = await client.timeline.getTimeline.query({ limit: 25 });
// timeline is fully typed!
```

**Key procedures for web/desktop:** `apps.getAvailableServers`, `apps.connectObsidian`, `apps.removeConnection`, `timeline.getTimeline`, `sync.triggerSyncAll`.

---

## Common Tasks {#common-tasks}

### Running Database Migrations

```bash
# Generate migration from schema changes
cd packages/db
bun run db:generate

# Apply migrations
bun run db:migrate

# Or push directly (development)
bun run db:push
```

### Adding a tRPC Route

1. Define procedure in `packages/api/src/routers/<feature>.ts`
2. Add to root router in `packages/api/src/routers/index.ts`
3. Use via `api.<router>.<procedure>.query/mutate()`

---

## Best Practices {#best-practices}

### Error Handling

**Always handle errors:**
```typescript
try {
  const data = await api.fetchData.query();
  store.data.set(data);
} catch (error) {
  console.error('Failed to fetch data:', error);
  // Show user-friendly error message
}
```

---

## Cortex CLI {#cortex-cli}

The CLI is the recommended way for AI agents to interact with Cortex data. All commands support `--json` for machine-readable output.

### SDK Usage

```ts
import { Cortex } from "@cortex/sdk";

const cortex = new Cortex();
await cortex.status();
await cortex.timeline({ limit: 10 });
await cortex.search("query");
```

### Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `cortex search` | Hybrid search (QMD) | `cortex search "API docs" --json` |
| `cortex items` | Get items by source | `cortex items --source farcaster --json` |
| `cortex timeline` | Get timeline items | `cortex timeline --json --limit 50` |
| `cortex status` | Connection status | `cortex status --json` |
| `cortex sync` | Trigger data sync | `cortex sync all --json` |
| `cortex embed` | Update search index | `cortex embed --json` |
| `cortex get` | Get specific item | `cortex get <id> --json` |

### Agent Usage Examples

```bash
# Get all Farcaster posts as JSON
cortex items --source farcaster --json

# Get all Teller transactions
cortex items --source teller --json

# Search with semantic understanding
cortex search "what did I post about AI last week" --json

# Get paginated data
cortex items --source farcaster --limit 100 --json
# Use nextCursor from response for next page
cortex items --source farcaster --limit 100 --cursor "..." --json

# Export data as CSV
cortex items --source teller --csv > transactions.csv
```

### Search Setup (QMD)

For semantic search capabilities:

```bash
# Install QMD
bun install -g https://github.com/tobi/qmd

# Setup collections and context
cortex embed --setup

# Generate embeddings
cortex embed

# Now search works with semantic understanding
cortex search "quarterly planning discussions" --json
```

### MCP Integration

The MCP server uses **Code Mode** - just 2 tools (`search` and `execute`) that let agents write JavaScript code.

```json
// Claude Desktop, Cursor, etc.
{
  "mcpServers": {
    "cortex": {
      "url": "http://localhost:3000/mcp/sse"
    }
  }
}
```

Agents write code to discover and call SDK methods. See [MCP Server (Code Mode)](#mcp-server) section for details.

---

## Deploy to VM {#deploy-to-vm}

To run Cortex on a VM or remote server (inspired by [opencode](https://opencode.ai)):

```bash
# 1. Clone and build
git clone <repo> && cd cortex
bun install && bun run build

# 2. Compile server binary (optional – for no-Bun runtime)
cd apps/server && bun run compile

# 3. Run server (bind all interfaces for external access)
HOST=0.0.0.0 PORT=3000 ./server
# Or with Bun: HOST=0.0.0.0 bun run dev:server
```

**Environment variables:** `HOST` (default `127.0.0.1`), `PORT` (default `3000`), `CORS_ORIGIN` for web app origins. See [README.md](README.md#deploy-to-vm-self-host) for full details.

---

## Troubleshooting {#troubleshooting}

### Common Issues

**"Module not found" errors:**
```bash
# Clean install
rm -rf node_modules
bun install
```

**Type errors in IDE:**
```bash
# Restart TypeScript server
# VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"

# Check types manually
bun run check-types
```

**Database connection failed:**
```bash
# Check database file exists
ls ~/Library/Application\ Support/Cortex/

# Server auto-creates database on first run
# Just start the server and it will initialize
```

**Server won't start:**
```bash
# Check for port conflicts
lsof -i :3000

# Rebuild native modules if needed
cd apps/server
bun install
```

**Hot reload not working:**
```bash
# Restart dev server
bun run dev:server
```

---

## Additional Resources

- **MCP Server**: `apps/server/src/mcp/`
- **Code Mode Spec**: `packages/sdk/src/spec.ts`
- **API Client**: `packages/api/src/client.ts` (`@cortex/api/client`)
- **Shared UI**: `packages/ui/`
- **Planning docs**: `.planning/` – [WEB-DESKTOP-APPS.md](.planning/WEB-DESKTOP-APPS.md), [STATE.md](.planning/STATE.md), [code-mode-mcp.md](.planning/code-mode-mcp.md)
- **Elysia Docs**: https://elysiajs.com/
- **tRPC Docs**: https://trpc.io/docs
- **Bun Docs**: https://bun.sh/docs

---

**Last Updated:** February 2026
**Cortex Version:** 1.0.0

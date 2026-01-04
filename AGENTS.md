# Cortex - AI Agent Development Guide

> **A comprehensive guide for AI agents working with the Cortex monorepo**
> This document explains the codebase structure, architecture decisions, development workflows, and best practices for working effectively with Cortex.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Tech Stack](#tech-stack)
4. [Desktop App Architecture](#desktop-app-architecture)
5. [Development Workflow](#development-workflow)
6. [Build System](#build-system)
7. [Database & API](#database--api)
8. [Common Tasks](#common-tasks)
9. [Best Practices](#best-practices)
10. [Performance Considerations](#performance-considerations)
11. [Troubleshooting](#troubleshooting)

---

## Project Overview {#project-overview}

**Cortex** is a personal operating system that aggregates data from multiple sources (Farcaster, Obsidian, Chrome, Teller banking, etc.) into a unified timeline and interface. The goal is to provide a cohesive view of your digital life with AI-powered interactions.

**Key Features:**
- Timeline view aggregating data from multiple sources
- Obsidian vault integration with markdown rendering
- Chat interface with AI (OpenRouter)
- Banking transactions via Teller API
- Browser history tracking (Chrome/Brave)
- Local-first SQLite database
- Dark/light theme support

**Architecture Philosophy:**
- **Performance First**: No React in desktop app - vanilla TypeScript for maximum speed
- **Type Safety**: End-to-end TypeScript with tRPC for API calls
- **Local-First**: SQLite database with optional server sync
- **Monorepo**: Shared types and business logic across apps

---

## Monorepo Structure {#monorepo-structure}

```
cortex/
├── apps/
│   ├── desktop/          # Electron desktop application (main focus)
│   └── server/           # API server (Elysia + Bun)
├── packages/
│   ├── api/              # Shared tRPC routers and business logic
│   ├── auth/             # Authentication (Better-Auth)
│   └── db/               # Database schema and migrations (Drizzle ORM)
├── turbo.json           # Turborepo configuration
├── package.json         # Root workspace configuration
└── README.md           # Project documentation
```

### Apps

#### `apps/desktop/` - Electron Desktop App

The primary application where users interact with Cortex. Built with **vanilla TypeScript** (no React) for maximum performance.

**Key Directories:**
```
apps/desktop/
├── src/
│   ├── main/                    # Electron main process (Node.js)
│   │   ├── index.ts             # Main entry, window management
│   │   └── ipc/                 # IPC handlers for renderer communication
│   ├── renderer/                # Electron renderer process (Browser)
│   │   ├── components/          # UI components (vanilla TS)
│   │   │   ├── Component.ts     # Base component class with lifecycle
│   │   │   ├── Layout.ts        # Main app layout with sidebar
│   │   │   ├── Timeline.ts      # Timeline/overview views (CRITICAL)
│   │   │   ├── DetailModal.ts   # Full-screen item detail modal
│   │   │   ├── Chat.ts          # AI chat interface
│   │   │   ├── Sidebar.ts       # Left navigation sidebar
│   │   │   ├── AppsGrid.ts      # App connections grid
│   │   │   └── AppDetail.ts     # Individual app settings
│   │   ├── store.ts             # Global state with Observable pattern
│   │   ├── api.ts               # API client (tRPC + IPC)
│   │   ├── types.ts             # TypeScript type definitions
│   │   └── utils/               # Utility functions
│   │       ├── dom.ts           # DOM manipulation helpers
│   │       └── markdown.ts      # Markdown parsing (marked.js + Obsidian support)
│   ├── styles/
│   │   └── global.css           # Tailwind CSS with custom design system
│   ├── helpers/                 # Electron helper modules
│   │   └── ipc/                 # IPC channel definitions and context bridges
│   └── index.html               # Main HTML file
├── esbuild.config.mjs          # Build configuration (esbuild)
├── electron-performance-guide.md  # Performance best practices
├── package.json
└── forge.config.ts             # Electron Forge configuration
```

**Why Vanilla TypeScript?**
- 3-4x faster startup (100-250ms vs 350-900ms with React)
- 2-3x less memory usage (150-300MB vs 400-700MB)
- Full control over rendering and performance
- See `apps/desktop/electron-performance-guide.md` for detailed rationale

#### `apps/server/` - API Server

Backend server built with **Elysia** (Bun framework) providing tRPC endpoints.

**Key Files:**
```
apps/server/
├── src/
│   ├── index.ts          # Server entry point
│   ├── routes/           # API routes (tRPC integration)
│   ├── tools/            # MCP tools (Obsidian, etc.)
│   └── lib/              # Server utilities
├── package.json
└── compile script        # Bun standalone binary compilation
```

**Compilation:**
- Server compiles to standalone binary: `bun run --compile src/index.ts`
- Binary is embedded in desktop app for offline functionality
- No external dependencies needed at runtime

### Packages

#### `packages/api/` - Shared API Layer

Contains tRPC routers and shared business logic used by both desktop and server.

**Structure:**
```
packages/api/
├── src/
│   ├── index.ts          # Main export
│   ├── router/           # tRPC router definitions
│   └── procedures/       # Shared procedures/logic
└── package.json
```

**Purpose:**
- Define API contracts with full TypeScript types
- Share logic between desktop and server
- tRPC provides end-to-end type safety

#### `packages/db/` - Database Layer

Database schema and migrations using **Drizzle ORM** with **PostgreSQL**.

**Structure:**
```
packages/db/
├── src/
│   ├── index.ts          # Database client export
│   ├── schema/           # Drizzle schema definitions
│   └── migrations/       # Database migrations
├── drizzle.config.ts     # Drizzle configuration
└── package.json
```

**Database:**
- **Development**: PostgreSQL (local or cloud)
- **Desktop Local**: SQLite (`better-sqlite3`)
- Schema synced via Drizzle migrations
- Run `pnpm db:push` to sync schema changes

#### `packages/auth/` - Authentication

Authentication logic using **Better-Auth**.

---

## Tech Stack {#tech-stack}

### Desktop App

| Layer | Technology | Why |
|-------|-----------|-----|
| **UI Framework** | Vanilla TypeScript | Maximum performance, no framework overhead |
| **Styling** | Tailwind CSS v4.1 | Utility-first, custom design system |
| **Desktop** | Electron 38.3 | Cross-platform, Node.js + Chromium |
| **Bundler** | esbuild | 100x faster than Webpack, simple config |
| **State** | Custom Observable | Lightweight (~100 lines), reactive |
| **Markdown** | marked.js + highlight.js + DOMPurify | Fast, secure, Obsidian-compatible |
| **Database** | better-sqlite3 | Embedded, serverless, fast |

### Backend

| Layer | Technology | Why |
|-------|-----------|-----|
| **Runtime** | Bun | Fast, built-in TypeScript, standalone compilation |
| **Framework** | Elysia | Type-safe, high-performance, Bun-native |
| **API** | tRPC | End-to-end type safety, no code generation |
| **ORM** | Drizzle | Type-safe SQL, lightweight, PostgreSQL |
| **Auth** | Better-Auth | Modern, flexible, TypeScript-first |

### Monorepo

| Tool | Purpose |
|------|---------|
| **Turborepo** | Build orchestration, caching, parallel execution |
| **Bun** | Package manager, runtime, fast installs |
| **TypeScript 5.9** | Type safety across entire monorepo |
| **ESLint + Prettier** | Code quality and formatting |

---

## Desktop App Architecture {#desktop-app-architecture}

### Component Pattern

**Base Component Class** (`src/renderer/components/Component.ts`):

```typescript
export abstract class Component {
  protected container: HTMLElement;
  private listeners: Array<() => void> = [];
  private subscriptions: Array<() => void> = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  abstract init(): Promise<void> | void;
  abstract render(): void;

  // Automatic cleanup management
  protected addListener(
    element: HTMLElement,
    event: string,
    handler: EventListener
  ): void {
    element.addEventListener(event, handler);
    this.listeners.push(() => element.removeEventListener(event, handler));
  }

  protected subscribe<T>(
    observable: Observable<T>,
    handler: (value: T) => void
  ): void {
    const unsubscribe = observable.subscribe(handler);
    this.subscriptions.push(unsubscribe);
  }

  // Called when component is destroyed
  destroy(): void {
    this.listeners.forEach(cleanup => cleanup());
    this.subscriptions.forEach(unsub => unsub());
    this.listeners = [];
    this.subscriptions = [];
  }
}
```

**Usage:**
```typescript
export class Timeline extends Component {
  async init(): Promise<void> {
    this.render();
    this.setupEventDelegation();
    await this.loadData();

    // Auto-cleanup subscriptions
    this.subscribe(store.timelineItems, () => this.renderItems());
  }

  render(): void {
    // Create DOM elements
    this.container.innerHTML = '';
    // ...
  }

  private setupEventDelegation(): void {
    const container = document.getElementById('items');
    // Single listener for all items (event delegation)
    this.addListener(container, 'click', (e) => {
      const item = e.target.closest('[data-item-id]');
      if (item) this.handleItemClick(item);
    });
  }
}
```

### State Management

**Observable Pattern** (`src/renderer/store.ts`):

```typescript
class Observable<T> {
  private value: T;
  private listeners = new Set<(value: T) => void>();

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  get(): T {
    return this.value;
  }

  set(newValue: T): void {
    if (this.value === newValue) return;
    this.value = newValue;
    this.listeners.forEach(fn => fn(newValue));
  }

  subscribe(fn: (value: T) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

// Global store
export const store = {
  timelineItems: new Observable<TimelineItem[]>([]),
  selectedSources: new Observable<SourceType[]>(['all']),
  darkMode: new Observable(false),
  // ...
};

export const actions = {
  appendTimelineItems(items: TimelineItem[]) {
    const current = store.timelineItems.get();
    store.timelineItems.set([...current, ...items]);
  },
  // ...
};
```

### IPC Communication

**Main → Renderer:**

```typescript
// Main process (src/main/index.ts)
ipcMain.handle('api:fetchTimeline', async (event, limit) => {
  const result = await fetchFromServer(limit);
  return result;
});

// Preload script (contextBridge)
contextBridge.exposeInMainWorld('api', {
  fetchTimeline: (limit: number) => ipcRenderer.invoke('api:fetchTimeline', limit)
});

// Renderer (src/renderer/api.ts)
export async function fetchTimeline(limit: number) {
  return window.api.fetchTimeline(limit);
}
```

### Event Delegation

**Don't do this:**
```typescript
// BAD: N listeners for N items
items.forEach(item => {
  const el = document.createElement('div');
  el.addEventListener('click', () => handleClick(item)); // Memory leak!
  container.appendChild(el);
});
```

**Do this:**
```typescript
// GOOD: Single listener on parent
container.addEventListener('click', (e) => {
  const itemEl = e.target.closest('[data-item-id]');
  if (!itemEl) return;

  const itemId = itemEl.dataset.itemId;
  const item = itemsMap.get(itemId);
  handleClick(item);
});

// Batch DOM updates
const fragment = document.createDocumentFragment();
items.forEach(item => {
  const el = document.createElement('div');
  el.dataset.itemId = item.id;
  el.textContent = item.name;
  fragment.appendChild(el);
});
container.appendChild(fragment); // Single reflow
```

### Markdown Rendering

**Obsidian Integration:**

The app supports Obsidian markdown with:
- `[[wikilinks]]` - Clickable internal links
- `#tags` - Clickable tag filters
- `> [!note]` - Callouts (note, tip, warning, danger, info)
- Syntax highlighting for code blocks
- Tables, lists, headings, etc.

**Usage:**
```typescript
import { parseMarkdown, isMarkdown, setupMarkdownInteractivity } from '../utils/markdown';

// Check if content is markdown
if (item.type === 'obsidian-note' && isMarkdown(text)) {
  const wrapper = createElement('div', { className: 'markdown-content' });
  wrapper.innerHTML = parseMarkdown(text);
  setupMarkdownInteractivity(wrapper); // Enable wikilinks/tags
  return wrapper;
}
```

---

## Development Workflow {#development-workflow}

### Initial Setup

```bash
# Clone repository
git clone <repo-url>
cd cortex

# Install dependencies
bun install  # or pnpm install

# Setup database
cd packages/db
bun run db:push  # Sync schema to PostgreSQL

# Create .env files
# apps/server/.env
DATABASE_URL=postgresql://user:password@localhost:5432/cortex
TELLER_APPLICATION_ID=app_xxxx
TELLER_ENVIRONMENT=sandbox

# apps/desktop/.env
VITE_API_URL=http://localhost:3000
```

### Running in Development

```bash
# From root - runs everything in parallel
pnpm dev

# Or run individually
pnpm dev:desktop  # Electron app (hot reload)
pnpm dev:server   # API server (hot reload with Bun)

# Database studio
pnpm db:studio  # Drizzle Studio at http://localhost:4983
```

### Building

```bash
# Build all apps
pnpm build

# Build desktop app (esbuild)
cd apps/desktop
pnpm build:vanilla

# Build and compile server to binary
cd apps/server
bun run compile  # Creates standalone `server` binary
```

### Type Checking

```bash
# Check types across all packages
pnpm check-types

# Watch mode
pnpm check-types --watch
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

### esbuild Configuration

**`apps/desktop/esbuild.config.mjs`:**

```javascript
import * as esbuild from 'esbuild';

// Renderer process
await esbuild.build({
  entryPoints: ['src/renderer/index.ts'],
  bundle: true,
  platform: 'browser',
  target: ['chrome120'],
  outfile: 'dist/renderer.js',
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
});

// Main process
await esbuild.build({
  entryPoints: ['src/main/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/main.js',
  external: ['electron'],
  sourcemap: true,
});
```

**Why esbuild:**
- 100x faster than Webpack (0.37s vs 42s for large bundles)
- No configuration needed for most use cases
- Built-in TypeScript support
- Tree-shaking by default

---

## Database & API {#database--api}

### Database Schema

**Drizzle ORM** with **PostgreSQL** (production) and **SQLite** (desktop local).

**Example schema** (`packages/db/src/schema/timeline.ts`):

```typescript
import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const timelineItems = pgTable('timeline_items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  source: text('source').notNull(),
  type: text('type').notNull(),
  data: jsonb('data'),
  timestamp: timestamp('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**Commands:**
```bash
pnpm db:push        # Sync schema to database
pnpm db:generate    # Generate migrations
pnpm db:migrate     # Run migrations
pnpm db:studio      # Open Drizzle Studio
```

### tRPC API

**Defining routers** (`packages/api/src/router/timeline.ts`):

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

**Using in desktop app:**

```typescript
import { api } from './api';

// Type-safe API call
const timeline = await api.timeline.getTimeline.query({ limit: 25 });
// timeline is fully typed!
```

---

## Common Tasks {#common-tasks}

### Adding a New Component

1. Create component file in `apps/desktop/src/renderer/components/`
2. Extend `Component` base class
3. Implement `init()` and `render()` methods
4. Use event delegation and cleanup

```typescript
import { Component } from './Component';
import { createElement } from '../utils/dom';

export class MyComponent extends Component {
  async init(): Promise<void> {
    this.render();
    this.setupListeners();
  }

  render(): void {
    this.container.innerHTML = '';
    const content = createElement('div', { className: 'p-4' });
    content.textContent = 'Hello World';
    this.container.appendChild(content);
  }

  private setupListeners(): void {
    this.addListener(this.container, 'click', () => {
      console.log('Clicked!');
    });
  }
}
```

### Adding a Data Source

1. Create IPC handlers in `apps/desktop/src/helpers/ipc/<source>/`
2. Add context bridge in preload
3. Create types in `src/renderer/types.ts`
4. Add to store in `src/renderer/store.ts`
5. Integrate into Timeline component

### Running Database Migrations

```bash
# Generate migration from schema changes
cd packages/db
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Or push directly (development)
pnpm db:push
```

### Adding a tRPC Route

1. Define procedure in `packages/api/src/router/<feature>.ts`
2. Add to root router in `packages/api/src/index.ts`
3. Use in desktop app via `api.<router>.<procedure>.query/mutate()`

---

## Best Practices {#best-practices}

### Component Lifecycle

**Always cleanup:**
```typescript
// Good
class MyComponent extends Component {
  private intervalId?: number;

  init() {
    this.intervalId = setInterval(() => this.refresh(), 1000);
    this.registerCleanup(() => clearInterval(this.intervalId));
  }
}

// Bad - memory leak
class BadComponent {
  init() {
    setInterval(() => this.refresh(), 1000); // Never cleaned up!
  }
}
```

### DOM Manipulation

**Batch updates:**
```typescript
// Good
const fragment = document.createDocumentFragment();
items.forEach(item => {
  const el = createElement('div', { textContent: item.name });
  fragment.appendChild(el);
});
container.appendChild(fragment); // One reflow

// Bad
items.forEach(item => {
  const el = createElement('div', { textContent: item.name });
  container.appendChild(el); // N reflows!
});
```

### State Updates

**Immutable updates:**
```typescript
// Good
const newItems = [...store.items.get(), newItem];
store.items.set(newItems);

// Bad
const items = store.items.get();
items.push(newItem); // Mutates array, no update triggered
```

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

## Performance Considerations {#performance-considerations}

See **`apps/desktop/electron-performance-guide.md`** for comprehensive performance documentation.

**Key Points:**
- Use event delegation (1 listener vs N listeners)
- Virtual scrolling for lists >100 items
- Debounce expensive operations
- Avoid layout thrashing (batch reads, then writes)
- Profile with Chrome DevTools

**Performance Targets:**
- Cold start: <200ms
- First paint: <100ms
- Frame rate: 60fps (16ms per frame)
- Memory base: <250MB

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
pnpm check-types
```

**Database connection failed:**
```bash
# Check PostgreSQL is running
pg_isready

# Verify DATABASE_URL in apps/server/.env
echo $DATABASE_URL

# Push schema
cd packages/db
pnpm db:push
```

**Electron won't start:**
```bash
# Rebuild native modules
cd apps/desktop
pnpm rebuild

# Check for port conflicts
lsof -i :3000  # API server port
```

**Hot reload not working:**
```bash
# Restart dev server
pnpm dev:desktop

# Check esbuild watch mode is active
ps aux | grep esbuild
```

---

## Additional Resources

- **Performance Guide**: `apps/desktop/electron-performance-guide.md`
- **Electron Docs**: https://www.electronjs.org/docs/latest/
- **tRPC Docs**: https://trpc.io/docs
- **Drizzle Docs**: https://orm.drizzle.team/docs/overview
- **Bun Docs**: https://bun.sh/docs

---

**Last Updated:** January 2025
**Cortex Version:** 1.0.0

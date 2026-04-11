# Backpack

A personal operating system that aggregates data from multiple sources (Farcaster, Obsidian, Teller banking, Chrome, etc.) into a unified timeline. Ships as a single **Electron desktop app** with a local-first SQLite database.

## Features

- **Desktop app** - Electron + React 19 + Vite + TanStack Router
- **Local-first** - Drizzle ORM over better-sqlite3, no HTTP server
- **Unified timeline** - Obsidian, Farcaster, Teller, Chrome/Brave, and more
- **Typed IPC** - Renderer talks to the main process via a preload bridge; no network hops

## Quick Start

```bash
# Install dependencies
bun install

# Start the desktop app (Electron + Vite HMR)
bun run dev
```

`bun run dev` is a shortcut for `turbo -F @backpack/desktop start`, which launches the app via `electron-forge start`.

## Architecture

Backpack is a three-package monorepo:

```
backpack/
├── apps/
│   └── desktop/       # @backpack/desktop — Electron + React 19 + Vite + TanStack Router
└── packages/
    ├── sdk/           # @backpack/sdk — Node-only, main-process SDK
    └── db/            # @backpack/db — Drizzle ORM + better-sqlite3 schema
```

- **`apps/desktop`** — The Electron shell. The main process imports `@backpack/sdk` directly; the React 19 renderer talks to it through a preload bridge (`src/preload.ts`, `src/ipc/`). TanStack Router handles navigation, TanStack Query handles data loading. Tailwind CSS v4 + Radix UI for styling.
- **`@backpack/sdk`** — Node-only SDK consumed exclusively by the Electron main process. Wraps source integrations (Obsidian, Farcaster, Teller, Chrome), timeline aggregation, and search.
- **`@backpack/db`** — Drizzle ORM schema + migrations, backed by `better-sqlite3`. Opened from the main process; never shipped to the renderer.

There is no HTTP server, no CLI, no `localhost:3000`. The renderer never touches Node APIs directly — all side effects go through IPC.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) 1.3+
- macOS, Linux, or Windows (anything Electron supports)

### Install and run

```bash
git clone <repo-url>
cd backpack
bun install
bun run dev
```

The first `bun run dev` will rebuild `better-sqlite3` against the Electron ABI automatically (electron-forge handles it). The app window opens with Vite HMR attached.

### Database commands

Run from the repo root — these are turbo passthroughs to `@backpack/db`.

```bash
bun run db:push        # Sync schema to SQLite
bun run db:generate    # Generate a new migration
bun run db:migrate     # Apply migrations
bun run db:studio      # Open Drizzle Studio
```

### Type checking and lint

```bash
bun run check-types
bun run lint
# or scope to the desktop app:
bun --filter @backpack/desktop run lint
```

The desktop ESLint config (`apps/desktop/eslint.config.mjs`) enforces the project's **no-useEffect** rule. See [`.claude/skills/no-use-effect/SKILL.md`](.claude/skills/no-use-effect/SKILL.md) for the 5 replacement patterns, or `apps/desktop/src/hooks/useMountEffect.ts` for the one sanctioned escape hatch.

## Data Locations

- **macOS**: `~/Library/Application Support/Backpack/`
- **Linux**: `~/.local/share/Backpack/`
- **Windows**: `%APPDATA%\Backpack\`

The Electron app creates its SQLite database here on first launch.

## Project Structure

```
backpack/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main.ts          # Electron main entry
│       │   ├── preload.ts       # Context bridge
│       │   ├── renderer.tsx     # React entry
│       │   ├── router.tsx       # TanStack Router
│       │   ├── App.tsx
│       │   ├── hooks/
│       │   │   └── useMountEffect.ts   # the only allowed useEffect wrapper
│       │   ├── ipc/             # typed IPC handlers
│       │   ├── components/
│       │   ├── contexts/
│       │   ├── lib/
│       │   ├── styles/
│       │   └── types/
│       ├── forge.config.ts
│       ├── vite.main.config.mts
│       ├── vite.preload.config.mts
│       ├── vite.renderer.config.mts
│       └── eslint.config.mjs
├── packages/
│   ├── sdk/
│   └── db/
├── turbo.json
└── package.json
```

## Conventions

- **No direct `useEffect`.** Use one of the 5 patterns in [`.claude/skills/no-use-effect/SKILL.md`](.claude/skills/no-use-effect/SKILL.md): derived state (inline compute), data fetching (TanStack Query), user actions (event handlers), one-shot mount sync (`useMountEffect`), or state reset (`key` prop).
- **Tabs** for indentation in TS/JS/JSON.
- **Main-process-only Node APIs.** The renderer is pure React + DOM; anything Node goes through IPC.

## Additional Resources

- [React docs — You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [TanStack Router](https://tanstack.com/router)
- [TanStack Query](https://tanstack.com/query)
- [Electron Forge](https://www.electronforge.io/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Bun](https://bun.sh/docs)

# Backpack - AI Agent Development Guide

> **A guide for AI agents working with the Backpack monorepo.**
> Backpack is an Electron desktop app (React 19 + Vite + TanStack Router) backed by a Node-only SDK and a Drizzle/SQLite database.

---

## React rules

Direct `useEffect` is **banned** across `apps/desktop`. The only sanctioned escape hatch is `apps/desktop/src/hooks/useMountEffect.ts`, and an ESLint rule fails the build on any other `useEffect` import or call.

Use one of the 5 patterns below instead — see `.claude/skills/no-use-effect/SKILL.md` for the full doctrine with code examples.

1. **Derived state → inline compute.** Don't `useState + useEffect` to mirror props; compute from props/state during render.
2. **Data fetching → TanStack Query.** Use `useQuery` / `useMutation`, not `useEffect(fetch → setState)`.
3. **User actions → event handlers.** Put side effects in `onClick`/`onSubmit`, not in effects that watch a state flag.
4. **One-shot external sync on mount → `useMountEffect(() => { ... })`.** For DOM integration, third-party widget lifecycles, and browser API subscriptions. Exactly once per mount.
5. **Reset state when a prop changes → `key` prop on the parent.** Don't use a dep-array effect to reset state; remount via `key`.

Reference files:

- `.claude/skills/no-use-effect/SKILL.md` — full doctrine + examples.
- `apps/desktop/src/hooks/useMountEffect.ts` — the one allowed wrapper.
- `apps/desktop/eslint.config.mjs` — the ESLint rule that enforces this.

Based on [React docs: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect).

---

## Project overview

**Backpack** is a personal operating system that aggregates data from multiple sources (Farcaster, Obsidian, Teller banking, Chrome, etc.) into a unified timeline and interface. It ships as a single Electron desktop app with a local-first SQLite database.

**Architecture philosophy:**

- **Terminal-first UX inside a desktop window** — React 19 renderer, TanStack Router.
- **Type safety** — end-to-end TypeScript across desktop, SDK, and DB.
- **Local-first** — SQLite via Drizzle + better-sqlite3.
- **No HTTP server** — the renderer talks to the main process via Electron IPC; the main process uses `@backpack/sdk` directly.

---

## Monorepo structure

```
backpack/
├── apps/
│   └── desktop/       # Electron + React 19 + Vite + TanStack Router
├── packages/
│   ├── sdk/           # @backpack/sdk — Node-only, main-process SDK
│   └── db/            # @backpack/db — Drizzle ORM + better-sqlite3 schema
├── turbo.json
├── package.json
└── README.md
```

### `apps/desktop/` — Electron desktop app

Electron main process + React 19 renderer bundled with Vite (`@electron-forge/plugin-vite`). The renderer uses TanStack Router for navigation and TanStack Query for data loading. Main-process code imports `@backpack/sdk` directly and exposes it to the renderer via a preload bridge (`src/preload.ts` / `src/ipc/`).

Key paths:

- `src/main.ts` — Electron main entry.
- `src/preload.ts` — context bridge between main and renderer.
- `src/renderer.tsx` — React entry.
- `src/router.tsx` — TanStack Router setup.
- `src/App.tsx` — root component.
- `src/hooks/useMountEffect.ts` — the only sanctioned `useEffect` wrapper.
- `src/ipc/` — typed IPC handlers.
- `src/components/`, `src/contexts/`, `src/lib/`, `src/styles/`, `src/types/`.

### `packages/sdk/` — `@backpack/sdk`

Node-only TypeScript SDK consumed exclusively by the Electron main process. Encapsulates source integrations (Obsidian, Farcaster, Teller, etc.), timeline aggregation, and search.

### `packages/db/` — `@backpack/db`

Drizzle ORM schema + migrations. Uses `better-sqlite3`. Exposes typed query helpers consumed by the SDK.

**Commands (from repo root):**

```bash
bun run db:push        # Sync schema to database
bun run db:generate    # Generate migrations
bun run db:migrate     # Run migrations
bun run db:studio      # Open Drizzle Studio
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| **Desktop shell** | Electron + electron-forge |
| **Renderer** | React 19 + Vite |
| **Router** | TanStack Router |
| **Data loading** | TanStack Query |
| **Styling** | Tailwind CSS v4 + Radix UI |
| **Database** | SQLite via Drizzle ORM + better-sqlite3 |
| **Runtime / pkg manager** | Bun |
| **Monorepo** | Turborepo |
| **Lint** | ESLint 9 (flat config) + typescript-eslint |

---

## Development workflow

### Initial setup

```bash
git clone <repo-url>
cd backpack
bun install
```

### Running in development

```bash
# From root — starts the Electron desktop app with Vite HMR
bun run dev
# equivalent to: turbo -F @backpack/desktop start
```

### Type checking

```bash
bun run check-types
```

### Linting

```bash
bun run lint
# or just the desktop package
bun --filter @backpack/desktop run lint
```

The desktop ESLint config lives at `apps/desktop/eslint.config.mjs` and enforces the no-useEffect rule described above.

---

## Build system

### Turborepo

`turbo.json` orchestrates `build`, `check-types`, `lint`, and `start` tasks across the workspace. Dev tasks are `persistent: true` and uncached. The root `dev` script filters to `@backpack/desktop start`, which runs `electron-forge start` with Vite HMR.

---

## Best practices

### React

Follow the 5 no-useEffect rules above. When unsure, open `.claude/skills/no-use-effect/SKILL.md`.

### Error handling

Wrap SDK calls (in main-process IPC handlers or `useQuery` `queryFn`s) in try/catch and surface user-friendly errors. TanStack Query's `error` state handles the renderer side.

### IPC

Add new IPC channels in `src/ipc/` and expose them via `src/preload.ts`. Keep the renderer free of Node APIs.

---

## Troubleshooting

**"Module not found" errors:**

```bash
rm -rf node_modules
bun install
```

**Type errors in IDE:** restart the TypeScript server, then `bun run check-types`.

**Database file location (macOS):** `~/Library/Application Support/Backpack/` — Electron auto-creates it on first run.

**Native module mismatch (better-sqlite3):** run `bun install` inside `apps/desktop` — electron-forge rebuilds native modules against the Electron ABI automatically on `start`.

---

## Additional resources

- React docs: https://react.dev/
- TanStack Router: https://tanstack.com/router
- TanStack Query: https://tanstack.com/query
- Electron Forge: https://www.electronforge.io/
- Drizzle ORM: https://orm.drizzle.team/
- Bun: https://bun.sh/docs

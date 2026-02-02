# Cortex Desktop App

The primary desktop application for Cortex - your personal data operating system. Built with **vanilla TypeScript** (no React) for maximum performance.

## Features

- **Timeline View**: Aggregated view of all your data (Farcaster, Teller, Obsidian, etc.)
- **Global Search**: Press `⌘K` to search across all sources using QMD hybrid search
- **App Connections**: Connect and manage data sources
- **Obsidian Integration**: View and edit notes from your vault
- **Performance-First**: Vanilla TypeScript for sub-200ms startup times

## Architecture

The desktop app follows a performance-first architecture inspired by Obsidian, VS Code, and Figma:

- **Vanilla TypeScript** - No React overhead, direct DOM manipulation
- **esbuild** - Fast bundling (~500ms builds)
- **Custom Components** - Lightweight component pattern with automatic cleanup
- **Observable State** - Reactive state management (~100 lines)
- **Event Delegation** - Efficient event handling
- **IPC Communication** - Type-safe API calls via Electron IPC

See [`electron-performance-guide.md`](electron-performance-guide.md) for detailed architecture documentation.

## Directory Structure

```
src/
├── main.ts              # Electron main process entry
├── preload.ts           # Preload script (context bridge)
├── renderer/            # Renderer process (browser)
│   ├── index.ts         # Renderer entry
│   ├── components/      # UI components (vanilla TS)
│   │   ├── Component.ts # Base component class
│   │   ├── Layout.ts    # Main layout with sidebar
│   │   ├── Timeline.ts  # Timeline view
│   │   ├── SearchModal.ts # Global search modal
│   │   └── ...
│   ├── store.ts         # Observable state management
│   ├── router.ts        # Client-side routing
│   └── utils/           # DOM helpers, markdown, etc.
├── helpers/
│   └── ipc/             # IPC channel definitions
│       ├── search/      # Search IPC (CLI integration)
│       ├── obsidian/    # Obsidian vault operations
│       ├── chrome/      # Chrome history
│       └── ...
└── styles/
    └── global.css       # Tailwind CSS
```

## Search

The app includes a global search feature powered by the Cortex CLI and QMD.

### Keyboard Shortcut

Press `⌘K` (macOS) or `Ctrl+K` (Windows/Linux) to open the search modal.

### Features

- **Instant search** across all connected data sources
- **Hybrid search** using QMD (BM25 + vector + re-ranking)
- **Score-based ranking** with visual indicators
- **Navigate to results** by pressing Enter

### Sync Search Index

Click the "Sync" button in the search modal footer to update the search index with new data. This exports timeline items and generates embeddings via the CLI.

## Development

```bash
# Start in development mode
pnpm dev:desktop

# Or from workspace root
pnpm dev

# Build only
node esbuild.config.mjs

# Run tests
pnpm test
```

## Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start with hot reload |
| `build:vanilla` | Build with esbuild |
| `test` | Run unit tests (Vitest) |
| `test:e2e` | Run E2E tests (Playwright) |

## Environment Variables

Create `.env` in this directory:

```bash
VITE_API_URL=http://localhost:3000
VITE_TELLER_APPLICATION_ID=app_xxxxxx
```

## Performance Targets

- Cold start: <200ms
- First paint: <100ms
- Frame rate: 60fps
- Memory base: <250MB

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 38 |
| UI | Vanilla TypeScript |
| Styling | Tailwind CSS v4.1 |
| Bundler | esbuild |
| State | Custom Observable |
| Markdown | marked.js + DOMPurify |

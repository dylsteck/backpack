# Cortex

A personal operating system that aggregates data from multiple sources (Farcaster, Obsidian, Teller banking, Chrome, etc.) into a unified timeline. **CLI-first** with optional TUI and API server.

## Features

- **CLI** - Full-featured command-line interface
- **TUI** - Interactive terminal UI (Ink/React)
- **Sync** - Obsidian, Farcaster, Teller, Chrome/Brave
- **Search** - Semantic (QMD) + full-text hybrid search
- **SQLite** - Local-first database
- **API Server** - Optional tRPC HTTP API

## Quick Start

```bash
# Install dependencies
bun install

# Build
bun run build

# Run CLI (from apps/cli or use pnpm cli)
cd apps/cli && bun run dist/bin/run.js --help
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `cortex config` | View/set configuration |
| `cortex timeline` | View timeline of items |
| `cortex items <source>` | List items by source |
| `cortex sync` | Sync from all sources |
| `cortex search "query"` | Search items |
| `cortex view <id>` | View item details |
| `cortex embed` | Generate embeddings (QMD) |
| `cortex tui` | Launch interactive TUI |
| `cortex daemon` | Manage sync daemon |

## Configuration

Config is stored in:
- **macOS**: `~/Library/Application Support/cortex/config.json`
- **Linux**: `~/.config/cortex/config.json`
- **Windows**: `~/AppData/Roaming/cortex/config.json`

```bash
# Set Obsidian vault path
cortex config --set sources.obsidian.config.vaultPath=/path/to/vault

# Set source config (full structure)
cortex config --set sources.obsidian='{"type":"obsidian","enabled":true,"config":{"vaultPath":"/path"}}'
```

## Database

SQLite database location:
- **macOS**: `~/Library/Application Support/cortex/cortex.db`
- **Linux**: `~/.local/share/cortex/cortex.db`

## Development

```bash
bun run build          # Build all packages
bun run dev:cli        # Watch CLI
bun run dev:server     # Watch server
bun run check-types    # Type check
```

## Project Structure

```
cortex/
├── apps/
│   ├── cli/       # CLI + TUI
│   └── server/   # API server
├── packages/
│   ├── core/     # Database, sync, search, config
│   ├── api/      # tRPC routers
│   ├── db/       # Legacy DB (server)
│   └── sdk/      # TypeScript SDK
```

## Embeddings (QMD)

For semantic search, install QMD:

```bash
bun install -g qmd   # or: npm install -g qmd
cortex embed --setup  # Verify installation
cortex sync          # Sync triggers auto-embed
cortex search "query" # Semantic + full-text search
```

## How to Test

```bash
# From workspace root
cd apps/cli

# Test all commands
bun run dist/bin/run.js --help
bun run dist/bin/run.js config
bun run dist/bin/run.js config --json
bun run dist/bin/run.js timeline
bun run dist/bin/run.js timeline --json
bun run dist/bin/run.js items obsidian
bun run dist/bin/run.js search "test"
bun run dist/bin/run.js sync
bun run dist/bin/run.js embed --setup
bun run dist/bin/run.js tui   # Interactive - press q to quit
```

**Note**: Run with `bun` (not `node`) - the core package uses `bun:sqlite`.

## Migration from Desktop App

The Electron desktop app has been removed in favor of CLI-first architecture. Use:
- `cortex tui` for interactive browsing
- `cortex timeline` for quick view
- API server for programmatic access

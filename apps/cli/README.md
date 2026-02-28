# Backpack CLI

Command-line interface for Backpack – timeline, sync, search, and configuration.

## Commands

| Command | Description |
|---------|-------------|
| `backpack config` | View or set configuration |
| `backpack timeline` | View timeline of items |
| `backpack items <source>` | List items by source (obsidian, farcaster, teller, chrome, etc.) |
| `backpack sync` | Sync from all enabled sources |
| `backpack search "query"` | Search items (semantic + full-text) |
| `backpack view <id>` | View item details |
| `backpack embed` | Generate embeddings for semantic search (QMD) |
| `backpack tui` | Launch interactive terminal UI |
| `backpack daemon` | Manage sync daemon |

## Usage

```bash
# From workspace root (after bun run build)
bun run cli -- --help
bun run cli -- timeline
bun run cli -- items obsidian --json
bun run cli -- search "my notes"

# Or from apps/cli
bun run dist/bin/run.js timeline
```

## Options

Most commands support `--json` for machine-readable output. See `backpack <command> --help` for details.

# Cortex CLI

Command-line interface for Cortex – timeline, sync, search, and configuration.

## Commands

| Command | Description |
|---------|-------------|
| `cortex config` | View or set configuration |
| `cortex timeline` | View timeline of items |
| `cortex items <source>` | List items by source (obsidian, farcaster, teller, chrome, etc.) |
| `cortex sync` | Sync from all enabled sources |
| `cortex search "query"` | Search items (semantic + full-text) |
| `cortex view <id>` | View item details |
| `cortex embed` | Generate embeddings for semantic search (QMD) |
| `cortex tui` | Launch interactive terminal UI |
| `cortex daemon` | Manage sync daemon |

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

Most commands support `--json` for machine-readable output. See `cortex <command> --help` for details.

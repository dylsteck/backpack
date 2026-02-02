# @cortex/cli

Command-line interface for Cortex - your personal data operating system.

## Installation

```bash
# Install globally
bun install -g @cortex/cli

# Or run directly from the monorepo
cd packages/cli
bun run src/index.ts
```

## Prerequisites

- **Bun** >= 1.0.0
- **QMD** (optional, for semantic search) - Install with: `bun install -g https://github.com/tobi/qmd`

## Commands

### `cortex timeline`

Get timeline items from all connected sources.

```bash
# Get latest 25 items
cortex timeline

# Get items as JSON (for agents)
cortex timeline --json

# Filter by source
cortex timeline --source farcaster

# Filter by type
cortex timeline --type cast

# Pagination
cortex timeline --limit 50 --cursor "2024-01-15T00:00:00Z"
```

### `cortex items`

Bulk data retrieval with filtering and export options.

```bash
# Get all Farcaster posts as JSON
cortex items --source farcaster --json

# Get all Teller transactions
cortex items --source teller --json

# Export as CSV
cortex items --source teller --csv > transactions.csv

# Paginate through all data
cortex items --source teller --limit 100 --json
cortex items --source teller --limit 100 --cursor "..." --json

# Get all items (auto-paginate)
cortex items --source farcaster --all --json
```

**Output format (JSON):**
```json
{
  "items": [...],
  "nextCursor": "2024-01-15T00:00:00Z",
  "total": 1234,
  "count": 100
}
```

### `cortex search`

Hybrid search across all Cortex data using QMD (BM25 + vector + re-ranking).

```bash
# Basic search
cortex search "quarterly planning"

# JSON output for agents
cortex search "authentication flow" --json

# Limit results
cortex search "API endpoints" -n 20

# Interactive mode (requires OpenTUI)
cortex search "meeting notes" -i
```

### `cortex status`

Show connection status and data summary.

```bash
# Pretty dashboard
cortex status

# JSON output
cortex status --json

# Interactive dashboard (requires OpenTUI)
cortex status -i
```

### `cortex connections`

List and manage app connections.

```bash
# List all connections
cortex connections

# JSON output
cortex connections --json
```

### `cortex sync`

Trigger data sync from connected apps.

```bash
# Sync all apps
cortex sync all

# Sync specific app
cortex sync farcaster

# JSON output
cortex sync all --json
```

### `cortex embed`

Export timeline items and generate QMD embeddings for search.

```bash
# Export and embed (incremental)
cortex embed

# Force re-export all items
cortex embed --force

# Export only (skip embedding)
cortex embed --export-only

# First-time setup
cortex embed --setup
```

### `cortex get`

Get a specific item by ID.

```bash
# Get item details
cortex get <item-id>

# JSON output
cortex get <item-id> --json
```

## Output Formats

| Format | Flag | Description |
|--------|------|-------------|
| Pretty | (default) | Colored, human-readable output |
| JSON | `--json` | Machine-readable JSON for agents |
| CSV | `--csv` | Comma-separated values (items command only) |
| Interactive | `-i` | TUI with fuzzy finder (requires OpenTUI) |

## Agent Integration

The CLI is designed for use by AI agents. Use `--json` for structured output:

```bash
# Get all data for analysis
cortex items --source farcaster --all --json

# Search with semantic understanding
cortex search "what did I post about AI" --json

# Check sync status
cortex status --json
```

### MCP Integration

The Cortex MCP server uses the CLI under the hood. You can also use the CLI directly:

```bash
# In your MCP config
{
  "mcpServers": {
    "cortex": {
      "command": "cortex",
      "args": ["--json"]
    }
  }
}
```

## QMD Setup

For semantic search, install and configure QMD:

```bash
# Install QMD
bun install -g https://github.com/tobi/qmd

# First-time setup
cortex embed --setup

# This creates:
# - ~/.cache/cortex/qmd-items/ (export directory)
# - QMD collection "cortex-items"
# - Context for better search relevance

# Generate initial embeddings
cortex embed

# Search
cortex search "your query"
```

### How Search Works

```
Query → QMD Hybrid Search → Results
         ├── BM25 (keyword matching)
         ├── Vector (semantic similarity)
         └── LLM Re-ranking (relevance scoring)
```

QMD downloads ~2GB of models on first use (embeddinggemma, qwen3-reranker).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_PATH` | Override default database location |

Default database locations:
- macOS: `~/Library/Application Support/Cortex/cortex.db`
- Linux: `~/.config/cortex/cortex.db`
- Windows: `%APPDATA%/Cortex/cortex.db`

## Development

```bash
# Run in development
bun run src/index.ts <command>

# Build
bun run build

# Link globally for testing
bun link
```

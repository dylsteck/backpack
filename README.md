# Backpack

A personal operating system that aggregates data from multiple sources (Farcaster, Obsidian, Teller banking, Chrome, etc.) into a unified timeline. **CLI-first** with optional TUI and API server.

## Features

- **CLI** - Full-featured command-line interface
- **TUI** - Interactive terminal UI (Ink/React)
- **Sync** - Obsidian, Farcaster, Teller, Chrome/Brave
- **Search** - Semantic (QMD) + full-text hybrid search
- **SQLite** - Local-first database
- **API Server** - Optional tRPC HTTP API
- **MCP Server** - Model Context Protocol for AI agents

## Quick Start

```bash
# Install dependencies
bun install

# Build
bun run build

# Start server + initialize database (for web/desktop)
bun run dev:server
# In another terminal: curl -X POST http://localhost:3000/api/init-database

# Or run everything: bun run dev
```

**Full setup & onboarding:** See [SETUP.md](SETUP.md) for database init, connections, and all ways to run Backpack.

## CLI Commands

| Command | Description |
|---------|-------------|
| `backpack config` | View/set configuration |
| `backpack timeline` | View timeline of items |
| `backpack items <source>` | List items by source |
| `backpack sync` | Sync from all sources |
| `backpack search "query"` | Search items |
| `backpack view <id>` | View item details |
| `backpack embed` | Generate embeddings (QMD) |
| `backpack tui` | Launch interactive TUI |
| `backpack daemon` | Manage sync daemon |

## MCP Server (Code Mode)

Backpack exposes an MCP server with **Code Mode** - just 2 tools that let AI agents write JavaScript to discover and call SDK methods.

### Available Tools

| Tool | Description |
|------|-------------|
| `search` | Write JS to search the SDK spec |
| `execute` | Write JS to call SDK methods |

### How It Works

Instead of 7+ tool definitions, agents write code:

```javascript
// Search for timeline methods
async () => {
  const results = [];
  for (const [name, method] of Object.entries(backpackSpec)) {
    if (name.includes('timeline')) {
      results.push({ name, description: method.description });
    }
  }
  return results;
}

// Execute timeline
async () => {
  const result = await backpack.timeline({ limit: 10 });
  return result.items;
}
```

### Start Server

```bash
bun run dev:server
# or
cd apps/server && bun run src/index.ts
```

### Connect AI Agent

```json
// Claude Desktop
{
  "mcpServers": {
    "backpack": {
      "url": "http://localhost:3000/mcp/sse"
    }
  }
}
```

### API Endpoints

- `POST /mcp/sse` - MCP JSON-RPC
- `GET /mcp/health` - Health check

## Configuration

Config is stored in:
- **macOS**: `~/Library/Application Support/backpack/config.json`
- **Linux**: `~/.config/backpack/config.json`
- **Windows**: `~/AppData/Roaming/backpack/config.json`

```bash
# Set Obsidian vault path
backpack config --set sources.obsidian.config.vaultPath=/path/to/vault

# Set source config (full structure)
backpack config --set sources.obsidian='{"type":"obsidian","enabled":true,"config":{"vaultPath":"/path"}}'
```

## Database

SQLite database location:
- **macOS**: `~/Library/Application Support/backpack/backpack.db`
- **Linux**: `~/.local/share/backpack/backpack.db`

## Development

```bash
bun run build          # Build all packages (excludes desktop)
bun run dev:cli        # Watch CLI
bun run dev:server     # Watch server
bun run dev:web        # Watch web app (requires server on :3000)
bun run dev:desktop    # Watch desktop app (spawns server automatically)
bun run check-types    # Type check
```

### Running Web and Desktop

**Web app** (`bun run dev:web`): SolidJS SPA at http://localhost:5173. Connects to the API at http://localhost:3000. Start the server first: `bun run dev:server` (in another terminal).

**Desktop app** (`bun run dev:desktop`): Tauri window with the same UI. Spawns the server sidecar automatically if not already running. Use for Obsidian vault picker (folder selection) and OAuth flows that open the system browser.

### Build commands

| Command | Description |
|---------|-------------|
| `bun run build` | Build web, server, CLI, and packages (excludes desktop) |
| `bun run build:desktop` | Build desktop app only (requires Rust 1.85+) |
| `bun run build:all` | Build everything including desktop |

**Desktop build:** The Tauri desktop app requires Rust 1.85+ for some transitive dependencies. Run `rustup update` (or `rustup default stable`) before `bun run build:desktop`.

## Deploy to VM (Self-Host)

To run Backpack on a VM or remote server (inspired by [opencode](https://opencode.ai)):

```bash
# 1. Clone and build
git clone <repo> && cd backpack
bun install && bun run build

# 2. Compile server binary (optional – for no-Bun runtime)
cd apps/server && bun run compile

# 3. Run server (bind all interfaces for external access)
HOST=0.0.0.0 PORT=3000 ./server
# Or with Bun: HOST=0.0.0.0 bun run dev:server
```

**Environment variables for VM deployment:**

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `127.0.0.1` | Bind address. Use `0.0.0.0` to accept external connections. |
| `PORT` | `3000` | Server port. |
| `CORS_ORIGIN` | `http://localhost:5173,...` | Comma-separated origins for web app (e.g. `https://your-app.vercel.app`). |

**Web app:** Deploy the web app (Vercel, Netlify) with `VITE_API_URL=https://your-vm-ip:3000` so it connects to your server.

## Project Structure

```
backpack/
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
backpack embed --setup  # Verify installation
backpack sync          # Sync triggers auto-embed
backpack search "query" # Semantic + full-text search
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

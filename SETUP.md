# Backpack Setup Guide

How to set up Backpack and go through onboarding. Covers all ways to run and use Backpack.

---

## Quick Start (First-Time Setup)

### 1. Install & Build

```bash
git clone <repo-url>
cd backpack
bun install
bun run build
```

### 2. Initialize the Database

The **web** and **desktop** apps require the server's database to exist. The server will not initialize until the DB file is present.

**Option A: Via API (recommended for web/desktop)**

```bash
# 1. Start the server
bun run dev:server

# 2. In another terminal, initialize the database
curl -X POST http://localhost:3000/api/init-database

# 3. Server logs "[Database] Ready" — web/desktop can now connect
```

**Option B: Create the directory first**

The server auto-initializes if the database file already exists. Create the directory and let the init endpoint create the file:

```bash
# macOS
mkdir -p ~/Library/Application\ Support/Backpack

# Then start server and call init-database (or run any SDK command that creates it)
bun run dev:server
curl -X POST http://localhost:3000/api/init-database
```

### 3. Add Connections

Once the server is running with the DB ready:

- **Web** (http://localhost:5173): Go to **Connections** → connect Obsidian (path), Farcaster (API key), Teller (OAuth), Chrome/Brave
- **Desktop**: Same UI; use the native folder picker for Obsidian
- **CLI**: Use `backpack config` and `backpack sync` (see [CLI Setup](#cli-setup) below)

---

## Ways to Run Backpack

| Method | Command | Use Case |
|--------|---------|----------|
| **Full dev** | `bun run dev` | All apps (CLI, server, web, desktop) in parallel |
| **Server only** | `bun run dev:server` | API + MCP at http://localhost:3000 |
| **Web only** | `bun run dev:web` | SPA at http://localhost:5173 (requires server on :3000) |
| **Desktop only** | `bun run dev:desktop` | Tauri app (spawns server sidecar if needed) |
| **CLI only** | `bun run dev:cli` or `bun run cli` | Terminal commands |

### Running Web and Desktop Together

When you run `bun run dev`, web uses port 5173 and desktop uses 5174 to avoid conflicts.

### Prerequisites

- **Bun** (package manager + runtime)
- **Rust 1.85+** (for desktop app): `rustup default stable`
- **Zig** (optional, for semantic search): `brew install zig`

---

## Onboarding Flow (Current State)

There is **no dedicated onboarding UI** yet. The flow is:

1. **Database**: Must exist before web/desktop work. Use `POST /api/init-database` or ensure the file exists at:
   - macOS: `~/Library/Application Support/Backpack/backpack.db`
   - Linux: `~/.config/backpack/backpack.db`
   - Windows: `~/AppData/Roaming/Backpack/backpack.db`

2. **Connections**: Add integrations from the **Connections** page:
   - **Obsidian**: Pick vault folder (desktop) or enter path (web)
   - **Farcaster**: Neynar API key (set in server `.env`)
   - **Teller**: OAuth via `/teller/connect`
   - **Chrome/Brave**: File-based; connect from Connections

3. **Sync**: Data syncs automatically every 6 hours, or trigger manually via **Settings** or `backpack sync`.

---

## CLI Setup

The CLI uses `@backpack/core` and a separate DB path (`~/Library/Application Support/backpack/`). For full CLI usage:

```bash
cd apps/cli
bun run build
bun link   # or: bun run cli from root
```

See [CLI_SETUP.md](CLI_SETUP.md) for:
- QMD (semantic search) setup
- `backpack embed --setup`
- Troubleshooting

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `HOST` | 127.0.0.1 | Bind address (use `0.0.0.0` for VM) |
| `DATABASE_PATH` | OS-specific | Override DB location |
| `VITE_API_URL` | http://localhost:3000 | Web app API URL |
| `TELLER_APPLICATION_ID` | - | Teller OAuth (server `.env`) |
| `TELLER_ENVIRONMENT` | sandbox | Teller env |
| `NEYNAR_API_KEY` | - | Farcaster/Neynar API |

---

## Database Locations

| App | Path (macOS) |
|-----|--------------|
| **Server / Web / Desktop** | `~/Library/Application Support/Backpack/backpack.db` |
| **CLI** (core) | `~/Library/Application Support/backpack/backpack.db` |
| **Config** | `~/Library/Application Support/backpack/config.json` |

---

## MCP (AI Agents)

Connect Claude Desktop, Cursor, etc.:

```json
{
  "mcpServers": {
    "backpack": {
      "url": "http://localhost:3000/mcp/sse"
    }
  }
}
```

Server must be running. See [AGENTS.md](AGENTS.md#mcp-server-code-mode) for Code Mode details.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Database not initialized" | Run `curl -X POST http://localhost:3000/api/init-database` |
| Port 5173 in use | Web and desktop both start Vite; desktop uses 5174 when running together |
| Server won't start | `lsof -i :3000` to check port; ensure Bun is installed |
| CLI "command not found" | Add `~/.bun/bin` to PATH or use `bun run cli` |
| Teller OAuth fails | Set `TELLER_APPLICATION_ID` in `apps/server/.env` |

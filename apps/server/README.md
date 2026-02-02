# Cortex Server

Backend API server for Cortex. Built with **Elysia** (Bun framework) and compiled to a standalone binary.

## Features

- **tRPC API**: Type-safe API endpoints
- **MCP Server**: Model Context Protocol for AI agent integration
- **Sync Services**: Farcaster, Teller data synchronization
- **Obsidian Tools**: Read/write Obsidian notes
- **Standalone Binary**: Compiled with Bun for distribution

## Architecture

```
src/
├── index.ts           # Server entry point
├── routes/
│   ├── chat.ts        # Chat/AI routes
│   ├── mcp.ts         # MCP connection management
│   ├── mcp-server.ts  # MCP protocol implementation
│   └── teller.ts      # Teller banking routes
└── tools/
    ├── browser.ts     # Browser automation tools
    └── obsidian.ts    # Obsidian vault tools
```

## MCP Server

The server exposes Cortex tools via the Model Context Protocol at `/mcp/sse`.

### Available Tools

| Tool | Description |
|------|-------------|
| `search_items` | Search Farcaster casts and transactions |
| `analyze_data` | Get data statistics and summaries |
| `get_schema` | Database schema for SQL queries |
| `query_database` | Execute SELECT queries |
| `search_obsidian` | Search/list Obsidian notes |
| `read_obsidian` | Read note content |
| `write_obsidian` | Create/update notes |

### CLI Integration

For `search_items` and `analyze_data`, the MCP server delegates to the Cortex CLI:

```typescript
// Internally calls:
// cortex items --source farcaster --json
// cortex status --json
```

This ensures consistent behavior across MCP, CLI, and desktop app.

### Configuration

```json
// Claude Desktop (~/.config/claude/claude_desktop_config.json)
{
  "mcpServers": {
    "cortex": {
      "command": "curl",
      "args": ["-X", "POST", "http://localhost:3000/mcp/sse"]
    }
  }
}
```

Or use the CLI directly:

```json
{
  "mcpServers": {
    "cortex": {
      "command": "cortex",
      "args": ["--json"]
    }
  }
}
```

## Development

```bash
# Start in development mode
pnpm dev:server

# Or from workspace root
pnpm dev

# Build
pnpm build

# Compile to standalone binary
bun run --compile src/index.ts
```

## Environment Variables

Create `.env` in this directory:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cortex

# Teller API (optional)
TELLER_APPLICATION_ID=app_xxxxxx
TELLER_ENVIRONMENT=sandbox
TELLER_SIGNING_SECRET=your_secret

# Farcaster/Neynar (optional)
NEYNAR_API_KEY=your_key

# OpenRouter (for AI features)
OPENROUTER_API_KEY=your_key
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /mcp/sse` | MCP JSON-RPC endpoint |
| `GET /mcp/health` | Health check with tool list |
| `GET /api/apps/*` | App connection management |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Framework | Elysia |
| API | tRPC |
| Database | SQLite (via Drizzle ORM) |
| Protocol | MCP (Model Context Protocol) |

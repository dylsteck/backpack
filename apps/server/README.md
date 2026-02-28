# Backpack Server

Backend API server for Backpack. Built with **Elysia** (Bun framework) and compiled to a standalone binary.

## Features

- **tRPC API**: Type-safe API endpoints
- **MCP Server**: Model Context Protocol for AI agent integration (Code Mode)
- **Sync Services**: Obsidian, Farcaster, Teller data synchronization
- **Standalone Binary**: Compiled with Bun for distribution

## Architecture

```
src/
├── index.ts           # Server entry point
├── mcp/
│   ├── codemode.ts   # search() and execute() tools
│   └── sandbox.ts    # V8 sandbox for code execution
└── routes/
    ├── chat.ts       # Chat/AI routes
    ├── mcp.ts        # MCP connection management
    └── mcp-server.ts # MCP protocol implementation
```

## MCP Server (Code Mode)

The server exposes Backpack via **Code Mode** - just 2 tools instead of 7+. This reduces token usage from ~10KB to ~1-2KB.

### Available Tools

| Tool | Description |
|------|-------------|
| `search` | Write JavaScript to search the SDK spec |
| `execute` | Write JavaScript to call SDK methods |

### How It Works

Instead of direct tool calls, AI agents write JavaScript code that runs in a V8 sandbox:

```javascript
// search tool - discover available methods
async () => {
  const results = [];
  for (const [name, method] of Object.entries(backpackSpec)) {
    if (name.includes('timeline')) {
      results.push({ name, description: method.description });
    }
  }
  return results;
}

// execute tool - call SDK methods
async () => {
  const timeline = await backpack.timeline({ limit: 10 });
  return timeline.items;
}
```

### SDK Methods Available

```typescript
const backpack = new Backpack();

// Timeline & Items
await backpack.timeline({ limit: 10, source: 'farcaster' })
await backpack.items({ source: 'teller', limit: 100 })
await backpack.get(itemId)

// Search
await backpack.search("query")

// Connections
await backpack.connections()
await backpack.status()
await backpack.sync()
await backpack.sync('obsidian')

// Obsidian (if connected)
await backpack.obsidian.listNotes({ limit: 10 })
await backpack.obsidian.readNote('note-title')
await backpack.obsidian.createNote('Title', '# Content', { tags: ['tag1'] })

// Browser (if available)
await backpack.browser.navigate('https://example.com')
await backpack.browser.snapshot()
```

### Connect AI Agent

```json
// Claude Desktop, Cursor, etc.
{
  "mcpServers": {
    "backpack": {
      "url": "http://localhost:3000/mcp/sse"
    }
  }
}
```

## Development

```bash
# Start in development mode
bun run dev:server

# Or from workspace root
bun run dev

# Build
bun run build

# Compile to standalone binary
bun run --compile src/index.ts
```

## Environment Variables

Create `.env` in this directory:

```bash
# Database (SQLite - auto-managed)
# No DATABASE_URL needed for local development

# Teller API (optional)
TELLER_APPLICATION_ID=app_xxxxxx
TELLER_ENVIRONMENT=sandbox
TELLER_SIGNING_SECRET=your_secret

# Neynar/Farcaster (optional)
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
| Database | SQLite |
| Protocol | MCP (Model Context Protocol) |
| Sandbox | Node.js vm module (V8 isolate) |

# MCP Registry Integration - Implementation Summary

## Overview

This implementation adds Model Context Protocol (MCP) server browsing, connection management, and AI chat functionality to the Cortex desktop application. Users can now:

1. Browse MCP servers from the official registry
2. Connect to MCP servers with different transport types (stdio, HTTP, SSE)
3. Use connected MCP servers as tools in an AI-powered chat interface

## What Was Implemented

### 1. Database Schema (`packages/db/src/schema/mcp.ts`)

**New Table: `mcp_connection`**
- Stores user's MCP server connections
- Supports three transport types: stdio, HTTP, and SSE
- Tracks connection status and configuration

**Migration Applied:**
- Database migration has been generated and pushed
- Run `bunx drizzle-kit generate && bunx drizzle-kit push` if you need to reapply

### 2. Server Routes

**MCP Registry Routes (`apps/server/src/routes/mcp.ts`)**
- `GET /api/mcp/servers` - Fetches all servers from MCP registry
- `GET /api/mcp/servers/:id` - Fetches specific server details
- Implements 5-minute in-memory caching

**Chat Route (`apps/server/src/routes/chat.ts`)**
- `POST /api/chat` - Streams AI responses with MCP tools
- Creates MCP clients for each user connection
- Properly handles client lifecycle (creation and cleanup)
- Follows AI SDK v5 pattern from official cookbook

### 3. tRPC API (`packages/api/src/routers/mcp.ts`)

**New Procedures:**
- `getAvailableServers` - Proxy to MCP registry
- `getUserConnections` - Get user's connections
- `addConnection` - Add new MCP connection
- `updateConnection` - Update connection config/status
- `removeConnection` - Delete connection

### 4. Desktop App - Connections Page (`apps/desktop/src/routes/connections.tsx`)

**Features:**
- Browse MCP servers from registry
- Real-time search by name/description
- Advanced filtering by vendor and categories
- Click to connect with setup dialog
- Shows count of connected servers

**New Components:**
- `mcp-server-card.tsx` - Displays server info
- `mcp-filters.tsx` - Search + filter UI with Popover
- `mcp-setup-sheet.tsx` - Connection setup dialog

### 5. Desktop App - Chat Page (`apps/desktop/src/routes/chat.tsx`)

**Features:**
- ChatGPT-style interface
- Uses Vercel AI SDK v5's `useChat` hook
- Automatically loads user's MCP connections as tools
- Shows active MCP server count
- Streaming responses with tool calls

**New Components:**
- `chat-interface.tsx` - Main chat container
- `chat-message.tsx` - Individual message bubbles
- `chat-input.tsx` - Message input with send button

### 6. New Shadcn UI Components (`packages/shared/src/components/ui/`)

Added:
- `popover.tsx` - For filter dropdown
- `select.tsx` - For transport type selection
- `badge.tsx` - For tags and counts
- `scroll-area.tsx` - For chat message scrolling

### 7. Navigation

**Updated Navbar:**
- Added "Chat" as the fourth navigation tab

## Dependencies Added

**Server (`apps/server/package.json`):**
```json
"ai": "^5.0.0"
"@ai-sdk/openai": "^2.0.53"
"@ai-sdk/mcp": "^0.0.1"
```

**Desktop (`apps/desktop/package.json`):**
```json
"ai": "^5.0.0"
"@ai-sdk/react": "^2.0.80"
"@ai-sdk/openai": "^2.0.53"
"@ai-sdk/mcp": "^0.0.1"
"@radix-ui/react-popover": "^1.1.15"
"@radix-ui/react-select": "^2.2.6"
"@radix-ui/react-scroll-area": "^1.2.10"
```

## Environment Variables

**Required in `apps/server/.env`:**
```bash
OPENAI_API_KEY=your_openai_api_key_here
SERVER_URL=http://localhost:3000  # Your server URL
```

These have been added to `.env.example`.

## How to Use

### 1. Start the Server

```bash
cd apps/server
bun run dev
```

### 2. Start the Desktop App

```bash
cd apps/desktop
bun run dev
```

### 3. Connect MCP Servers

1. Navigate to "Connections" tab
2. Browse available MCP servers from the registry
3. Use search and filters to find servers
4. Click on a server to open setup dialog
5. Choose transport type:
   - **HTTP/SSE**: Enter URL and optional headers
   - **STDIO**: Enter command and arguments
6. Click "Connect"

### 4. Use Chat

1. Navigate to "Chat" tab
2. Your connected MCP servers are automatically available as tools
3. Start chatting - the AI can use MCP tools automatically
4. Badge shows how many MCP servers are active

## Implementation Details

### MCP Client Pattern

The implementation follows the official AI SDK cookbook pattern:

1. **Create clients** for each connection
2. **Call `client.tools()`** to get tool definitions
3. **Merge toolsets** from all connections
4. **Pass to `streamText`** with OpenAI model
5. **Always close clients** in finally block

### Caching Strategy

- Simple in-memory Map with timestamp validation
- 5-minute TTL on MCP registry data
- No Redis dependency (can be added later)

### Security

- User connections are isolated by userId
- Authorization token passed in headers for chat
- Transport configurations stored securely in database

## Testing

All packages build successfully:
```bash
bun run --filter @cortex/db build     # ✅
bun run --filter @cortex/api build    # ✅
bun run --filter @cortex/shared build # ✅
```

No linter errors in any new or modified files.

## Future Enhancements

1. **Connection Status Monitoring**: Ping MCP servers to verify status
2. **Connection Testing**: Test button before saving
3. **OAuth Integration**: Full OAuth flow for HTTP MCP servers
4. **Tool Usage Display**: Show which tools were called in chat
5. **Redis Caching**: Replace in-memory cache for production
6. **User API Keys**: Allow users to provide their own OpenAI keys
7. **Multiple AI Models**: Support different AI providers beyond OpenAI

## API Reference

### MCP Registry API
- Base URL: `https://registry.modelcontextprotocol.io/api/v0/`
- Documentation: https://github.com/modelcontextprotocol/registry

### AI SDK v5 Documentation
- MCP Tools Cookbook: https://ai-sdk.dev/cookbook/node/mcp-tools
- useChat Hook: https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot
- Announcement Blog: https://vercel.com/blog/ai-sdk-5

## Notes

- The chat route creates new MCP clients on each request (stateless)
- Clients are properly cleaned up to prevent memory leaks
- The UI uses TanStack Router with file-based routing
- All components follow shadcn/ui patterns for consistency


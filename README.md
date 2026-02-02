# cortex

A modern TypeScript stack for building high-performance desktop applications with an embedded API server.

## Features

### Core Stack
- **TypeScript** - For type safety and improved developer experience
- **Bun** - Runtime environment and package manager
- **tRPC** - End-to-end type-safe APIs
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Turborepo** - Optimized monorepo build system

### Desktop Application (Electron)
- **Vanilla TypeScript** - No framework overhead, maximum performance (no React)
- **esbuild** - Ultra-fast bundler for main, renderer, and server processes
- **Electron** - Cross-platform desktop app framework
- **TailwindCSS** - Utility-first CSS framework
- **Custom Observable State** - Lightweight, reactive state management (~100 lines)
- **Direct DOM Manipulation** - Event delegation and virtual scrolling for performance
- **tRPC Client** - Type-safe API communication via IPC

> 📖 **Performance Guide**: See [`apps/desktop/electron-performance-guide.md`](apps/desktop/electron-performance-guide.md) for a detailed guide on building high-performance Electron apps with vanilla TypeScript, inspired by Obsidian, VS Code, and Figma. This guide explains why we chose vanilla TypeScript over React and covers techniques like event delegation, virtual scrolling, and memory management.

### Backend API
- **Elysia** - Type-safe, high-performance framework
- **Bun** - Runtime for API server, compiled to standalone binary
- **tRPC** - End-to-end type-safe APIs
- **Authentication** - Better-Auth

## Getting Started

First, install the dependencies:

```bash
pnpm install
```
## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:
```bash
pnpm db:push
```

## Environment Configuration

### Server Environment Variables (`apps/server/.env`)

Create a `.env` file in `apps/server/` with the following variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cortex

# Teller API (for bank account integration)
TELLER_APPLICATION_ID=app_xxxxxxxxxxxxxx
TELLER_ENVIRONMENT=sandbox  # or "production"
TELLER_SIGNING_SECRET=your_signing_secret  # Optional, for webhooks
```

### Desktop App Environment Variables (`apps/desktop/.env`)

Create a `.env` file in `apps/desktop/` with:

```bash
VITE_API_URL=http://localhost:3000
VITE_TELLER_APPLICATION_ID=app_xxxxxxxxxxxxxx
```

### Teller Setup

To enable bank account connections via Teller:

1. Sign up at [https://teller.io](https://teller.io)
2. Create an application in the Teller Dashboard
3. Get your Application ID (starts with `app_`)
4. Add the Application ID to both server and desktop `.env` files
5. Use `sandbox` environment for testing (no real bank connections required)
6. Apply for production access when ready to use real bank data

**Note**: The Teller Application ID is public and safe to use in frontend code.


Then, run the development server:

```bash
pnpm dev
```

- **Desktop**: The Electron app will launch automatically
- **API**: Running at [http://localhost:3000](http://localhost:3000)







## Search

Cortex uses [QMD](https://github.com/tobi/qmd) for hybrid search across all your data (Farcaster posts, bank transactions, Obsidian notes, etc.).

### Quick Start

```bash
# Install QMD
bun install -g https://github.com/tobi/qmd

# Setup search index
cortex embed --setup

# Search everything
cortex search "meeting notes about project X"
```

### Desktop App

Press `⌘K` (or click the search icon) to open the search modal. Use the "Sync" button to update the search index with new data.

### CLI

```bash
# Install CLI globally
bun install -g @cortex/cli

# Get help
cortex --help

# Search
cortex search "your query" --json

# Get items by source
cortex items --source farcaster --json
```

See [`packages/cli/README.md`](packages/cli/README.md) for full CLI documentation.

## Project Structure

```
cortex/
├── apps/
│   ├── desktop/     # Desktop application (Electron + Vanilla TypeScript)
│   └── server/      # Backend API (Elysia + tRPC + Bun)
├── packages/
│   ├── api/         # API layer / business logic (tRPC routers)
│   ├── cli/         # Command-line interface (@cortex/cli)
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries (Drizzle ORM)
```

### Desktop App Architecture

The desktop app follows a performance-first architecture inspired by Obsidian, VS Code, and Figma:

- **Vanilla TypeScript** - No React overhead, direct DOM manipulation
- **esbuild** - Fast bundling for all processes (main, renderer, server)
- **Custom Components** - Lightweight component pattern with automatic cleanup
- **Observable State** - Reactive state management without framework dependencies
- **Event Delegation** - Efficient event handling at container level
- **Virtual Scrolling** - Render only visible items for large lists
- **IPC Communication** - Type-safe API calls via Electron IPC
- **Embedded Server** - API server bundled as standalone binary

## Available Scripts

### Development
- `pnpm dev`: Start desktop app and API server in development mode
- `pnpm dev:server`: Start only the API server
- `pnpm dev:desktop`: Start the Electron desktop app (uses esbuild + Electron Forge)

### Building
- `pnpm build`: Build all applications
- `pnpm build:desktop`: Build desktop app with esbuild
- `pnpm build:server`: Compile API server to standalone binary

### Database
- `pnpm db:push`: Push schema changes to database
- `pnpm db:studio`: Open database studio UI

### Quality
- `pnpm check-types`: Check TypeScript types across all apps
- `pnpm lint`: Run ESLint across all apps

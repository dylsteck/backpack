# Cortex Desktop

Electron + Vite + TanStack Router desktop application for Cortex.

## Development

```bash
# Install dependencies
bun install

# Run in development mode (starts both Vite and Electron)
bun run dev

# Build for production
bun run build
```

## Architecture

- **Electron**: Main process manages the application window and lifecycle
- **Vite**: Fast dev server on port 3002, builds the UI
- **TanStack Router**: Client-side routing
- **Direct API Calls**: tRPC calls to Elysia server at localhost:3000

## Environment Variables

Create a `.env.local` file in the desktop root:

**`.env.local`**:
```
VITE_SERVER_URL=http://localhost:3000
```

## Tech Stack

- Electron Forge with Webpack
- Vite 6
- TanStack Router
- React 19
- TypeScript
- TailwindCSS v4
- tRPC
- better-auth


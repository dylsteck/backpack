# Cortex Desktop

Electron + Next.js desktop application for Cortex.

## Development

```bash
# Install dependencies
bun install

# Run in development mode (starts both Next.js and Electron)
npm run dev

# Build for production
npm run build
```

## Architecture

- **Electron**: Main process manages the application window and lifecycle
- **Next.js**: Runs internally on port 3002, providing the UI and API routes
- **API Proxy**: Next.js API routes can proxy requests to the main server

## Environment Variables

Create a `.env.local` file in the `nextjs/` directory:

**`nextjs/.env.local`**:
```
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

> Note: The file needs to be in `nextjs/.env.local` (not the root desktop folder) because Next.js runs from the `nextjs` subdirectory.

## Tech Stack

- Electron Forge with Webpack
- Next.js 15
- React 19
- TypeScript
- TailwindCSS
- tRPC
- better-auth


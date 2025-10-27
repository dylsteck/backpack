# Cortex Desktop App - Setup Guide

## Overview

The Cortex Desktop app is an Electron + Next.js application that brings the web experience to the desktop with native features.

## Architecture

```
┌─────────────────────────────────────────┐
│          Electron Main Process          │
│  - Window Management                    │
│  - Next.js Server Lifecycle             │
│  - Native Menu & Tray                   │
│  - Window State Persistence             │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│        Next.js Server (Port 3002)       │
│  - Full SSR/API Routes                  │
│  - Proxy to apps/server                 │
│  - better-auth Integration              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│          Electron Renderer              │
│  - Loads Next.js App                    │
│  - React Components                     │
│  - Shared UI Components                 │
└─────────────────────────────────────────┘
```

## Project Structure

```
apps/desktop/
├── src/
│   ├── index.ts              # Electron main process
│   ├── window-state.ts       # Window state manager
│   ├── preload.ts           # Preload script (minimal)
│   └── renderer.ts          # Legacy renderer (unused)
├── nextjs/
│   ├── app/                 # Next.js app directory
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Home page
│   │   ├── apps/            # Apps page
│   │   ├── backpack/        # Backpack page
│   │   ├── login/           # Login page
│   │   └── api/
│   │       └── proxy/       # Proxy to server
│   ├── components/          # React components
│   ├── lib/                 # Auth & utilities
│   ├── utils/               # tRPC setup
│   └── index.css           # Global styles
├── forge.config.ts          # Electron Forge config
├── next.config.ts           # Next.js config
├── package.json
└── tsconfig.json
```

## Key Features

### 1. **Shared Package Integration**

The app uses `@cortex/shared` package for reusable UI components:
- All shadcn/ui components
- Utility functions (cn, etc.)
- Shared between web and desktop

### 2. **Window State Management**

Automatically saves and restores:
- Window size
- Window position
- Maximized state
- Fullscreen state

State is saved in: `~/.config/[app-name]/window-state-main.json`

### 3. **Native Menu**

Full application menu with:
- File menu (Quit)
- Edit menu (Undo, Redo, Cut, Copy, Paste, etc.)
- View menu (Reload, DevTools, Zoom, Fullscreen)
- Window menu (Minimize, Zoom, Front)

### 4. **Tray Icon** (Windows/Linux only)

System tray icon with:
- Show/Hide app
- Quick quit option
- Click to toggle visibility

### 5. **API Proxy**

Next.js API routes at `/api/proxy/[...path]` can:
- Forward requests to the main server
- Handle local operations
- Maintain session cookies

### 6. **Authentication**

Uses `better-auth/react` client:
- Same auth as web app
- Connects to server auth endpoints
- Stores tokens locally

## Development

### Prerequisites

- Bun (package manager)
- Node.js 20+
- The main server running at `http://localhost:3000`

### Setup

1. **Install dependencies:**
   ```bash
   cd /path/to/cortex
   bun install
   ```

2. **Configure environment:**
   Create `apps/desktop/nextjs/.env.local`:
   ```env
   NEXT_PUBLIC_SERVER_URL=http://localhost:3000
   ```
   
   > Important: The file must be in the `nextjs/` subdirectory, not the desktop root.

3. **Start development:**
   ```bash
   # From root
   npm run dev:desktop

   # Or from desktop directory
   npm run dev
   ```

This will:
- Start Next.js dev server on port 3002
- Launch Electron with hot reload
- Open DevTools automatically

### Development Workflow

1. Next.js changes hot reload automatically
2. Electron main process changes require restart
3. Component changes reflect immediately
4. Shared package changes require rebuild

## Building for Production

### Build Commands

```bash
# Build Next.js and create Electron package
npm run build

# Create distributables for current platform
npm run make

# Package without creating installer
npm run package
```

### Distribution Files

After running `npm run make`, you'll find:

- **macOS**: `out/make/zip/darwin/x64/Cortex-darwin-x64-1.0.0.zip`
- **Windows**: `out/make/squirrel.windows/x64/CortexSetup.exe`
- **Linux**: 
  - `out/make/deb/x64/cortex_1.0.0_amd64.deb`
  - `out/make/rpm/x64/cortex-1.0.0.x86_64.rpm`

## Configuration Files

### `package.json`

Key scripts:
- `dev`: Runs both Next.js and Electron concurrently
- `dev:next`: Starts Next.js dev server on port 3002
- `dev:electron`: Starts Electron Forge
- `build:next`: Builds Next.js for production
- `build`: Full production build

### `forge.config.ts`

Electron Forge configuration:
- **Packager**: App metadata, bundle ID, icons
- **Makers**: Platform-specific installers
- **Plugins**: Webpack for bundling
- **Fuses**: Security settings

### `next.config.ts`

Next.js configuration:
- Typed routes enabled
- App directory enabled
- Optimized for Electron environment

### `tsconfig.json`

TypeScript configuration with path aliases:
- `@/*` → `./nextjs/*`
- `@cortex/shared` → Shared package
- `@cortex/shared/*` → Shared package subpaths

## Troubleshooting

### Next.js server not starting

Check if port 3002 is available:
```bash
lsof -i :3002
```

### Window not appearing

Check the console for Next.js startup errors. The window only shows after Next.js is ready.

### Authentication issues

Ensure:
1. Server is running at the URL in `.env.local`
2. CORS is properly configured on the server
3. Cookies are being set correctly

### Build failures

1. Clean build artifacts:
   ```bash
   rm -rf .webpack .next out
   ```

2. Reinstall dependencies:
   ```bash
   rm -rf node_modules
   bun install
   ```

## Adding Custom Features

### Add a new page

1. Create page in `nextjs/app/[page-name]/page.tsx`
2. Add route to navbar in `nextjs/components/navbar.tsx`

### Add native functionality

1. Add to `src/index.ts` main process
2. Expose via IPC if needed (add to `src/preload.ts`)
3. Use in renderer via window object

### Add shared components

1. Add to `packages/shared/src/components/`
2. Export in `packages/shared/src/components/index.ts`
3. Import from `@cortex/shared/components`

## Security Considerations

- Node integration is disabled
- Context isolation is enabled
- Sandbox mode is enabled
- External links open in default browser
- No direct filesystem access from renderer

## Performance Tips

1. **Next.js production mode** is much faster than dev
2. **Window state** persists across restarts
3. **Webpack caching** speeds up rebuilds
4. **Shared package** reduces bundle duplication

## Next Steps

1. Add custom app icons (see `forge.config.ts`)
2. Implement auto-update (Electron Forge publishers)
3. Add deep linking support
4. Set up code signing for distribution
5. Configure CI/CD for automated builds

## Resources

- [Electron Documentation](https://electronjs.org/docs)
- [Electron Forge](https://www.electronforge.io)
- [Next.js Documentation](https://nextjs.org/docs)
- [better-auth](https://www.better-auth.com)

## Support

For issues or questions, refer to the main Cortex repository.


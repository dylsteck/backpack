# Vanilla TypeScript Migration Guide

This document describes the migration from React to vanilla TypeScript for maximum performance.

## Architecture Overview

```
apps/desktop/src/
├── main.ts                 # Electron main process (with server spawning)
├── preload.ts              # IPC preload scripts
├── renderer/               # NEW: Vanilla TypeScript renderer
│   ├── index.ts            # App initialization
│   ├── store.ts            # Observable state management
│   ├── router.ts           # Lightweight hash-based router
│   ├── api.ts              # tRPC client (vanilla)
│   ├── components/
│   │   ├── Component.ts    # Base component class
│   │   ├── Layout.ts       # Main layout
│   │   ├── Sidebar.ts      # Navigation sidebar
│   │   ├── Timeline.ts     # Timeline with virtual scroll
│   │   ├── AppsGrid.ts     # Apps grid view
│   │   ├── AppDetail.ts    # App detail view
│   │   └── Onboarding.ts   # Onboarding flow
│   ├── types/
│   │   └── index.ts        # Shared TypeScript types
│   └── utils/
│       ├── dom.ts          # DOM helpers
│       └── virtual-scroll.ts
├── helpers/ipc/            # IPC helpers (shared)
└── styles/                 # Tailwind CSS (shared)
```

## Key Concepts

### 1. Observable State Management

Instead of React's useState/useContext, we use a simple Observable pattern:

```typescript
// Creating state
const count = new Observable(0);

// Reading state
const value = count.get();

// Updating state
count.set(5);

// Subscribing to changes
const unsubscribe = count.subscribe((newValue, oldValue) => {
  console.log(`Changed from ${oldValue} to ${newValue}`);
});
```

### 2. Component Lifecycle

All components extend the base `Component` class:

```typescript
class MyComponent extends Component {
  async init(): Promise<void> {
    this.render();
    this.subscribe(store.someValue, () => this.rerender());
  }
  
  render(): void {
    this.container.innerHTML = `<div>Content</div>`;
  }
  
  // Automatic cleanup on destroy
}
```

### 3. Event Delegation

Instead of attaching listeners to every element:

```typescript
// ❌ Bad: N listeners for N items
items.forEach(item => {
  el.addEventListener('click', () => handleClick(item));
});

// ✅ Good: Single listener on parent
container.addEventListener('click', (e) => {
  const itemEl = e.target.closest('[data-item-id]');
  if (itemEl) {
    handleClick(itemEl.dataset.itemId);
  }
});
```

### 4. Virtual Scrolling

For long lists (Timeline), we only render visible items:

```typescript
const scroller = new VirtualScroller({
  container: document.getElementById('list')!,
  itemHeight: 40,
  totalItems: 100000,
  renderItem: (index) => createItemElement(items[index]),
});
```

## Build Commands

```bash
# Development (React version - existing)
npm run dev

# Development (Vanilla version)
npm run dev:vanilla

# Build vanilla renderer only
npm run build:vanilla

# Build everything (vanilla + server)
npm run build:all

# Package with server binary
npm run package:full
npm run make:full
```

## Server Bundling

The server is bundled with the Electron app for production:

1. Server is compiled to standalone binary: `bun build --compile`
2. Binary is included in `extraResource` in forge config
3. Main process spawns server on app start
4. Server port is passed to renderer via IPC

## Performance Targets

| Metric | React | Vanilla Target |
|--------|-------|----------------|
| Cold start | ~800ms | <250ms |
| Bundle size | ~500KB+ | <100KB |
| Memory (base) | ~500MB | <300MB |
| First paint | ~400ms | <150ms |

## Migration Checklist

- [x] Set up esbuild config
- [x] Create Observable store
- [x] Create lightweight router
- [x] Create vanilla tRPC client
- [x] Migrate Sidebar
- [x] Migrate Timeline
- [x] Migrate Apps grid
- [x] Migrate App detail
- [x] Migrate Onboarding
- [x] Add server bundling
- [ ] Remove React dependencies (when ready)
- [ ] Update index.html to use vanilla bundle
- [ ] Performance testing

## Switching Between React and Vanilla

The vanilla version can run alongside the existing React version during migration:

1. React version: Uses existing `index.html` and `renderer.tsx`
2. Vanilla version: Uses `index-vanilla.html` and `src/renderer/index.ts`

To fully switch to vanilla:
1. Update `index.html` to load `dist-vanilla/renderer.js`
2. Remove React-specific dependencies from `package.json`
3. Update forge config renderer entry

## Dependencies to Remove (When Ready)

```
- react
- react-dom
- @tanstack/react-router
- @tanstack/react-query
- @trpc/react-query
- @radix-ui/* (all Radix packages)
- lucide-react
- And other react-* packages
```


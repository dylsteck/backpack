# The Ultimate Guide to Building Lightning-Fast Electron Apps
## How Obsidian, VS Code, and Figma Achieve Native Performance

> **TL;DR:** Your React + Vite Electron app feels slow because frameworks add 50-100KB+ overhead, virtual DOM reconciliation, and unnecessary re-renders. This guide shows you how industry leaders build Electron apps that feel native by using vanilla JavaScript, strategic bundling, and performance-first architecture.

---

## Table of Contents

1. [Why Your Electron App Feels Slow](#why-your-electron-app-feels-slow)
2. [The Philosophy: No Framework, Maximum Performance](#the-philosophy)
3. [Case Studies: Real-World Architecture](#case-studies)
4. [Core Techniques](#core-techniques)
5. [Bundling Strategy](#bundling-strategy)
6. [Memory Management](#memory-management)
7. [API & Network Calls](#api-network-calls)
8. [Migration Path from React + Vite](#migration-path)
9. [Complete Code Examples](#code-examples)
10. [Performance Checklist](#checklist)

---

## Why Your Electron App Feels Slow {#why-your-electron-app-feels-slow}

### The React + Vite Problem

Your current stack is adding significant overhead:

**React Runtime Overhead:**
- React: ~40KB minified + gzipped
- ReactDOM: ~15KB minified + gzipped
- Virtual DOM reconciliation on every state change
- Component lifecycle management overhead
- Hooks dependency tracking

**Vite in Production:**
- While Vite is fast in dev, production builds use Rollup
- ESM-based serving in dev doesn't reflect production performance
- Still bundling all of React's machinery

**The Math:**
```
Typical Electron App Startup:
├─ Electron Shell: ~50-100ms
├─ React Hydration: ~200-500ms (depending on complexity)
├─ Initial Render: ~100-300ms
└─ Total: 350-900ms before interactive

Vanilla JS App Startup:
├─ Electron Shell: ~50-100ms
├─ DOM Creation: ~50-150ms
└─ Total: 100-250ms before interactive

3-4x faster startup!
```

### What "Fast" Actually Means

The best Electron apps achieve:
- **Cold start:** <200ms to first paint
- **Memory footprint:** 150-300MB base (vs 500MB+ with frameworks)
- **Interaction latency:** <16ms (60fps), <8ms (120fps ideal)
- **Bundle size:** <500KB total app code

---

## The Philosophy: No Framework, Maximum Performance {#the-philosophy}

### Core Principles

1. **As close to the DOM as possible** (Microsoft's VS Code approach)
2. **Only bundle what you absolutely need**
3. **Let the browser do the work** (event delegation, native APIs)
4. **Minimize dependencies** (avoid dependency hell)
5. **Memory management is YOUR responsibility** (no garbage collection helpers)

### When This Approach Makes Sense

✅ **Use vanilla JS when:**
- Performance is critical (IDE, design tool, note-taking)
- Small team (2-10 people) who can maintain custom code
- App will be used for hours daily (can't afford slowness)
- You need <250ms startup time
- Memory usage matters (running alongside other apps)

❌ **Stick with React when:**
- Rapid prototyping (MVP in weeks)
- Large team (>15 people) needs standardization
- Complex state management across many views
- Willing to sacrifice 200-300ms startup for dev velocity
- Have existing React component library investment

### The Trade-off Reality

| Aspect | Vanilla JS | React |
|--------|-----------|-------|
| Startup Time | 100-250ms | 350-900ms |
| Memory Base | 150-300MB | 400-700MB |
| Dev Velocity | Slower (more boilerplate) | Faster (components) |
| Maintainability | Requires discipline | Standardized patterns |
| Team Onboarding | Custom patterns to learn | Known React patterns |
| Performance Ceiling | Very high | Medium-high |

---

## Case Studies: Real-World Architecture {#case-studies}

### 1. Obsidian: The Note-Taking Powerhouse

**Tech Stack:**
- **Desktop:** Electron 34.3.0
- **UI:** Vanilla TypeScript (NO framework)
- **Editor:** CodeMirror 6
- **Mobile:** Capacitor (not Electron)
- **Bundler:** esbuild for plugins

**Key Decisions:**

1. **Why No React?**
   - Eliminates 50KB+ of framework overhead
   - No virtual DOM = direct DOM manipulation
   - No reconciliation delays
   - Full control over render cycles

2. **Plugin Architecture:**
   ```javascript
   // Plugins CAN use React if they want
   // Each plugin bundles its own React copy
   // Core stays framework-free
   
   // Plugin build (esbuild):
   {
     entryPoints: ['src/main.ts'],
     bundle: true,
     external: [
       'obsidian',      // Provided by core
       'electron',      // Provided by Electron
       '@codemirror/*'  // Provided by core
     ],
     format: 'cjs',
     target: 'es2018'
   }
   
   // React is NOT external - gets bundled per plugin
   // If 10 plugins use React = 10 React copies in memory
   // But core remains lean!
   ```

3. **Dependency Management Philosophy:**
   - **Small utilities:** Re-implement (avoid lodash)
   - **Medium modules:** Fork and include
   - **Large libraries:** Version-lock, test thoroughly
   - Keep dependency graph SHALLOW

4. **Performance Results:**
   - 100K+ files in vault: still responsive
   - Base memory: ~170-250MB
   - With plugins: 500MB - 1GB (acceptable for power users)
   - Handles 14MB single documents smoothly

**What We Learn:**
- No framework in core = massive win
- Plugin system can offer React for complex UIs
- Conservative dependencies prevent bloat
- Direct DOM access enables optimizations impossible in React

---

### 2. VS Code: The Editor That Changed Everything

**Tech Stack:**
- **Desktop:** Electron
- **UI:** Custom vanilla TypeScript framework
- **No React, Vue, or Angular in core**
- **Extensions:** Can use webviews with any framework

**Architecture Insights:**

1. **Process Architecture:**
   ```
   Main Process (Node.js)
   ├─ Window Management
   ├─ File System Access
   └─ Native Menus
   
   Renderer Process (Chromium)
   ├─ Editor UI (Vanilla TS)
   ├─ Monaco Editor
   └─ Extension Host (Sandboxed)
   
   Extension Host Process (Node.js)
   ├─ Runs extension code
   ├─ Language servers
   └─ Isolated from UI
   ```

2. **Custom UI Framework:**
   - Microsoft built their own lightweight abstraction
   - Direct DOM manipulation with TypeScript types
   - Event delegation at container level
   - Reusable "components" (just functions)

3. **Why No Framework?**
   - Quote from VS Code team: "To be as close to the DOM as possible"
   - Performance critical for professional tool
   - Need millisecond-level control
   - Memory efficiency (developers keep VS Code open all day)

4. **Module Loading:**
   - Custom AMD loader (moving to ESM)
   - Tree-shaking and code splitting
   - Lazy loading of features
   - Custom protocol (`vscode-file://`) to avoid CORS

**What We Learn:**
- Custom > framework when performance matters
- Process isolation protects core from extensions
- Direct DOM access = predictable performance
- Investment in custom tooling pays off at scale

---

### 3. Figma: Design at 60fps

**Tech Stack:**
- **Desktop:** Electron (contributed BrowserView to Electron project)
- **Renderer:** WebAssembly (C++) for canvas operations
- **UI:** Likely vanilla JS/TS (not publicly confirmed but no framework artifacts)

**Performance Innovations:**

1. **WebAssembly for Heavy Lifting:**
   ```
   JavaScript (UI logic)
   ├─ Event handling
   ├─ API calls
   └─ State management
   
   WebAssembly (Render engine)
   ├─ Vector math
   ├─ Canvas drawing
   └─ Layout calculations (3x faster load times achieved)
   ```

2. **BrowserView Contribution:**
   - Replaced `<webview>` tag (buggy, slow)
   - More performant embedding
   - Better than iframe isolation
   - Now part of core Electron API

3. **Optimization Journey:**
   - Moved from 29s → 8s load times (large files)
   - WebAssembly bugs fixed
   - Document renderer restructured
   - Frame time monitoring (avg + max)

4. **Performance Monitoring:**
   ```javascript
   // Track frame times
   const avgFrameTime = frames.reduce((a,b) => a+b) / frames.length;
   const maxFrameTime = Math.max(...frames);
   
   // Both matter:
   // High avg = choppy (cobblestones)
   // High max = hitching (hitting rocks)
   ```

**What We Learn:**
- WebAssembly for CPU-intensive operations
- Profile average AND maximum frame times
- Native feeling requires <16ms frame times
- Contributing to Electron benefits entire ecosystem

---

## Core Techniques {#core-techniques}

### 1. Direct DOM Manipulation (The Right Way)

**❌ Bad: Naive Approach**
```javascript
// Creates separate listener for every item
items.forEach(item => {
  const el = document.createElement('div');
  el.textContent = item.name;
  
  // BAD: N listeners for N items
  el.addEventListener('click', () => handleClick(item));
  
  container.appendChild(el);
});
```

**✅ Good: Event Delegation**
```javascript
// Single listener on parent
container.addEventListener('click', (e) => {
  const itemEl = e.target.closest('[data-item-id]');
  if (!itemEl) return;
  
  const itemId = itemEl.dataset.itemId;
  const item = itemsMap.get(itemId);
  handleClick(item);
});

// Batch DOM updates
const fragment = document.createDocumentFragment();
items.forEach(item => {
  const el = document.createElement('div');
  el.textContent = item.name;
  el.dataset.itemId = item.id;
  fragment.appendChild(el);
});

// Single reflow
container.appendChild(fragment);
```

**Why This Wins:**
- 1 event listener vs N listeners = less memory
- Event delegation leverages browser's natural bubbling
- DocumentFragment = single reflow vs N reflows
- Can handle 10,000 items efficiently

---

### 2. TypeScript for Safety Without Runtime Cost

```typescript
// Type-safe DOM manipulation
interface Note {
  id: string;
  title: string;
  content: string;
  modified: Date;
}

class NoteManager {
  private notes = new Map<string, Note>();
  private container: HTMLElement;
  
  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);
    this.container = el;
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // Event delegation
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.matches('.note-item')) {
        const noteId = target.dataset.noteId;
        if (noteId) this.openNote(noteId);
      }
    });
  }
  
  addNote(note: Note): void {
    this.notes.set(note.id, note);
    this.renderNote(note);
  }
  
  private renderNote(note: Note): void {
    const el = document.createElement('div');
    el.className = 'note-item';
    el.dataset.noteId = note.id;
    el.textContent = note.title;
    
    this.container.appendChild(el);
  }
  
  private openNote(id: string): void {
    const note = this.notes.get(id);
    if (!note) return;
    
    // Open note logic
    console.log('Opening:', note.title);
  }
}

// Usage
const manager = new NoteManager('notes-container');
manager.addNote({
  id: '1',
  title: 'My First Note',
  content: 'Hello world',
  modified: new Date()
});
```

**Benefits:**
- TypeScript compiles away (zero runtime cost)
- Catches errors at compile time
- Better IDE autocomplete
- Refactoring confidence

---

### 3. State Management Without Redux

```typescript
type Listener<T> = (value: T) => void;

class Observable<T> {
  private value: T;
  private listeners: Set<Listener<T>> = new Set();
  
  constructor(initialValue: T) {
    this.value = initialValue;
  }
  
  get(): T {
    return this.value;
  }
  
  set(newValue: T): void {
    if (this.value === newValue) return; // Skip if unchanged
    this.value = newValue;
    this.notify();
  }
  
  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => this.listeners.delete(listener);
  }
  
  private notify(): void {
    this.listeners.forEach(listener => listener(this.value));
  }
}

// Usage
interface AppState {
  darkMode: boolean;
  sidebarOpen: boolean;
  currentNote: string | null;
}

class AppStore {
  darkMode = new Observable(false);
  sidebarOpen = new Observable(true);
  currentNote = new Observable<string | null>(null);
  
  // Computed values
  get isDarkMode(): boolean {
    return this.darkMode.get();
  }
  
  toggleDarkMode(): void {
    this.darkMode.set(!this.darkMode.get());
  }
}

// Global store
const store = new AppStore();

// Component subscribes
class ThemeButton {
  private unsubscribe: (() => void) | null = null;
  
  constructor(private button: HTMLButtonElement) {
    this.button.addEventListener('click', () => store.toggleDarkMode());
    
    // Subscribe to changes
    this.unsubscribe = store.darkMode.subscribe(isDark => {
      this.button.textContent = isDark ? '☀️' : '🌙';
      document.body.classList.toggle('dark', isDark);
    });
    
    // Initial render
    this.button.textContent = store.darkMode.get() ? '☀️' : '🌙';
  }
  
  destroy(): void {
    this.unsubscribe?.();
  }
}
```

**Why This Wins:**
- ~100 lines vs Redux's kilobytes
- Type-safe
- No middleware complexity
- Direct, predictable updates
- Easy to debug

---

### 4. Efficient List Rendering (Virtual Scrolling)

```typescript
interface VirtualScrollOptions {
  container: HTMLElement;
  itemHeight: number;
  totalItems: number;
  renderItem: (index: number) => HTMLElement;
  overscan?: number;
}

class VirtualScroller {
  private scrollTop = 0;
  private containerHeight = 0;
  private visibleStart = 0;
  private visibleEnd = 0;
  private renderedItems = new Map<number, HTMLElement>();
  
  constructor(private options: VirtualScrollOptions) {
    this.containerHeight = options.container.clientHeight;
    this.setupScrolling();
    this.render();
  }
  
  private setupScrolling(): void {
    const { container, totalItems, itemHeight } = this.options;
    
    // Create scroll container
    const scrollContent = document.createElement('div');
    scrollContent.style.height = `${totalItems * itemHeight}px`;
    container.appendChild(scrollContent);
    
    // Listen for scroll
    container.addEventListener('scroll', () => {
      this.scrollTop = container.scrollTop;
      this.render();
    });
  }
  
  private render(): void {
    const { itemHeight, totalItems, renderItem, overscan = 3 } = this.options;
    
    // Calculate visible range
    const start = Math.floor(this.scrollTop / itemHeight);
    const end = Math.ceil((this.scrollTop + this.containerHeight) / itemHeight);
    
    // Add overscan
    this.visibleStart = Math.max(0, start - overscan);
    this.visibleEnd = Math.min(totalItems, end + overscan);
    
    // Remove items outside visible range
    this.renderedItems.forEach((el, index) => {
      if (index < this.visibleStart || index >= this.visibleEnd) {
        el.remove();
        this.renderedItems.delete(index);
      }
    });
    
    // Add items in visible range
    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      if (!this.renderedItems.has(i)) {
        const item = renderItem(i);
        item.style.position = 'absolute';
        item.style.top = `${i * itemHeight}px`;
        item.style.height = `${itemHeight}px`;
        
        this.options.container.appendChild(item);
        this.renderedItems.set(i, item);
      }
    }
  }
}

// Usage for 100,000 items
const scroller = new VirtualScroller({
  container: document.getElementById('list')!,
  itemHeight: 40,
  totalItems: 100000,
  renderItem: (index) => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.textContent = `Item ${index}`;
    return div;
  }
});

// Only renders ~30 items at a time regardless of total count!
```

---

## Bundling Strategy {#bundling-strategy}

### Why esbuild Over Webpack/Vite for Production

**Performance Comparison (10 copies of three.js):**
```
esbuild:     0.37s   (1x)
Vite/Rollup: 38.11s  (103x slower)
Webpack 5:   42.91s  (116x slower)
```

**Why esbuild Wins:**
- Written in Go (compiled, not interpreted)
- Parallel processing by default
- No cache needed for speed
- Simple configuration

### Production Build Setup

**package.json:**
```json
{
  "scripts": {
    "build:main": "esbuild src/main/index.ts --bundle --platform=node --outfile=dist/main.js --external:electron",
    "build:renderer": "esbuild src/renderer/index.ts --bundle --outfile=dist/renderer.js --minify --sourcemap",
    "build": "npm run build:main && npm run build:renderer",
    "dev": "concurrently \"npm run build:main -- --watch\" \"npm run build:renderer -- --watch\" \"electron .\""
  },
  "devDependencies": {
    "esbuild": "^0.20.0",
    "electron": "^28.0.0",
    "concurrently": "^8.2.0",
    "typescript": "^5.3.0"
  }
}
```

**esbuild.config.mjs:**
```javascript
import * as esbuild from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';

// Main process
await esbuild.build({
  entryPoints: ['src/main/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/main.js',
  external: ['electron'],
  sourcemap: process.env.NODE_ENV === 'development',
  minify: process.env.NODE_ENV === 'production',
});

// Renderer process
await esbuild.build({
  entryPoints: ['src/renderer/index.ts'],
  bundle: true,
  platform: 'browser',
  target: ['chrome120'],
  outfile: 'dist/renderer.js',
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  splitting: false, // Not needed for single entry
  treeShaking: true,
});
```

**What to Bundle vs External:**

```javascript
{
  // ALWAYS external (provided by Electron)
  external: [
    'electron',
    'fs',
    'path',
    'crypto',
    'os',
    // All Node built-ins
  ],
  
  // Bundle these (your code + dependencies)
  // - Your application code
  // - Small utility libraries (date-fns, etc)
  // - UI-specific libraries
}
```

---

## Memory Management {#memory-management}

### 1. Event Listener Cleanup

```typescript
class Component {
  private listeners: Array<() => void> = [];
  
  constructor(private element: HTMLElement) {
    this.setupListeners();
  }
  
  private setupListeners(): void {
    const onClick = () => console.log('clicked');
    this.element.addEventListener('click', onClick);
    
    // Store cleanup function
    this.listeners.push(() => {
      this.element.removeEventListener('click', onClick);
    });
  }
  
  destroy(): void {
    // Remove all listeners
    this.listeners.forEach(cleanup => cleanup());
    this.listeners = [];
    
    // Remove element from DOM
    this.element.remove();
  }
}

// Obsidian Pattern
class Plugin {
  private cleanups: Array<() => void> = [];
  
  registerDomEvent(
    el: HTMLElement,
    type: string,
    handler: EventListener
  ): void {
    el.addEventListener(type, handler);
    this.cleanups.push(() => el.removeEventListener(type, handler));
  }
  
  registerInterval(id: number): void {
    this.cleanups.push(() => clearInterval(id));
  }
  
  unload(): void {
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
  }
}
```

### 2. Weak References for Caches

```typescript
// Prevent memory leaks in caches
class FileCache {
  // WeakMap: keys can be garbage collected
  private cache = new WeakMap<object, string>();
  
  set(file: object, content: string): void {
    this.cache.set(file, content);
  }
  
  get(file: object): string | undefined {
    return this.cache.get(file);
  }
  
  // No need for manual cleanup!
  // If 'file' object is GC'd, cache entry is automatically removed
}

// For primitive keys, use regular Map with size limit
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  
  constructor(private maxSize: number) {}
  
  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest (first) entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
}
```

### 3. Debouncing Expensive Operations

```typescript
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = window.setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

// Usage
const search = debounce((query: string) => {
  // Expensive search operation
  console.log('Searching for:', query);
}, 300);

searchInput.addEventListener('input', (e) => {
  search((e.target as HTMLInputElement).value);
});

// Only runs once 300ms after user stops typing
```

---

## API & Network Calls {#api-network-calls}

### The CORS Problem in Electron

Electron apps run from `app://` protocol, which triggers CORS on all external APIs.

**❌ Won't Work:**
```javascript
// Blocked by CORS
fetch('https://api.example.com/data')
  .then(r => r.json())
  .then(data => console.log(data));
// Error: CORS policy blocks app:// origin
```

**✅ Solution 1: Use Electron's Net Module**
```typescript
// renderer.ts (through IPC)
const data = await ipcRenderer.invoke('fetch-url', 'https://api.example.com/data');

// main.ts
import { net } from 'electron';

ipcMain.handle('fetch-url', async (event, url) => {
  const response = await net.fetch(url);
  return await response.json();
});
```

**✅ Solution 2: Obsidian's requestUrl (Plugin API)**
```typescript
// Obsidian provides this as part of their API
interface RequestUrlParam {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer;
}

// In Obsidian plugin:
const response = await requestUrl({
  url: 'https://api.example.com/data',
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' }
});

const data = response.json;
```

**How It Works:**
- Uses Node's HTTP/HTTPS modules under the hood
- Not subject to browser CORS restrictions
- Acts as built-in proxy
- Much simpler than setting up middleware

### Best Practice: Create Your Own Request Wrapper

```typescript
// api.ts
import { ipcRenderer } from 'electron';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
}

export async function request<T>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  try {
    const response = await ipcRenderer.invoke('api:request', {
      url,
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    
    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Usage
const todos = await request<Todo[]>('https://jsonplaceholder.typicode.com/todos');
```

---

## Migration Path from React + Vite {#migration-path}

### Step 1: Audit Your Current App

```bash
# Measure bundle size
npm run build
du -sh dist/

# Measure startup time
# Add to your app:
console.time('app-startup');
// ... at end of initialization
console.timeEnd('app-startup');

# Measure memory
# Chrome DevTools > Memory > Take Heap Snapshot
```

### Step 2: Identify Performance Bottlenecks

```typescript
// Add performance marks
performance.mark('render-start');
// ... render code ...
performance.mark('render-end');
performance.measure('render', 'render-start', 'render-end');

// Get measurements
const measures = performance.getEntriesByType('measure');
console.table(measures.map(m => ({
  name: m.name,
  duration: `${m.duration.toFixed(2)}ms`
})));
```

### Step 3: Gradual Migration Strategy

**Option A: Hybrid Approach (Safer)**
```typescript
// Keep React for complex views
// Use vanilla JS for simple, performance-critical parts

// sidebar.ts (vanilla JS - rendered first)
export class Sidebar {
  constructor(container: HTMLElement) {
    // Fast, lightweight sidebar
  }
}

// editor.tsx (still React - loaded after)
export function Editor() {
  // Complex state management justified
  return <div>...</div>;
}

// Load sidebar immediately, lazy load editor
const sidebar = new Sidebar(document.getElementById('sidebar')!);

// Later, when needed:
const EditorComponent = await import('./editor');
ReactDOM.render(<EditorComponent.Editor />, editorContainer);
```

**Option B: Full Rewrite (Faster End Result)**
```typescript
// Phase 1: Core UI (vanilla JS)
// - Window chrome
// - Sidebar
// - Menu bar
// - Status bar

// Phase 2: Editor (vanilla JS + library)
// - Use CodeMirror, Monaco, or similar
// - Don't reinvent editor from scratch

// Phase 3: Settings (vanilla JS)
// - Forms are simple in vanilla JS
// - Use native validation

// Phase 4: Plugin system
// - Allow plugins to use React if they want
// - Core stays framework-free
```

### Step 4: Replace Common React Patterns

**State Management:**
```typescript
// React
const [count, setCount] = useState(0);

// Vanilla
const count = new Observable(0);
count.subscribe(val => updateUI(val));
```

**Effects:**
```typescript
// React
useEffect(() => {
  const sub = api.subscribe(handleData);
  return () => sub.unsubscribe();
}, []);

// Vanilla
class Component {
  constructor() {
    this.subscription = api.subscribe(data => this.handleData(data));
  }
  
  destroy() {
    this.subscription.unsubscribe();
  }
}
```

**Lists:**
```typescript
// React
{items.map(item => <Item key={item.id} {...item} />)}

// Vanilla
const fragment = document.createDocumentFragment();
items.forEach(item => {
  fragment.appendChild(createItemElement(item));
});
container.appendChild(fragment);
```

---

## Complete Code Examples {#code-examples}

### Example 1: Simple Note-Taking App

**File Structure:**
```
src/
├── main/
│   └── index.ts         # Electron main process
├── renderer/
│   ├── index.ts         # App initialization
│   ├── store.ts         # State management
│   ├── components/
│   │   ├── Sidebar.ts   # Note list
│   │   └── Editor.ts    # Note editor
│   └── utils/
│       └── dom.ts       # DOM helpers
├── index.html           # Main window
└── styles/
    └── main.css
```

**index.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'">
  <title>Notes</title>
  <link rel="stylesheet" href="styles/main.css">
</head>
<body>
  <div id="app">
    <div id="sidebar"></div>
    <div id="editor"></div>
  </div>
  <script src="renderer.js"></script>
</body>
</html>
```

**renderer/index.ts:**
```typescript
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { store } from './store';

class App {
  private sidebar: Sidebar;
  private editor: Editor;
  
  constructor() {
    console.time('app-init');
    
    this.sidebar = new Sidebar(
      document.getElementById('sidebar')!
    );
    
    this.editor = new Editor(
      document.getElementById('editor')!
    );
    
    this.setupListeners();
    this.loadNotes();
    
    console.timeEnd('app-init');
  }
  
  private setupListeners(): void {
    // When note selected in sidebar, open in editor
    store.currentNote.subscribe(noteId => {
      if (noteId) {
        const note = store.notes.get().find(n => n.id === noteId);
        if (note) this.editor.setNote(note);
      }
    });
  }
  
  private async loadNotes(): Promise<void> {
    // Load notes from disk (via IPC)
    const notes = await window.api.loadNotes();
    store.notes.set(notes);
  }
}

// Initialize when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new App());
} else {
  new App();
}
```

**components/Sidebar.ts:**
```typescript
import { store } from '../store';
import { Note } from '../types';

export class Sidebar {
  private unsubscribe: (() => void)[] = [];
  
  constructor(private container: HTMLElement) {
    this.container.className = 'sidebar';
    this.setupListeners();
    this.render();
  }
  
  private setupListeners(): void {
    // Event delegation for note clicks
    this.container.addEventListener('click', (e) => {
      const noteEl = (e.target as HTMLElement).closest('[data-note-id]');
      if (noteEl) {
        const noteId = (noteEl as HTMLElement).dataset.noteId!;
        store.currentNote.set(noteId);
      }
    });
    
    // Re-render when notes change
    const unsub = store.notes.subscribe(() => this.render());
    this.unsubscribe.push(unsub);
  }
  
  private render(): void {
    const notes = store.notes.get();
    const currentId = store.currentNote.get();
    
    // Clear container
    this.container.innerHTML = '';
    
    // Batch DOM updates
    const fragment = document.createDocumentFragment();
    
    notes.forEach(note => {
      const div = document.createElement('div');
      div.className = 'note-item';
      if (note.id === currentId) {
        div.classList.add('active');
      }
      div.dataset.noteId = note.id;
      
      const title = document.createElement('div');
      title.className = 'note-title';
      title.textContent = note.title;
      
      const date = document.createElement('div');
      date.className = 'note-date';
      date.textContent = note.modified.toLocaleDateString();
      
      div.appendChild(title);
      div.appendChild(date);
      fragment.appendChild(div);
    });
    
    this.container.appendChild(fragment);
  }
  
  destroy(): void {
    this.unsubscribe.forEach(fn => fn());
  }
}
```

**components/Editor.ts:**
```typescript
import { Note } from '../types';
import { store } from '../store';
import { debounce } from '../utils/debounce';

export class Editor {
  private textarea: HTMLTextAreaElement;
  private titleInput: HTMLInputElement;
  private currentNote: Note | null = null;
  
  constructor(private container: HTMLElement) {
    this.container.className = 'editor';
    this.buildUI();
    this.setupAutosave();
  }
  
  private buildUI(): void {
    // Title input
    this.titleInput = document.createElement('input');
    this.titleInput.type = 'text';
    this.titleInput.className = 'editor-title';
    this.titleInput.placeholder = 'Note title...';
    
    // Content textarea
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'editor-content';
    this.textarea.placeholder = 'Start writing...';
    
    this.container.appendChild(this.titleInput);
    this.container.appendChild(this.textarea);
  }
  
  private setupAutosave(): void {
    const save = debounce(() => this.saveNote(), 1000);
    
    this.titleInput.addEventListener('input', save);
    this.textarea.addEventListener('input', save);
  }
  
  private async saveNote(): Promise<void> {
    if (!this.currentNote) return;
    
    this.currentNote.title = this.titleInput.value;
    this.currentNote.content = this.textarea.value;
    this.currentNote.modified = new Date();
    
    await window.api.saveNote(this.currentNote);
    
    // Update store to trigger sidebar re-render
    const notes = store.notes.get();
    const index = notes.findIndex(n => n.id === this.currentNote!.id);
    if (index !== -1) {
      notes[index] = this.currentNote;
      store.notes.set([...notes]); // Trigger update
    }
  }
  
  setNote(note: Note): void {
    this.currentNote = note;
    this.titleInput.value = note.title;
    this.textarea.value = note.content;
    this.textarea.focus();
  }
}
```

### Example 2: Electron Main Process

**main/index.ts:**
```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  mainWindow.loadFile('index.html');
  
  // Enable DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('api:loadNotes', async () => {
  const notesPath = path.join(app.getPath('userData'), 'notes.json');
  
  try {
    const data = await fs.readFile(notesPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Return empty array if file doesn't exist
    return [];
  }
});

ipcMain.handle('api:saveNote', async (event, note) => {
  const notesPath = path.join(app.getPath('userData'), 'notes.json');
  
  // Load existing notes
  let notes = [];
  try {
    const data = await fs.readFile(notesPath, 'utf-8');
    notes = JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet
  }
  
  // Update or add note
  const index = notes.findIndex((n: any) => n.id === note.id);
  if (index !== -1) {
    notes[index] = note;
  } else {
    notes.push(note);
  }
  
  // Save
  await fs.writeFile(notesPath, JSON.stringify(notes, null, 2));
});
```

**main/preload.ts:**
```typescript
import { contextBridge, ipcRenderer } from 'electron';

// Expose safe API to renderer
contextBridge.exposeInMainWorld('api', {
  loadNotes: () => ipcRenderer.invoke('api:loadNotes'),
  saveNote: (note: any) => ipcRenderer.invoke('api:saveNote', note)
});
```

---

## Performance Checklist {#checklist}

### ✅ Before Launch

**Bundling:**
- [ ] Using esbuild for production builds
- [ ] Tree-shaking enabled
- [ ] Source maps in dev only
- [ ] External dependencies properly marked
- [ ] Bundle size <500KB (app code)
- [ ] Separate main and renderer builds

**Startup Performance:**
- [ ] No synchronous fs operations on startup
- [ ] Lazy load non-critical features
- [ ] Code split by route/feature
- [ ] Preload critical assets
- [ ] First paint <200ms

**Runtime Performance:**
- [ ] Event delegation (not per-element listeners)
- [ ] Virtual scrolling for long lists (>100 items)
- [ ] Debounce expensive operations
- [ ] Use DocumentFragment for batch DOM updates
- [ ] Avoid layout thrashing (batch reads, then writes)

**Memory Management:**
- [ ] Remove event listeners on cleanup
- [ ] Clear intervals/timeouts
- [ ] Use WeakMap for object caches
- [ ] Implement LRU cache for finite resources
- [ ] Profile memory usage with DevTools

**Developer Experience:**
- [ ] TypeScript for type safety
- [ ] Hot reload in development
- [ ] Source maps working
- [ ] ESLint configured
- [ ] Prettier for formatting

### 🎯 Performance Targets

| Metric | Target | Excellent |
|--------|--------|-----------|
| Cold start | <300ms | <200ms |
| Hot reload | <100ms | <50ms |
| First paint | <200ms | <100ms |
| Time to interactive | <500ms | <300ms |
| Frame rate | 60fps | 120fps |
| Memory (base) | <400MB | <250MB |
| Memory (loaded) | <800MB | <500MB |
| Bundle size (total) | <2MB | <1MB |
| Bundle size (app) | <800KB | <500KB |

### 📊 Monitoring

**Add Performance Tracking:**
```typescript
class PerformanceMonitor {
  static measure(name: string, fn: () => void): void {
    performance.mark(`${name}-start`);
    fn();
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name)[0];
    console.log(`${name}: ${measure.duration.toFixed(2)}ms`);
  }
  
  static async measureAsync(name: string, fn: () => Promise<void>): Promise<void> {
    performance.mark(`${name}-start`);
    await fn();
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name)[0];
    console.log(`${name}: ${measure.duration.toFixed(2)}ms`);
  }
}

// Usage
PerformanceMonitor.measure('render-sidebar', () => {
  sidebar.render();
});

await PerformanceMonitor.measureAsync('load-notes', async () => {
  await loadNotes();
});
```

---

## Conclusion

Building a fast Electron app without React is absolutely possible and delivers:

- **3-4x faster startup** (100-250ms vs 350-900ms)
- **2-3x less memory** (150-300MB vs 400-700MB)
- **Predictable performance** (no framework overhead)
- **Full control** over every millisecond

The cost is **more boilerplate** and **manual memory management**, but for professional tools used for hours daily (IDEs, design tools, note apps), the performance win is worth it.

**Key Takeaways:**
1. Use **vanilla TypeScript** for core UI
2. Bundle with **esbuild** (100x faster than Webpack)
3. **Event delegation** instead of per-element listeners
4. **Virtual scrolling** for lists >100 items
5. **Debounce** expensive operations
6. **Clean up** listeners and intervals
7. Use Electron's **net module** to bypass CORS
8. **Profile constantly** with DevTools

Remember: Obsidian, VS Code, and Figma didn't become industry leaders by accident. They made deliberate architectural choices prioritizing performance over development convenience. Your users feel every millisecond.

Make them count.

---

## Resources

- [Obsidian Plugin API](https://docs.obsidian.md/)
- [VS Code Architecture](https://code.visualstudio.com/api)
- [Figma Performance Blog](https://www.figma.com/blog/figma-faster/)
- [esbuild Documentation](https://esbuild.github.io/)
- [Electron IPC Guide](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Web Performance APIs](https://developer.mozilla.org/en-US/docs/Web/API/Performance)

---

**License:** MIT  
**Last Updated:** December 2025

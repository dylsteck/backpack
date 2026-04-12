---
name: shadcn
description: Use shadcn/ui in Backpack — add and compose components, follow registry patterns, run CLI from apps/desktop. Applies when editing components under apps/desktop/src/components/ui, components.json, or “shadcn add/init/apply”.
---

# shadcn/ui (Backpack desktop)

## Project context

- **Working directory:** always `apps/desktop` (where `components.json` and `vite.config.mts` live).
- **Runner:** `bunx --bun shadcn@latest` (this monorepo uses Bun).
- **Preset:** `radix-nova` + taupe base from init preset `b2hLfDykAC` (see `components.json`).
- **Imports:** `@/components/ui/*`, `@/lib/utils` (`cn`).

## CLI

```bash
cd apps/desktop
bunx --bun shadcn@latest info --json
bunx --bun shadcn@latest add button dialog -y
bunx --bun shadcn@latest add sidebar-08 -y
```

Do **not** re-run `apply` with the same preset code right after `init` unless merging updates—it can stall during re-validation.

## Backpack-specific- **Tooltip:** wrap shell with `TooltipProvider` (see `AppShell.tsx`).
- **Sidebar:** `AppSidebar` is the `sidebar-08` inset layout; main content + `DetailSidebar` live inside `SidebarInset`.
- **Theme:** Renderer uses `document.documentElement.classList.toggle("dark", …)` via Electron `themeApi` / `applyTheme` (not the Vite localStorage-only `ThemeProvider` from generic docs).
- **useEffect:** Vendor `ui/sidebar.tsx` uses `useMountEffect` + ref for the keyboard shortcut; `use-mobile` uses `useSyncExternalStore` to satisfy the no-`useEffect` rule elsewhere.

## Full upstream skill

For global rules (forms, composition, icons), see the official skill:  
https://raw.githubusercontent.com/shadcn-ui/ui/refs/heads/main/skills/shadcn/SKILL.md

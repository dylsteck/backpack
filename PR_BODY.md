# Cortex Rewrite: CLI-First Architecture

## What This Is

Migration from **Electron desktop app** → **CLI-first** personal OS. Same data (Obsidian, Farcaster, Teller, Chrome), new interface.

## The Plan (8 Phases, 20 Plans)

```mermaid
flowchart TB
    subgraph Wave1["Wave 1: Foundation"]
        P01[01-01 Core DB]
        P02[01-02 Config + Keychain]
    end

    subgraph Wave2["Wave 2: Sync"]
        P03[02-03 Sync Engine]
        P04[02-04 Obsidian]
    end

    subgraph Wave3["Wave 3: Sources"]
        P05[03-05 Farcaster]
        P06[03-06 Teller]
        P07[03-07 Chrome]
    end

    subgraph Wave4["Wave 4: Search"]
        P08[04-08 Embeddings/QMD]
        P09[04-09 Hybrid Search]
    end

    subgraph Wave5["Wave 5: CLI"]
        P10[05-10 Config cmd]
        P11[05-11 Timeline/Items]
        P12[05-12 Sync/Search]
        P13[05-13 View/Daemon]
    end

    subgraph Wave6["Wave 6: TUI"]
        P14[06-14 Ink TUI]
        P15[06-15 Item Detail]
        P16[06-16 Search TUI]
    end

    subgraph Wave7["Wave 7: Server"]
        P17[07-17 tRPC + Core]
        P18[07-18 OAuth]
    end

    subgraph Wave8["Wave 8: Ship"]
        P19[08-19 Delete Desktop]
        P20[08-20 Release]
    end

    P01 --> P02 --> P03 --> P04 --> P05 --> P06 --> P07 --> P08 --> P09
    P09 --> P10 --> P11 --> P12 --> P13 --> P14 --> P15 --> P16 --> P17 --> P18 --> P19 --> P20
```

| Phase | Status | What |
|-------|--------|------|
| 01 Core | ✅ Done (prior) | SQLite, config, keychain |
| 02 Sync | ✅ Done (prior) | Sync engine + Obsidian |
| 03 Sources | ✅ Done (prior) | Farcaster, Teller, Chrome |
| 04 Embeddings | ✅ **This PR** | QMD integration, hybrid search |
| 05 CLI | ✅ **This PR** | config, timeline, items, sync, search, view, daemon, embed |
| 06 TUI | ✅ **This PR** | Ink-based interactive UI |
| 07 Server | ⏸️ Deferred | Refactor to use @cortex/core |
| 08 Cleanup | ✅ **This PR** | Delete desktop, update docs |

## What Changed in This PR

- **Added** `packages/core/embeddings` – QMD client, auto-embed after sync
- **Added** `packages/core/search` – semantic + full-text hybrid search
- **Added** `apps/cli` – full CLI with 9 commands + TUI
- **Removed** `apps/desktop` – Electron app
- **Updated** README, package.json scripts

## Architecture (Simple)

```mermaid
flowchart LR
    subgraph CLI
        C[config]
        T[timeline]
        S[sync]
        Q[search]
        U[tui]
    end

    subgraph Core["@cortex/core"]
        DB[(SQLite)]
        CF[Config]
        SY[Syncers]
        EM[Embeddings]
        SR[Search]
    end

    C --> CF
    T --> DB
    S --> SY
    Q --> SR
    U --> DB

    SY --> DB
    EM --> DB
    SR --> EM
    SR --> DB
```

## How to Test

**Requires Bun** (core uses `bun:sqlite`).

```bash
bun install
bun run build

cd apps/cli

# Smoke test
bun run dist/bin/run.js --help
bun run dist/bin/run.js config
bun run dist/bin/run.js timeline
bun run dist/bin/run.js search "test"

# With data - configure Obsidian then:
bun run dist/bin/run.js config --set 'sources.obsidian={"type":"obsidian","enabled":true,"config":{"vaultPath":"/path/to/vault"}}'
bun run dist/bin/run.js sync -s obsidian
bun run dist/bin/run.js timeline

# TUI (q to quit)
bun run dist/bin/run.js tui
```

## What It Means

- **No more Electron** – lighter, faster, terminal-native
- **CLI-first** – scripts, automation, `--json` for agents
- **TUI** – `cortex tui` for interactive browsing
- **Same data** – Obsidian, Farcaster, Teller, Chrome sync unchanged
- **Search** – semantic (QMD) + full-text, works without QMD (fallback)

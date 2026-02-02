# Manual CLI Setup Guide

If you didn't go through onboarding or need to set up the CLI manually, follow these steps:

## 1. Install Cortex CLI

From the workspace root:

```bash
# Navigate to CLI package
cd packages/cli

# Build the CLI
bun run build

# Link it globally (makes `cortex` command available)
bun link
```

Verify installation:

```bash
cortex --version
```

You should see the version number. If you get "command not found", make sure `~/.bun/bin` is in your PATH:

```bash
# Add to your shell config (~/.zshrc or ~/.bashrc)
export PATH="$HOME/.bun/bin:$PATH"

# Then reload your shell
source ~/.zshrc  # or source ~/.bashrc
```

## 2. Install QMD (Optional, for Search)

QMD enables semantic search across all your data:

```bash
# Install QMD globally
bun install -g https://github.com/tobi/qmd

# Verify installation
qmd --version
```

**Note**: QMD requires Zig to be installed. If you don't have Zig:

```bash
# macOS
brew install zig

# Linux
# See https://github.com/ziglang/zig/wiki/Install-Zig-from-a-Package-Manager
```

## 3. Setup QMD Collections

Once QMD is installed, set up the search index:

```bash
# First-time setup: create collections and contexts
cortex embed --setup

# Export timeline items and generate embeddings
cortex embed
```

This will:
- Create `~/.cache/cortex/qmd-items/` directory
- Export all timeline items as markdown files
- Create QMD collection "cortex-items"
- Generate vector embeddings for semantic search

## 4. Test Everything

```bash
# Check CLI status
cortex status

# Search your data
cortex search "your query"

# Get items by source
cortex items --source farcaster --json
```

## Troubleshooting

### CLI not found after `bun link`

Make sure Bun's bin directory is in your PATH:

```bash
echo $PATH | grep bun
```

If not, add it:

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

### QMD installation fails

- Ensure Zig is installed: `zig version`
- Check Bun version: `bun --version` (should be >= 1.0.0)
- Try installing from source: `bun install -g https://github.com/tobi/qmd`

### Search returns no results

1. Make sure you've exported items: `cortex embed`
2. Check if QMD collection exists: `qmd collection list`
3. Verify items were exported: `ls ~/.cache/cortex/qmd-items/`

## Next Steps

- Use `cortex search` in the desktop app (press ⌘K)
- Set up QMD for Obsidian vault: `qmd collection add ~/Documents/Obsidian --name obsidian`
- Read the full CLI docs: `packages/cli/README.md`

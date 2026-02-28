#!/bin/bash
# Ensures server binary exists for sidecar spawn, then starts web dev server.
# Invoked by Tauri beforeDevCommand from apps/desktop/src-tauri.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Compile server binary so sidecar can spawn it in dev (opencode pattern)
SERVER_DIR="$DESKTOP_ROOT/../server"
if [[ -d "$SERVER_DIR" ]]; then
  (cd "$SERVER_DIR" && bun run compile 2>/dev/null) || true
  if [[ -f "$SERVER_DIR/server" ]]; then
    TARGET=$(rustc -vV 2>/dev/null | grep '^host:' | awk '{print $2}')
    [[ -n "$TARGET" ]] && cp "$SERVER_DIR/server" "$SERVER_DIR/server-$TARGET" 2>/dev/null || true
  fi
fi

# Start web dev server on 5174 (web#dev uses 5173 when running via turbo dev)
cd "$DESKTOP_ROOT/../web" && exec bun run dev -- --port 5174

#!/bin/bash
# Ensure rustup's cargo is used (needed for edition2024 in transitive deps like getrandom)
CARGO_BIN="${HOME}/.cargo/bin"
export PATH="${CARGO_BIN}:$PATH"

# Update Rust if needed (edition2024 in getrandom/uuid requires Cargo 1.85+)
if command -v rustup &>/dev/null; then
  ver=$(cargo --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)
  if [[ -n "$ver" ]] && [[ "$(printf '%s\n' "1.85" "$ver" | sort -V | head -1)" != "1.85" ]]; then
    echo "Updating Rust (need 1.85+ for edition2024)..."
    rustup update stable
  fi
fi

exec env PATH="${CARGO_BIN}:$PATH" CARGO="${CARGO_BIN}/cargo" RUSTC="${CARGO_BIN}/rustc" bunx tauri dev

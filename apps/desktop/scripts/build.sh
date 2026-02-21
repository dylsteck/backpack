#!/bin/sh
# Ensure rustup's cargo is used (needed for edition2024 in transitive deps)
CARGO_BIN="${HOME}/.cargo/bin"
export PATH="${CARGO_BIN}:$PATH"
# Use env to ensure child processes inherit
exec env PATH="${CARGO_BIN}:$PATH" CARGO="${CARGO_BIN}/cargo" RUSTC="${CARGO_BIN}/rustc" bunx tauri build

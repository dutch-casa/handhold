#!/usr/bin/env bash
# Downloads sidecar binaries (koko) for a given target triple.
# Used by the release CI and for local development setup.
#
# Usage:
#   ./scripts/download-sidecars.sh                    # auto-detect host triple
#   ./scripts/download-sidecars.sh aarch64-apple-darwin  # explicit triple
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="$PROJECT_ROOT/src-tauri/binaries"

if [[ $# -ge 1 ]]; then
  TARGET_TRIPLE="$1"
else
  TARGET_TRIPLE="$(rustc --print host-tuple)"
fi

echo "Target: $TARGET_TRIPLE"
echo "Binaries: $BIN_DIR"
echo ""

mkdir -p "$BIN_DIR"

# --- Koko (Kokoro TTS compiled binary) ---
if [[ "$TARGET_TRIPLE" == *"windows"* ]]; then
  KOKO_BIN="$BIN_DIR/koko-${TARGET_TRIPLE}.exe"
else
  KOKO_BIN="$BIN_DIR/koko-${TARGET_TRIPLE}"
fi

if [[ -x "$KOKO_BIN" ]]; then
  echo "koko already present, skipping."
else
  # TODO: Replace with actual download URL when koko binaries are hosted.
  # For now, koko must be built locally and placed at:
  #   src-tauri/binaries/koko-<target-triple>
  #
  # Example (local build):
  #   cd ../koko && cargo build --release
  #   cp target/release/koko ../handhold/src-tauri/binaries/koko-aarch64-apple-darwin
  echo "WARNING: koko binary not found at $KOKO_BIN"
  echo "  Build koko locally and copy it to src-tauri/binaries/koko-${TARGET_TRIPLE}"
  echo "  See README.md for instructions."
  echo ""
  echo "Creating placeholder so the Tauri build script doesn't fail..."
  touch "$KOKO_BIN"
  chmod +x "$KOKO_BIN"
fi

echo ""
echo "Sidecar setup complete."
ls -lh "$BIN_DIR"

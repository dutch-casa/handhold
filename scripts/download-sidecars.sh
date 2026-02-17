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
REPO="dutch-casa/handhold"
RELEASE_TAG="koko-binaries"

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
  ASSET_NAME="koko-${TARGET_TRIPLE}.exe"
else
  KOKO_BIN="$BIN_DIR/koko-${TARGET_TRIPLE}"
  ASSET_NAME="koko-${TARGET_TRIPLE}"
fi

if [[ -x "$KOKO_BIN" ]] && [[ -s "$KOKO_BIN" ]]; then
  echo "koko already present, skipping."
else
  echo "Downloading koko for ${TARGET_TRIPLE}..."
  if gh release download "$RELEASE_TAG" \
    --repo "$REPO" \
    --pattern "$ASSET_NAME" \
    --dir "$BIN_DIR" \
    --clobber 2>/dev/null; then
    chmod +x "$KOKO_BIN"
    echo "Downloaded koko ($(du -h "$KOKO_BIN" | cut -f1) )"
  else
    echo "WARNING: koko binary not available for ${TARGET_TRIPLE}"
    echo "  Upload it to the '${RELEASE_TAG}' release on ${REPO}"
    echo "  Creating placeholder so the Tauri build script doesn't fail..."
    touch "$KOKO_BIN"
    chmod +x "$KOKO_BIN"
  fi
fi

echo ""
echo "Sidecar setup complete."
ls -lh "$BIN_DIR"

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

# --- TTS Models (ONNX model + voices — platform-independent) ---
MODELS_DIR="$PROJECT_ROOT/src-tauri/resources/models"
ONNX_URL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
VOICES_URL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"

mkdir -p "$MODELS_DIR"

if [[ -f "$MODELS_DIR/kokoro-v1.0.onnx" ]] && [[ -s "$MODELS_DIR/kokoro-v1.0.onnx" ]]; then
  echo "kokoro-v1.0.onnx already present, skipping."
else
  echo "Downloading kokoro-v1.0.onnx (~325 MB)..."
  curl -fSL "$ONNX_URL" -o "$MODELS_DIR/kokoro-v1.0.onnx"
  echo "Downloaded ($(du -h "$MODELS_DIR/kokoro-v1.0.onnx" | cut -f1))"
fi

if [[ -f "$MODELS_DIR/voices-v1.0.bin" ]] && [[ -s "$MODELS_DIR/voices-v1.0.bin" ]]; then
  echo "voices-v1.0.bin already present, skipping."
else
  echo "Downloading voices-v1.0.bin (~27 MB)..."
  curl -fSL "$VOICES_URL" -o "$MODELS_DIR/voices-v1.0.bin"
  echo "Downloaded ($(du -h "$MODELS_DIR/voices-v1.0.bin" | cut -f1))"
fi

echo ""
echo "Sidecar setup complete."
echo ""
echo "Binaries:"
ls -lh "$BIN_DIR"
echo ""
echo "Models:"
ls -lh "$MODELS_DIR"

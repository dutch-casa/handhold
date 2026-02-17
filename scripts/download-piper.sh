#!/usr/bin/env bash
# Downloads Piper TTS binary + voice model for Tauri sidecar bundling.
# Idempotent: skips files that already exist.
#
# The official macOS piper releases omit dylibs, so we pull them from
# the piper-phonemize release. Both are x86_64 on macOS (runs via Rosetta).
set -euo pipefail

PIPER_VERSION="2023.11.14-2"
PHONEMIZE_VERSION="2023.11.14-4"
PIPER_BASE_URL="https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}"
PHONEMIZE_BASE_URL="https://github.com/rhasspy/piper-phonemize/releases/download/${PHONEMIZE_VERSION}"
HF_BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_DIR="$PROJECT_ROOT/src-tauri"
BIN_DIR="$TAURI_DIR/binaries"
RES_DIR="$TAURI_DIR/resources/piper"

TARGET_TRIPLE="$(rustc --print host-tuple)"

# Map target triple to release artifacts.
# macOS releases are x86_64 regardless of label (runs under Rosetta on ARM).
case "$TARGET_TRIPLE" in
  aarch64-apple-darwin)
    PIPER_TARBALL="piper_macos_aarch64.tar.gz"
    PHONEMIZE_TARBALL="piper-phonemize_macos_aarch64.tar.gz"
    ;;
  x86_64-apple-darwin)
    PIPER_TARBALL="piper_macos_x64.tar.gz"
    PHONEMIZE_TARBALL="piper-phonemize_macos_x64.tar.gz"
    ;;
  x86_64-unknown-linux-gnu)
    PIPER_TARBALL="piper_linux_x86_64.tar.gz"
    PHONEMIZE_TARBALL=""  # Linux piper release includes .so files
    ;;
  x86_64-pc-windows-msvc)
    PIPER_TARBALL="piper_windows_amd64.zip"
    PHONEMIZE_TARBALL=""
    ;;
  *)
    echo "Unsupported target: $TARGET_TRIPLE" >&2
    exit 1
    ;;
esac

PIPER_BIN="$BIN_DIR/piper-${TARGET_TRIPLE}"
MODEL_FILE="$RES_DIR/en_US-lessac-medium.onnx"
MODEL_JSON="$RES_DIR/en_US-lessac-medium.onnx.json"

mkdir -p "$BIN_DIR" "$RES_DIR/lib"

# --- Piper binary + runtime ---

if [[ -x "$PIPER_BIN" && -d "$RES_DIR/espeak-ng-data" && -n "$(ls "$RES_DIR/lib/"*.dylib 2>/dev/null || ls "$RES_DIR/lib/"*.so 2>/dev/null || true)" ]]; then
  echo "Piper binary and runtime already present, skipping."
else
  WORK="$(mktemp -d)"
  trap 'rm -rf "$WORK"' EXIT

  # -- Download and extract piper --
  echo "Downloading $PIPER_TARBALL ..."
  curl -L --fail --progress-bar \
    "${PIPER_BASE_URL}/${PIPER_TARBALL}" \
    -o "$WORK/$PIPER_TARBALL"

  echo "Extracting piper ..."
  if [[ "$PIPER_TARBALL" == *.zip ]]; then
    unzip -q "$WORK/$PIPER_TARBALL" -d "$WORK"
  else
    tar -xzf "$WORK/$PIPER_TARBALL" -C "$WORK"
  fi

  PIPER_EXTRACTED="$WORK/piper"

  # Binary with Tauri target-triple suffix
  cp "$PIPER_EXTRACTED/piper" "$PIPER_BIN"
  chmod +x "$PIPER_BIN"

  # espeak-ng-data
  cp -R "$PIPER_EXTRACTED/espeak-ng-data" "$RES_DIR/"

  # .ort model file
  for f in "$PIPER_EXTRACTED"/*.ort; do
    [[ -f "$f" ]] && cp "$f" "$RES_DIR/lib/"
  done

  # Linux releases bundle .so files alongside the binary
  for f in "$PIPER_EXTRACTED"/*.so "$PIPER_EXTRACTED"/*.so.*; do
    [[ -f "$f" ]] && cp "$f" "$RES_DIR/lib/"
  done

  # -- macOS: dylibs come from piper-phonemize release --
  if [[ -n "$PHONEMIZE_TARBALL" ]]; then
    echo "Downloading $PHONEMIZE_TARBALL (for dylibs) ..."
    curl -L --fail --progress-bar \
      "${PHONEMIZE_BASE_URL}/${PHONEMIZE_TARBALL}" \
      -o "$WORK/$PHONEMIZE_TARBALL"

    echo "Extracting piper-phonemize ..."
    tar -xzf "$WORK/$PHONEMIZE_TARBALL" -C "$WORK"

    PP_EXTRACTED="$WORK/piper-phonemize"

    # Copy only real dylib files, then recreate symlinks.
    # Without this, cp follows symlinks and writes 3 copies of each lib (~50 MB waste).
    for f in "$PP_EXTRACTED"/lib/*.dylib; do
      [[ -L "$f" ]] && continue  # skip symlinks
      [[ -f "$f" ]] && cp "$f" "$RES_DIR/lib/"
    done
    # Recreate the symlinks that the dynamic linker expects.
    (cd "$RES_DIR/lib" && for f in "$PP_EXTRACTED"/lib/*.dylib; do
      [[ -L "$f" ]] || continue
      ln -sf "$(basename "$(readlink "$f")")" "$(basename "$f")"
    done)

    # .ort model from phonemize — skip if already copied from piper archive
    for f in "$PP_EXTRACTED"/share/*.ort; do
      local_name="$RES_DIR/lib/$(basename "$f")"
      [[ -f "$f" && ! -f "$local_name" ]] && cp "$f" "$local_name"
    done
  fi

  echo "Piper binary installed: $PIPER_BIN"
fi

# --- Voice model ---

if [[ -f "$MODEL_FILE" ]]; then
  echo "Voice model already present, skipping."
else
  echo "Downloading en_US-lessac-medium.onnx ..."
  curl -L --fail --progress-bar \
    "${HF_BASE_URL}/en_US-lessac-medium.onnx" \
    -o "$MODEL_FILE"
fi

if [[ -f "$MODEL_JSON" ]]; then
  echo "Voice model config already present, skipping."
else
  echo "Downloading en_US-lessac-medium.onnx.json ..."
  curl -L --fail --progress-bar \
    "${HF_BASE_URL}/en_US-lessac-medium.onnx.json" \
    -o "$MODEL_JSON"
fi

echo ""
echo "Done. Binary: $PIPER_BIN"
echo "Resources:    $RES_DIR"
echo "Libs:         $RES_DIR/lib/"
ls "$RES_DIR/lib/"

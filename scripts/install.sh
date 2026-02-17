#!/usr/bin/env bash
# One-shot dev environment setup for Handhold.
# Run from the project root: bash scripts/install.sh
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${BOLD}$1${NC}"; }
ok()    { echo -e "${GREEN}  ok${NC} $1"; }
warn()  { echo -e "${YELLOW}  !!${NC} $1"; }
fail()  { echo -e "${RED}  MISSING${NC} $1"; MISSING=1; }

MISSING=0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
info "Handhold dev setup"
echo "---"
echo ""

# ── Check prerequisites ──────────────────────────────────────────────

info "Checking prerequisites..."
echo ""

# Rust
if command -v rustc &>/dev/null; then
  ok "rust $(rustc --version | awk '{print $2}')"
else
  fail "rust — install from https://www.rust-lang.org/tools/install"
fi

# Cargo
if command -v cargo &>/dev/null; then
  ok "cargo"
else
  fail "cargo — comes with rustup"
fi

# Bun
if command -v bun &>/dev/null; then
  ok "bun $(bun --version)"
else
  fail "bun — install from https://bun.sh"
fi

# Container runtime (podman or docker)
if command -v podman &>/dev/null; then
  ok "podman $(podman --version | awk '{print $3}')"
elif command -v docker &>/dev/null; then
  ok "docker $(docker --version | awk '{print $3}' | tr -d ',')"
else
  fail "podman or docker — install from https://podman.io or https://docs.docker.com/get-docker/"
fi

# Tauri CLI
if cargo install --list 2>/dev/null | grep -q "^tauri-cli"; then
  ok "tauri-cli"
else
  warn "tauri-cli not found — will install"
fi

echo ""

# ── Platform-specific deps ────────────────────────────────────────────

OS="$(uname -s)"

if [[ "$OS" == "Darwin" ]]; then
  info "Checking macOS dependencies..."
  if xcode-select -p &>/dev/null; then
    ok "xcode command line tools"
  else
    warn "installing xcode command line tools..."
    xcode-select --install 2>/dev/null || warn "xcode-select --install may need manual confirmation"
  fi
elif [[ "$OS" == "Linux" ]]; then
  info "Checking Linux dependencies..."
  LINUX_DEPS=(
    libwebkit2gtk-4.1-dev
    libappindicator3-dev
    librsvg2-dev
    patchelf
    build-essential
    curl
    wget
    file
    libssl-dev
    libgtk-3-dev
  )
  NEED_INSTALL=()
  for pkg in "${LINUX_DEPS[@]}"; do
    if dpkg -s "$pkg" &>/dev/null; then
      ok "$pkg"
    else
      NEED_INSTALL+=("$pkg")
    fi
  done
  if [[ ${#NEED_INSTALL[@]} -gt 0 ]]; then
    info "Installing missing packages: ${NEED_INSTALL[*]}"
    sudo apt-get update -qq
    sudo apt-get install -y "${NEED_INSTALL[@]}"
  fi
fi

echo ""

if [[ $MISSING -eq 1 ]]; then
  echo -e "${RED}${BOLD}Missing prerequisites above. Install them and re-run this script.${NC}"
  exit 1
fi

# ── Install everything ────────────────────────────────────────────────

info "Installing Tauri CLI..."
if cargo install --list 2>/dev/null | grep -q "^tauri-cli"; then
  ok "already installed"
else
  cargo install tauri-cli --version "^2" --locked
  ok "tauri-cli installed"
fi

echo ""
info "Installing frontend dependencies..."
cd "$PROJECT_ROOT"
bun install
ok "bun install"

echo ""
info "Downloading sidecar binaries..."
bash "$PROJECT_ROOT/scripts/download-sidecars.sh"

echo ""
info "Verifying Rust build..."
cd "$PROJECT_ROOT/src-tauri"
cargo check
ok "cargo check passed"

echo ""
echo "---"
info "Done. Run 'bun tauri dev' to start."
echo ""

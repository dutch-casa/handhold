#!/usr/bin/env bash
# Cross-platform Handhold installer.
# End-user: downloads the latest release, checks optional deps, handles Gatekeeper.
# Dev mode: --dev flag installs Rust, Bun, Tauri CLI, and build dependencies.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/dutch-casa/handhold/main/scripts/install-handhold.sh | bash
#   bash scripts/install-handhold.sh --dev
set -euo pipefail

REPO="dutch-casa/handhold"
APP_NAME="Handhold"

# ── ANSI ────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── Platform detection + header (before function defs so output is immediate) ──

OS="$(uname -s)"
ARCH="$(uname -m)"
DEV_MODE=0

for arg in "$@"; do
  case "$arg" in
    --dev) DEV_MODE=1 ;;
  esac
done

case "$OS" in
  Darwin) PLATFORM="macos" ;;
  Linux)  PLATFORM="linux" ;;
  *)      printf "\n  ${RED}✗ Unsupported OS: %s${NC}\n\n" "$OS" >&2; exit 1 ;;
esac

case "$ARCH" in
  arm64|aarch64) ARCH_TAG="aarch64" ;;
  x86_64|AMD64)  ARCH_TAG="amd64" ;;
  *)             printf "\n  ${RED}✗ Unsupported architecture: %s${NC}\n\n" "$ARCH" >&2; exit 1 ;;
esac

PLATFORM_LABEL="$PLATFORM"
[[ "$PLATFORM" == "macos" && "$ARCH_TAG" == "aarch64" ]] && PLATFORM_LABEL="macOS (Apple Silicon)"
[[ "$PLATFORM" == "macos" && "$ARCH_TAG" == "amd64" ]]   && PLATFORM_LABEL="macOS (Intel)"
[[ "$PLATFORM" == "linux" && "$ARCH_TAG" == "amd64" ]]   && PLATFORM_LABEL="Linux (x86_64)"
[[ "$PLATFORM" == "linux" && "$ARCH_TAG" == "aarch64" ]] && PLATFORM_LABEL="Linux (ARM64)"

# Print header immediately — user sees output within milliseconds, not after
# all function definitions are parsed.
printf "\n"
printf "  ${BOLD}Handhold Installer${NC}"
[[ $DEV_MODE -eq 1 ]] && printf "  ${DIM}(dev mode)${NC}"
printf "\n"
printf "  ──────────────────────────\n"
printf "\n"
printf "  ${DIM}Platform${NC}    %s\n" "$PLATFORM_LABEL"

# ── Helpers ─────────────────────────────────────────────────────────────

ok()   { printf "    ${GREEN}✓${NC} %s\n" "$1"; }
warn() { printf "    ${YELLOW}~${NC} %s\n" "$1"; }
fail() { printf "    ${RED}✗${NC} %s\n" "$1"; }
info() { printf "\n  ${BOLD}%s${NC}\n" "$1"; }
die()  { printf "\n  ${RED}✗ %s${NC}\n\n" "$1" >&2; exit 1; }

prompt_yn() {
  local msg="$1" default="${2:-y}"
  local hint="[Y/n]"
  [[ "$default" == "n" ]] && hint="[y/N]"
  printf "\n  ${BOLD}▸${NC} %s %s " "$msg" "$hint"

  if [[ -t 0 ]]; then
    read -r answer
  elif [[ -e /dev/tty ]]; then
    read -r answer </dev/tty
  else
    answer=""
  fi

  answer="${answer:-$default}"
  case "$answer" in
    [Yy]*) return 0 ;;
    *)     return 1 ;;
  esac
}

prompt_choice() {
  local msg="$1"
  shift
  local options=("$@")
  printf "\n  ${BOLD}▸${NC} %s\n" "$msg"
  for i in "${!options[@]}"; do
    printf "    ${BOLD}%d)${NC} %s\n" "$((i + 1))" "${options[$i]}"
  done
  printf "  ${DIM}Enter choice [1-%d]:${NC} " "${#options[@]}"

  if [[ -t 0 ]]; then
    read -r choice
  elif [[ -e /dev/tty ]]; then
    read -r choice </dev/tty
  else
    choice="1"
  fi

  choice="${choice:-1}"
  echo "$choice"
}

# ── Dependency checks ───────────────────────────────────────────────────

SKIPPED_DEPS=()

check_git() {
  if command -v git &>/dev/null; then
    local ver
    ver="$(git --version | awk '{print $3}')"
    ok "Git $ver"
  else
    warn "Git — not found"
    if [[ "$PLATFORM" == "macos" ]]; then
      if prompt_yn "Install Git via Xcode Command Line Tools?"; then
        printf "    ${DIM}Installing (this may take a few minutes)...${NC}\n"
        xcode-select --install 2>/dev/null || true
        # xcode-select --install opens a GUI dialog on macOS.
        # We can't block on it, so just note it.
        printf "    ${YELLOW}~${NC} Xcode CLT installer launched — finish the dialog, then re-run this script.\n"
        exit 0
      else
        SKIPPED_DEPS+=("Git")
      fi
    elif [[ "$PLATFORM" == "linux" ]]; then
      if prompt_yn "Install Git?"; then
        if install_linux_package git; then
          ok "Git installed"
        else
          SKIPPED_DEPS+=("Git")
        fi
      else
        SKIPPED_DEPS+=("Git")
      fi
    fi
  fi
}

check_container_runtime() {
  if command -v podman &>/dev/null; then
    local ver
    ver="$(podman --version 2>/dev/null | awk '{print $3}')"
    ok "Podman $ver"
    return
  fi
  if command -v docker &>/dev/null; then
    local ver
    ver="$(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')"
    ok "Docker $ver"
    return
  fi

  warn "Container runtime — not found ${DIM}(needed for labs only)${NC}"

  if prompt_yn "Install a container runtime? (labs need Docker or Podman)" "n"; then
    local choice_num
    choice_num=$(prompt_choice "Which container runtime?" "Podman (recommended)" "Docker")

    case "$choice_num" in
      1) install_podman ;;
      2) install_docker ;;
      *) install_podman ;;
    esac
  else
    SKIPPED_DEPS+=("Container runtime (Docker/Podman)")
  fi
}

install_podman() {
  printf "    ${DIM}Installing Podman...${NC}\n"
  if [[ "$PLATFORM" == "macos" ]]; then
    ensure_homebrew
    brew install podman 2>&1 | tail -1
  elif [[ "$PLATFORM" == "linux" ]]; then
    install_linux_package podman
  fi
  if command -v podman &>/dev/null; then
    ok "Podman $(podman --version 2>/dev/null | awk '{print $3}')"
  else
    fail "Podman installation may need a terminal restart"
  fi
}

install_docker() {
  printf "    ${DIM}Installing Docker...${NC}\n"
  if [[ "$PLATFORM" == "macos" ]]; then
    ensure_homebrew
    brew install --cask docker 2>&1 | tail -1
    ok "Docker Desktop installed — launch it from Applications to finish setup"
  elif [[ "$PLATFORM" == "linux" ]]; then
    # Docker's official convenience script
    if prompt_yn "Use Docker's install script (get.docker.com)?"; then
      curl -fsSL https://get.docker.com | sh
      ok "Docker installed"
    else
      fail "Install Docker manually: https://docs.docker.com/engine/install/"
      SKIPPED_DEPS+=("Docker")
    fi
  fi
}

ensure_homebrew() {
  if command -v brew &>/dev/null; then
    return
  fi
  printf "    ${DIM}Homebrew not found — installing...${NC}\n"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Homebrew may not be on PATH yet in this shell session
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

install_linux_package() {
  local pkg="$1"
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y "$pkg"
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y "$pkg"
  elif command -v pacman &>/dev/null; then
    sudo pacman -S --noconfirm "$pkg"
  else
    fail "No supported package manager found. Install $pkg manually."
    return 1
  fi
}

# ── Dev-mode dependency checks ──────────────────────────────────────────

check_rust() {
  if command -v rustc &>/dev/null; then
    ok "Rust $(rustc --version | awk '{print $2}')"
  else
    warn "Rust — not found"
    if prompt_yn "Install Rust via rustup?"; then
      curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
      # Source cargo env for this session
      # shellcheck disable=SC1091
      [[ -f "$HOME/.cargo/env" ]] && source "$HOME/.cargo/env"
      ok "Rust $(rustc --version | awk '{print $2}')"
    else
      die "Rust is required for dev mode."
    fi
  fi
}

check_bun() {
  if command -v bun &>/dev/null; then
    ok "Bun $(bun --version)"
  else
    warn "Bun — not found"
    if prompt_yn "Install Bun?"; then
      curl -fsSL https://bun.sh/install | bash
      # Source bun for this session
      export BUN_INSTALL="$HOME/.bun"
      export PATH="$BUN_INSTALL/bin:$PATH"
      ok "Bun $(bun --version)"
    else
      die "Bun is required for dev mode."
    fi
  fi
}

check_tauri_cli() {
  if cargo install --list 2>/dev/null | grep -q "^tauri-cli"; then
    ok "Tauri CLI"
  else
    printf "    ${DIM}Installing Tauri CLI...${NC}\n"
    cargo install tauri-cli --version "^2" --locked
    ok "Tauri CLI"
  fi
}

check_macos_dev_deps() {
  if xcode-select -p &>/dev/null; then
    ok "Xcode Command Line Tools"
  else
    printf "    ${DIM}Installing Xcode Command Line Tools...${NC}\n"
    xcode-select --install 2>/dev/null || true
    printf "    ${YELLOW}~${NC} Finish the Xcode CLT dialog, then re-run with --dev.\n"
    exit 0
  fi

  ensure_homebrew
  for pkg in pkg-config opus cmake; do
    if brew list "$pkg" &>/dev/null; then
      ok "$pkg"
    else
      printf "    ${DIM}Installing $pkg...${NC}\n"
      brew install "$pkg"
      ok "$pkg"
    fi
  done
}

check_linux_dev_deps() {
  local deps=(
    libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
    build-essential curl wget file libssl-dev libgtk-3-dev
    pkg-config cmake clang libopus-dev
  )
  local missing=()
  for pkg in "${deps[@]}"; do
    if dpkg -s "$pkg" &>/dev/null 2>&1; then
      ok "$pkg"
    else
      missing+=("$pkg")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    printf "    ${DIM}Installing ${#missing[@]} missing packages...${NC}\n"
    sudo apt-get update -qq
    sudo apt-get install -y "${missing[@]}"
    ok "${#missing[@]} packages installed"
  fi
}

# ── Run dependency checks ───────────────────────────────────────────────

info "Checking dependencies..."

check_git
check_container_runtime

if [[ $DEV_MODE -eq 1 ]]; then
  info "Checking dev dependencies..."
  check_rust
  check_bun
  if [[ "$PLATFORM" == "macos" ]]; then
    check_macos_dev_deps
  elif [[ "$PLATFORM" == "linux" ]]; then
    check_linux_dev_deps
  fi
  check_tauri_cli
fi

# ── Fetch latest release ────────────────────────────────────────────────

info "Fetching latest release..."

RELEASE_JSON="$(curl -sfL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null)" \
  || die "Failed to fetch release info. Check your internet connection."

VERSION="$(printf '%s' "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')"
[[ -z "${VERSION:-}" ]] && die "No releases found. The project may not have published a release yet."

VER_NUM="${VERSION#v}"
printf "  ${DIM}Version${NC}     %s\n" "$VERSION"

# ── Resolve asset ───────────────────────────────────────────────────────

case "$PLATFORM" in
  macos)
    ASSET="Handhold_${VER_NUM}_${ARCH_TAG}.dmg"
    ;;
  linux)
    ASSET="handhold_${VER_NUM}_${ARCH_TAG}.deb"
    if ! printf '%s' "$RELEASE_JSON" | grep -q "\"name\": \"$ASSET\""; then
      ASSET="handhold_${VER_NUM}_${ARCH_TAG}.AppImage"
    fi
    ;;
esac

DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/$ASSET"
DEST="/tmp/$ASSET"

# ── Download with progress ──────────────────────────────────────────────

info "Downloading $ASSET..."
printf "\n"

# curl --progress-bar shows a clean # progress line
curl -fSL --progress-bar "$DOWNLOAD_URL" -o "$DEST" \
  || die "Download failed. Asset may not exist for $PLATFORM_LABEL.\n  Check: https://github.com/$REPO/releases/tag/$VERSION"

FILE_SIZE="$(du -h "$DEST" | cut -f1 | xargs)"
ok "Downloaded ($FILE_SIZE)"

# ── Install ─────────────────────────────────────────────────────────────

info "Installing..."

case "$PLATFORM" in
  macos)
    MOUNT_DIR="$(hdiutil attach "$DEST" -nobrowse 2>/dev/null | tail -1 | awk -F'\t' '{print $NF}')" \
      || die "Failed to mount disk image."
    [[ -d "$MOUNT_DIR" ]] || die "Failed to mount disk image — mount point not found."

    APP_SRC="$MOUNT_DIR/$APP_NAME.app"
    APP_DEST="/Applications/$APP_NAME.app"

    if [[ -d "$APP_DEST" ]]; then
      printf "    ${DIM}Replacing existing installation...${NC}\n"
      rm -rf "$APP_DEST" 2>/dev/null || sudo rm -rf "$APP_DEST"
    fi

    cp -R "$APP_SRC" "$APP_DEST" 2>/dev/null || sudo cp -R "$APP_SRC" "$APP_DEST"
    hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
    rm -f "$DEST"

    ok "Installed to /Applications/$APP_NAME.app"

    # Gatekeeper: strip quarantine xattr so macOS doesn't block the unsigned app.
    printf "    ${DIM}Clearing macOS quarantine flag...${NC}\n"
    printf "    ${DIM}(Handhold is open-source but not notarized by Apple)${NC}\n"
    if xattr -cr "$APP_DEST" 2>/dev/null; then
      ok "Quarantine cleared — app will open without warnings"
    elif sudo xattr -cr "$APP_DEST" 2>/dev/null; then
      ok "Quarantine cleared (via sudo)"
    else
      warn "Could not clear quarantine automatically."
      printf "      To fix: Right-click Handhold.app → Open → click \"Open\" in the dialog\n"
      printf "      Or run: ${BOLD}sudo xattr -cr /Applications/Handhold.app${NC}\n"
    fi
    ;;

  linux)
    if [[ "$ASSET" == *.deb ]]; then
      if command -v apt &>/dev/null; then
        sudo apt install -y "$DEST"
      else
        sudo dpkg -i "$DEST"
      fi
      rm -f "$DEST"
      ok "Installed via .deb package"
    else
      INSTALL_DIR="${HOME}/.local/bin"
      mkdir -p "$INSTALL_DIR"
      mv "$DEST" "$INSTALL_DIR/handhold"
      chmod +x "$INSTALL_DIR/handhold"
      ok "Installed to $INSTALL_DIR/handhold"

      if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        warn "~/.local/bin is not on your PATH."
        printf "      Add this to your shell profile:\n"
        printf "      ${BOLD}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}\n"
      fi
    fi
    ;;
esac

# ── Dev mode post-install ───────────────────────────────────────────────

if [[ $DEV_MODE -eq 1 ]]; then
  info "Setting up dev environment..."

  if [[ -z "${BASH_SOURCE[0]:-}" ]]; then
    warn "Dev mode requires running the script directly, not via pipe."
    printf "      Download: ${BOLD}curl -fSL https://raw.githubusercontent.com/$REPO/main/scripts/install-handhold.sh -o install-handhold.sh${NC}\n"
    printf "      Then run: ${BOLD}bash install-handhold.sh --dev${NC}\n"
  else

  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

  if [[ -f "$PROJECT_ROOT/package.json" ]]; then
    printf "    ${DIM}Installing frontend dependencies...${NC}\n"
    cd "$PROJECT_ROOT" && bun install
    ok "bun install"

    printf "    ${DIM}Downloading sidecar binaries...${NC}\n"
    bash "$PROJECT_ROOT/scripts/download-sidecars.sh"
    ok "Sidecars downloaded"

    printf "    ${DIM}Verifying Rust build...${NC}\n"
    cd "$PROJECT_ROOT/src-tauri" && cargo check
    ok "cargo check passed"
  else
    warn "Not in the Handhold repo — skipping bun install / cargo check."
    printf "      Clone the repo first: ${BOLD}git clone https://github.com/$REPO.git${NC}\n"
    printf "      Then run: ${BOLD}bash scripts/install-handhold.sh --dev${NC}\n"
  fi

  fi # end BASH_SOURCE guard
fi

# ── Done ────────────────────────────────────────────────────────────────

printf "\n"
printf "  ──────────────────────────\n"
printf "  ${GREEN}${BOLD}Done!${NC}\n"
printf "\n"

case "$PLATFORM" in
  macos)
    printf "  Launch with:\n"
    printf "    ${BOLD}open /Applications/Handhold.app${NC}\n"
    printf "  Or find ${BOLD}Handhold${NC} in Spotlight.\n"
    ;;
  linux)
    printf "  Launch with:\n"
    printf "    ${BOLD}handhold${NC}\n"
    ;;
esac

if [[ ${#SKIPPED_DEPS[@]} -gt 0 ]]; then
  printf "\n"
  printf "  ${YELLOW}Note:${NC} Skipped optional dependencies:\n"
  for dep in "${SKIPPED_DEPS[@]}"; do
    printf "    ${DIM}•${NC} %s\n" "$dep"
  done
  printf "  Labs that need containers won't work until you install Docker or Podman.\n"
fi

if [[ $DEV_MODE -eq 1 ]]; then
  printf "\n  Start developing:\n"
  printf "    ${BOLD}cd handhold && bun tauri dev${NC}\n"
fi

printf "\n"

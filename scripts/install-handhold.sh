#!/usr/bin/env bash
# Install Handhold from the latest GitHub release.
# No build tools needed — downloads the pre-built binary for your platform.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/dutch-casa/handhold/main/scripts/install-handhold.sh | bash
set -euo pipefail

REPO="dutch-casa/handhold"

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

die() { echo -e "${RED}error:${NC} $1" >&2; exit 1; }

# --- Detect platform ---

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) PLATFORM="macos" ;;
  Linux)  PLATFORM="linux" ;;
  *)      die "Unsupported OS: $OS. Download manually from https://github.com/$REPO/releases" ;;
esac

case "$ARCH" in
  arm64|aarch64) ARCH_TAG="aarch64" ;;
  x86_64)        ARCH_TAG="amd64" ;;
  *)             die "Unsupported architecture: $ARCH" ;;
esac

echo -e "${BOLD}Installing Handhold${NC} ($PLATFORM $ARCH_TAG)"
echo ""

# --- Fetch latest release ---

echo -e "${DIM}Fetching latest release...${NC}"

RELEASE_JSON="$(curl -sfL "https://api.github.com/repos/$REPO/releases/latest" 2>/dev/null)" \
  || die "Failed to fetch release info. Check your internet connection."

VERSION="$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')"
if [[ -z "$VERSION" ]]; then
  die "No releases found. The project may not have published a release yet."
fi

# Strip leading 'v' for asset filenames
VER_NUM="${VERSION#v}"

echo -e "  Latest release: ${GREEN}$VERSION${NC}"

# --- Resolve asset URL ---

case "$PLATFORM" in
  macos)
    ASSET="Handhold_${VER_NUM}_${ARCH_TAG}.dmg"
    ;;
  linux)
    # Prefer .deb, fall back to .AppImage
    ASSET="handhold_${VER_NUM}_${ARCH_TAG}.deb"
    if ! echo "$RELEASE_JSON" | grep -q "\"name\": \"$ASSET\""; then
      ASSET="handhold_${VER_NUM}_${ARCH_TAG}.AppImage"
    fi
    ;;
esac

DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/$ASSET"
DEST="/tmp/$ASSET"

echo -e "  Downloading ${DIM}$ASSET${NC}..."
curl -fSL "$DOWNLOAD_URL" -o "$DEST" \
  || die "Download failed. Asset might not exist for your platform yet.\n  Check: https://github.com/$REPO/releases/tag/$VERSION"

echo -e "  ${GREEN}Downloaded${NC} ($(du -h "$DEST" | cut -f1))"
echo ""

# --- Install ---

case "$PLATFORM" in
  macos)
    echo -e "${DIM}Mounting disk image...${NC}"
    MOUNT_DIR="$(hdiutil attach "$DEST" -nobrowse 2>/dev/null | tail -1 | awk '{print $NF}')" \
      || die "Failed to mount $ASSET"

    APP_SRC="$MOUNT_DIR/Handhold.app"
    APP_DEST="/Applications/Handhold.app"

    if [[ -d "$APP_DEST" ]]; then
      echo -e "  Replacing existing installation..."
      rm -rf "$APP_DEST"
    fi

    cp -R "$APP_SRC" "$APP_DEST"
    hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
    rm -f "$DEST"

    echo -e "${GREEN}${BOLD}Installed${NC} to /Applications/Handhold.app"
    echo ""
    echo "  Launch: open /Applications/Handhold.app"
    echo "  Or find Handhold in Spotlight."
    ;;

  linux)
    if [[ "$ASSET" == *.deb ]]; then
      echo -e "${DIM}Installing .deb package...${NC}"
      if command -v apt &>/dev/null; then
        sudo apt install -y "$DEST"
      else
        sudo dpkg -i "$DEST"
      fi
      rm -f "$DEST"
      echo -e "${GREEN}${BOLD}Installed.${NC} Launch with: handhold"
    else
      # AppImage fallback
      INSTALL_DIR="${HOME}/.local/bin"
      mkdir -p "$INSTALL_DIR"
      mv "$DEST" "$INSTALL_DIR/handhold"
      chmod +x "$INSTALL_DIR/handhold"
      echo -e "${GREEN}${BOLD}Installed${NC} to $INSTALL_DIR/handhold"
      echo ""
      if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        echo "  Add to your PATH if not already:"
        echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
        echo ""
      fi
      echo "  Launch with: handhold"
    fi
    ;;
esac

echo ""

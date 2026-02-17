<div align="center">

# Handhold

Narrated, animated technical courses that run on your machine.

[![CI](https://github.com/dutch-casa/handhold/actions/workflows/ci.yml/badge.svg)](https://github.com/dutch-casa/handhold/actions/workflows/ci.yml)
[![Release](https://github.com/dutch-casa/handhold/actions/workflows/release.yml/badge.svg)](https://github.com/dutch-casa/handhold/actions/workflows/release.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)

</div>

---

Handhold is a desktop app for interactive programming courses. Each lesson is a narrated walkthrough where code, diagrams, and data structures animate in sync with spoken audio. Labs give you a real editor, real tests, and real services to build against.

## Install

One command. No Rust, no build tools, no dependencies.

```sh
curl -fsSL https://raw.githubusercontent.com/dutch-casa/handhold/main/scripts/install-handhold.sh | bash
```

This detects your OS and architecture, downloads the latest release from GitHub, and installs it. macOS gets a `.dmg` mounted to `/Applications`, Linux gets a `.deb` or `.AppImage`.

Windows users: download the `.msi` installer directly from the [releases page](https://github.com/dutch-casa/handhold/releases/latest).

### Container runtime (labs only)

Some labs spin up services like Postgres or Redis. These need [Podman](https://podman.io/docs/installation) or [Docker](https://docs.docker.com/get-docker/). Lessons never require containers.

If you open a lab that needs containers and none are installed, Handhold shows platform-specific install instructions and a retry button. You don't need to figure this out in advance.

---

## Development

Everything below is for contributors building Handhold from source.

Built with [Tauri 2](https://v2.tauri.app/) and [React 19](https://react.dev/).

### Prerequisites

| Dependency | Version | Purpose |
|---|---|---|
| [Rust](https://www.rust-lang.org/tools/install) | stable | Tauri backend |
| [Bun](https://bun.sh/) | >= 1.0 | Frontend dependencies and Vite |
| [Tauri CLI](https://v2.tauri.app/start/create-project/) | >= 2.0 | `cargo install tauri-cli --version "^2"` |
| [Podman](https://podman.io/docs/installation) or [Docker](https://docs.docker.com/get-docker/) | any | Lab services (Postgres, Redis, etc.) |

**macOS** -- Xcode Command Line Tools:

```sh
xcode-select --install
```

**Linux (Debian/Ubuntu)**:

```sh
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev
```

Other distros: see [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux).

**Windows** -- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (ships with Windows 11, manual install on Windows 10) and [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).

### Setup

```sh
git clone https://github.com/dutch-casa/handhold.git
cd handhold
bash scripts/install.sh
```

The install script checks prerequisites, installs frontend packages, downloads the TTS sidecar binary, and verifies the Rust build.

Handhold uses [Kokoro](https://github.com/hexgrad/kokoro) for text-to-speech. The `koko` binary must be built separately and placed in `src-tauri/binaries/koko-<target-triple>`. The install script tells you if it's missing.

### Run

```sh
bun tauri dev
```

Opens the app with hot reload. Frontend changes apply instantly; Rust changes trigger a recompile.

### Production build

```sh
bun tauri build
```

Outputs a platform-native installer (`.dmg`, `.AppImage`/`.deb`, or `.msi`).

### Project structure

```
handhold/
  src/                     React frontend
    types/                   IR types (lesson, course, lab)
    parser/                  Markdown -> typed IR
    code/                    Code primitive (Shiki + diff + animated lines)
    data/                    Data structure primitive (layout + SVG)
    diagram/                 Diagram primitive (topo-sort layout + SVG)
    preview/                 Live HTML/React preview (iframe)
    tts/                     TTS bridge (synthesize, audio player)
    presentation/            Playback engine (store, triggers, components)
  src-tauri/               Rust backend
    src/
      lib.rs                 App setup, menus, invoke handlers
      tts.rs                 Kokoro TTS backend
      container.rs           Podman/Docker orchestration for labs
      pty.rs                 Terminal emulation
      lsp.rs                 Language server protocol bridge
      db.rs                  SQLite persistence
  docs/                    Authoring guide
  scripts/                 Build and setup scripts
  .claude/skills/          Course authoring skill (for AI-assisted course creation)
```

### Course authoring

Courses are markdown files with an embedded DSL for triggers, animations, and visualization blocks. The full reference lives in two places:

- [`docs/authoring-guide.md`](docs/authoring-guide.md) -- quick-start guide
- [`.claude/skills/handhold-course-authoring/`](.claude/skills/handhold-course-authoring/SKILL.md) -- comprehensive skill for AI-assisted authoring

### Releasing

Push a version tag to trigger a cross-platform release build:

```sh
git tag v0.1.0
git push origin v0.1.0
```

Builds `.dmg` (macOS ARM + Intel), `.AppImage` + `.deb` (Linux), and `.msi` + `.exe` (Windows). Artifacts upload as a draft GitHub Release.

## License

[AGPL-3.0](LICENSE)

Copyright 2026 Dutch Casadaban.

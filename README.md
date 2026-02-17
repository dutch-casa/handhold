<div align="center">

# Handhold

Narrated, animated technical courses that run on your machine.

[![CI](https://github.com/dutch-casa/handhold/actions/workflows/ci.yml/badge.svg)](https://github.com/dutch-casa/handhold/actions/workflows/ci.yml)
[![Release](https://github.com/dutch-casa/handhold/actions/workflows/release.yml/badge.svg)](https://github.com/dutch-casa/handhold/actions/workflows/release.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)

</div>

---

Handhold is a desktop app for interactive programming courses. Each lesson is a narrated walkthrough where code, diagrams, and data structures animate in sync with spoken audio. Labs give the learner a real editor, real tests, and real services to build against.

Built with [Tauri 2](https://v2.tauri.app/) and [React 19](https://react.dev/).

## Prerequisites

Install these before cloning.

| Dependency | Version | What it does |
|---|---|---|
| [Rust](https://www.rust-lang.org/tools/install) | stable | Compiles the Tauri backend |
| [Bun](https://bun.sh/) | >= 1.0 | Installs frontend dependencies, runs Vite |
| [Podman](https://podman.io/docs/installation) or [Docker](https://docs.docker.com/get-docker/) | any | Runs lab services (Postgres, Redis, etc.) |
| [Tauri CLI](https://v2.tauri.app/start/create-project/) | >= 2.0 | `cargo install tauri-cli --version "^2"` |

### Platform-specific dependencies

**macOS**

Xcode Command Line Tools:

```sh
xcode-select --install
```

**Linux (Debian/Ubuntu)**

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

See the [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/#linux) for other distros.

**Windows**

[WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (ships with Windows 11, manual install on Windows 10). The [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) are also required.

## Getting started

```sh
git clone https://github.com/dutch-casa/handhold.git
cd handhold
bash scripts/install.sh
```

The install script checks for prerequisites, installs missing platform dependencies, sets up the Tauri CLI, installs frontend packages, downloads the TTS sidecar binary, and verifies the Rust build. One command, done.

Handhold uses [Kokoro](https://github.com/hexgrad/kokoro) for text-to-speech. The `koko` binary must be built separately and placed in `src-tauri/binaries/koko-<target-triple>`. The install script will tell you if it's missing.

### Development

```sh
bun tauri dev
```

Opens the app with hot reload. Frontend changes apply instantly, Rust changes trigger a recompile.

### Production build

```sh
bun tauri build
```

Outputs a platform-native installer (`.dmg`, `.AppImage`/`.deb`, or `.msi`).

## Project structure

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

## Course authoring

Courses are markdown files with an embedded DSL for triggers, animations, and visualization blocks. The full reference lives in two places:

- [`docs/authoring-guide.md`](docs/authoring-guide.md) -- quick-start guide
- [`.claude/skills/handhold-course-authoring/`](.claude/skills/handhold-course-authoring/SKILL.md) -- comprehensive skill for AI-assisted authoring

## Releasing

Pushing a version tag triggers a cross-platform release build via GitHub Actions:

```sh
git tag v0.1.0
git push origin v0.1.0
```

This builds `.dmg` (macOS ARM + Intel), `.AppImage` + `.deb` (Linux), and `.msi` + `.exe` (Windows). Artifacts are uploaded as a draft GitHub Release for review before publishing.

## License

[AGPL-3.0](LICENSE)

Copyright 2026 Dutch Casadaban.

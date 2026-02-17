# Handhold

An interactive course platform for Auburn University. Tauri desktop app. React frontend. Docker-backed labs. Narrated, animated presentations. Think effect.institute + hands-on coding environments.

Students learn through cinematic, narrated presentations — then immediately apply what they learned in real Docker-backed coding labs where tests gate their progression. No hand-holding (ironic name intended). No AI assistance. They figure it out or they don't move on.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Tauri App                            │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              React Frontend                       │   │
│  │                                                   │   │
│  │  ┌─────────────┐  ┌───────────────────────────┐  │   │
│  │  │  Lesson Nav  │  │   Presentation Engine     │  │   │
│  │  │  (sidebar)   │  │   - TTS + word triggers   │  │   │
│  │  │             │  │   - @handhold/code         │  │   │
│  │  │  step 1  ●  │  │   - @handhold/data         │  │   │
│  │  │  step 2  ○  │  │   - @handhold/diagram      │  │   │
│  │  │  step 3  ○  │  │                            │  │   │
│  │  │  step 4  ○  │  ├───────────────────────────┤  │   │
│  │  │             │  │   Lab Environment          │  │   │
│  │  │             │  │   - File explorer          │  │   │
│  │  │             │  │   - CodeMirror editor      │  │   │
│  │  │             │  │   - xterm.js terminal      │  │   │
│  │  └─────────────┘  └───────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Rust Backend (Tauri)                  │   │
│  │  - Docker engine interface                        │   │
│  │  - Filesystem operations                          │   │
│  │  - SQLite (progress, config)                      │   │
│  │  - GitHub org scanner                             │   │
│  │  - TTS engine bridge                              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐    ┌──────────────────────┐
│  GitHub Org      │    │  Docker Engine        │
│  (course repos)  │    │  (lab containers)     │
└─────────────────┘    └──────────────────────┘
```

---

## Users

**Students** — Consume courses. Watch presentations, complete labs, pass tests. Own their work.

**Instructors** — Author courses. Write presentation content, define animations, set up lab environments with tests. Publish to the GitHub org.

No admins. No grading. No LMS. Tests pass or they don't. The machine is the judge.

---

## Two Data Locations

### Course Definition: `.handhold/` in lesson repos

Lives inside each course repository in the GitHub org. Read-only from the student's perspective. This is the course material — what gets taught and how.

The presence of `.handhold/manifest.json` is what identifies a repo as a Handhold course. The Rust backend scans for this file. If it exists, the repo is a course.

### Student Data: `~/.handhold/` on the student's machine

The app's home directory. Everything the app needs to persist lives here. Students own this entirely.

```
~/.handhold/
├── config.json                     # app settings, configured GitHub org, preferences
├── db.sqlite                       # progress tracking, completion state
├── courses/
│   └── <course-slug>/
│       └── workspace/              # their actual project files, mounted into Docker
└── cache/
    └── repos/                      # cloned course definitions from GitHub
```

The `workspace/` folder is initialized from the course's starter files on first run. From then on, it's the student's. They can git init it, push it, show it off. Their work product.

---

## Course Structure

A course is an ordered sequence of **steps**. Each step is one of:

### Step Types

**`presentation`** — A narrated, animated slide. TTS reads the narration aloud. Animations fire at trigger points synchronized to specific words. Spacebar advances to the next step.

**`lab`** — A coding environment. Docker container running. File explorer, editor, terminal all connected to the container. Tests defined in the course must pass before the student can advance. Instructions live in the project files themselves (comments, INSTRUCTIONS.md, whatever the author decides).

That's it. Two step types. The author sequences them however makes sense for the subject matter.

A DSA course:
```
presentation → lab → presentation → lab → presentation → lab
```

A REST API course:
```
presentation → presentation → presentation → lab (one long build)
```

A git course:
```
presentation → lab → lab → lab → presentation → lab
```

### Container Persistence

Within a course, the Docker container persists across lab steps. The student's workspace accumulates. If they hack around a test in step 3, they'll pay for it in step 7. Consequences are real.

The container is rebuilt only when the author explicitly defines a new Dockerfile for a later step (e.g., switching from a Node environment to a Python one mid-course).

---

## Manifest Format

`.handhold/manifest.json` — the single source of truth for a course.

```jsonc
{
  "name": "Data Structures & Algorithms",
  "slug": "dsa-101",
  "description": "From arrays to graphs. Theory, then practice.",
  "authors": ["dutchcaz"],
  "version": "1.0.0",
  "prerequisites": [],           // slugs of courses that must be completed first

  "docker": {
    "dockerfile": "lab/Dockerfile",   // relative to .handhold/
    "ports": [3000, 5432],            // ports to expose from container
    "env": {}                          // environment variables
  },

  "steps": [
    {
      "id": "intro",
      "type": "presentation",
      "title": "What is a Linked List?",
      "narration": "narration/intro.md",         // text to be TTS'd
      "triggers": "triggers/intro.json",          // word-level animation triggers
      "visualization": {
        "type": "data",                           // uses @handhold/data
        "states": "states/intro-linked-list.json" // animation state snapshots
      }
    },
    {
      "id": "implement-insert",
      "type": "lab",
      "title": "Implement Insert",
      "tests": "lab/tests/insert.test.ts",        // tests that gate progression
      "testCommand": "bun test insert"             // command to run tests
    },
    {
      "id": "traversal-explained",
      "type": "presentation",
      "title": "Traversing a Linked List",
      "narration": "narration/traversal.md",
      "triggers": "triggers/traversal.json",
      "visualization": {
        "type": "code",                            // uses @handhold/code
        "states": "states/traversal-code.json"     // code snapshot pairs
      }
    },
    {
      "id": "implement-traversal",
      "type": "lab",
      "title": "Implement Traversal",
      "tests": "lab/tests/traversal.test.ts",
      "testCommand": "bun test traversal"
    }
  ]
}
```

All paths in the manifest are relative to `.handhold/`. The manifest is the only file the runtime needs to read to understand the entire course.

---

## Presentation Engine

This is the core of the product. It must feel cinematic — like watching a documentary about programming, not reading a slideshow.

### Layout

From the wireframe:

```
┌──────────────┬──────────────────────────────────────┐
│              │                                       │
│  Step list   │                                       │
│  (sidebar)   │     Visualization area                │
│              │                                       │
│  ● step 1   │     Code animation                    │
│  ○ step 2   │        OR                              │
│  ○ step 3   │     Data structure visualization       │
│  ○ step 4   │        OR                              │
│              │     System design diagram              │
│              │                                       │
│              │                                       │
│              │                                       │
│              │                                       │
│              │                                       │
└──────────────┴──────────────────────────────────────┘
                 ▲ narration audio plays
                 ▲ animations fire at word triggers
                 [spacebar] to advance
```

Left sidebar shows the step list with completion state. Right panel fills with the visualization for the current step. Narration audio plays. Dark theme. Minimal chrome. Content is king.

### TTS + Trigger Sync

The narration pipeline:

1. Author writes narration text in markdown (`.handhold/narration/<step>.md`)
2. At build time (or first playback), TTS engine converts text to audio and produces a **word timing map** — an array of `{ word, startMs, endMs }` for every word in the narration
3. Author defines triggers in `.handhold/triggers/<step>.json` — each trigger is a word index (or word range) mapped to an animation state change
4. At runtime, the presentation engine plays the audio and watches the clock. When the current time crosses a trigger's word timing, the corresponding animation fires.

**Trigger format:**

```jsonc
{
  "triggers": [
    {
      "wordIndex": 12,                    // fire when TTS reaches word 12
      "target": "visualization",           // what to animate
      "action": "transitionTo",
      "stateIndex": 1                      // transition to state snapshot 1
    },
    {
      "wordIndex": 28,
      "target": "visualization",
      "action": "transitionTo",
      "stateIndex": 2
    },
    {
      "wordIndex": 28,
      "target": "highlight",              // can fire multiple things at once
      "action": "highlightLines",
      "lines": [4, 5, 6]
    }
  ]
}
```

Multiple triggers can share a word index (fire simultaneously). The engine processes them in order.

### TTS Engine

Needs word-level timing callbacks — not all TTS engines provide this. Options to evaluate:

- **macOS system TTS** (NSSpeechSynthesizer / AVSpeechSynthesizer) — native, free, provides word boundary callbacks. Quality is decent with newer voices. Accessible from Rust via Tauri.
- **Web Speech API** — browser-native, has `onboundary` events for word timing. Quality varies.
- **Coqui TTS / Piper** — open source, local, high quality. Would need to generate timing data during synthesis.
- **ElevenLabs / cloud TTS** — highest quality, but requires internet and API costs. Can return word-level timestamps.

Recommendation: start with macOS system TTS (it's local, free, and has word boundary events). Design the interface so the TTS provider is swappable. If quality isn't sufficient, swap to a cloud provider or local ML model later.

The TTS interface from the frontend's perspective:

```typescript
type WordTiming = {
  word: string
  startMs: number
  endMs: number
}

type TTSResult = {
  audio: ArrayBuffer
  timings: WordTiming[]
}

// Rust backend exposes this via Tauri command
type SynthesizeNarration = (text: string) => Promise<TTSResult>
```

The frontend receives audio + timing data. Plays the audio. Uses the timing array to fire triggers. Clean boundary — the TTS engine is behind one function call.

---

## Animation Primitives

Three packages. Each takes declarative state snapshots and handles animation internally. Built on Framer Motion. The author never writes animation code — they describe states, the engine interpolates.

### `@handhold/code`

Animates transitions between code states. Think: "here's the code before, here's the code after, animate the diff."

**Input:** Array of code state snapshots.

```typescript
type CodeState = {
  language: string
  code: string
  highlights?: LineRange[]     // lines to emphasize
  annotations?: Annotation[]   // inline labels/callouts
}

type CodeAnimationProps = {
  states: CodeState[]
  currentState: number          // controlled by trigger engine
}
```

**What it does:**
- Diffs adjacent code states (insertions, deletions, modifications)
- Animates lines sliding in/out, characters morphing
- Syntax highlighting via a lightweight parser (Shiki or Prism)
- Highlighted lines glow or pulse to draw attention
- Annotations fade in/out at specified positions

**Visual style:** Dark background, monospace font, smooth transitions. Code should feel alive, not static.

### `@handhold/data`

Animates data structure operations. Arrays, linked lists, trees, graphs, stacks, queues, hash maps.

**Input:** Array of data structure state snapshots.

```typescript
type DataStructureType =
  | "array"
  | "linked-list"
  | "binary-tree"
  | "graph"
  | "stack"
  | "queue"
  | "hash-map"

type DataState = {
  type: DataStructureType
  data: unknown                 // structure-specific shape
  highlights?: string[]          // node IDs to highlight
  annotations?: Record<string, string>  // node ID → label
  pointers?: Pointer[]           // named pointers (i, j, head, tail, etc.)
}

type DataAnimationProps = {
  states: DataState[]
  currentState: number
}
```

**What it does:**
- Each data structure type has its own layout algorithm (array = linear, tree = hierarchical, graph = force-directed)
- Transitions between states animate: nodes moving, appearing, disappearing, changing value, changing color
- Pointers (like `i`, `j` in a two-pointer problem) animate between positions
- Highlights pulse or glow

**Example — array swap animation:**
```jsonc
// State 0: [3, 1, 4, 1, 5]  with pointer i=0, j=1
// State 1: [1, 3, 4, 1, 5]  with pointer i=1, j=2
// Engine sees: elements at index 0 and 1 swapped, pointers moved
// Animation: the two elements physically slide past each other, pointers slide right
```

The engine diffs the states and infers the animation. Authors describe what the data looks like at each point; the engine figures out how to get there.

### `@handhold/diagram`

Animates system design / architecture diagrams. Boxes, arrows, labels, groupings.

**Input:** Array of diagram state snapshots.

```typescript
type DiagramNode = {
  id: string
  label: string
  type: "service" | "database" | "queue" | "cache" | "client" | "cloud" | "custom"
  icon?: string
  group?: string                 // for grouping nodes (e.g., "VPC", "Kubernetes cluster")
}

type DiagramEdge = {
  from: string
  to: string
  label?: string
  style?: "solid" | "dashed" | "animated"   // animated = flowing dots
}

type DiagramState = {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  highlights?: string[]          // node/edge IDs to emphasize
  annotations?: Record<string, string>
}

type DiagramAnimationProps = {
  states: DiagramState[]
  currentState: number
}
```

**What it does:**
- Auto-layouts nodes using a force-directed or hierarchical layout
- New nodes fade in and find their position
- Removed nodes fade out
- New edges draw themselves (line animation from source to target)
- Highlighted nodes/edges pulse
- Groups render as containing boxes
- Edge labels appear alongside their edges

**Example — building a microservices diagram incrementally:**
```
State 0: just a Client node
State 1: Client → API Gateway
State 2: Client → API Gateway → [User Service, Order Service]
State 3: ... → [User Service → User DB, Order Service → Order DB]
```

Each state adds components. The engine animates each addition. The instructor narrates "and now we add a database for the user service..." and the database node fades in, the edge draws itself.

---

## Lab Environment

When a step is type `lab`, the presentation engine yields to the lab environment. The visualization area transforms into a coding workspace.

### Layout

```
┌──────────────┬──────────────────────────────────────┐
│              │  ┌─ tab1.ts ─┬─ tab2.ts ─┐           │
│  File        │  │                        │           │
│  Explorer    │  │  CodeMirror Editor     │           │
│              │  │                        │           │
│  📁 src/     │  │  // Your code here     │           │
│    📄 index  │  │                        │           │
│    📄 utils  │  │                        │           │
│  📁 tests/   │  │                        │           │
│  📄 README   │  ├────────────────────────┤           │
│              │  │  $ Terminal             │           │
│              │  │  > bun test            │           │
│              │  │  ✗ 2 failing            │           │
│              │  │  ✓ 1 passing            │           │
│              │  │  >                      │           │
│              │  └────────────────────────┘           │
├──────────────┴──────────────────────────────────────┤
│  [Run Tests]                     2/3 passing         │
└─────────────────────────────────────────────────────┘
```

### File Explorer

- Tree view of `~/.handhold/courses/<course>/workspace/`
- Create files and folders
- Rename (inline editing)
- Delete (with confirmation)
- Drag-and-drop to move/reorder
- Icons by file type
- Synced with the container filesystem (workspace is volume-mounted)

Changes in the file explorer are changes on disk, which are changes in the container. No sync layer — it's the same filesystem via Docker volume mount.

### CodeMirror Editor

- CodeMirror 6 with language-specific extensions
- Syntax highlighting
- Bracket matching, auto-close brackets
- Basic error squiggles from a language server running inside the container
- Multiple file tabs
- Find/replace
- Line numbers, current line highlight
- Keyboard-only completion of language keywords (no IntelliSense, no AI)
- Theme matches the app (dark)

The language server (e.g., tsserver, rust-analyzer, pyright) runs inside the Docker container. Communication happens over the Tauri bridge — CodeMirror sends LSP requests via Tauri command, Tauri forwards to the container's language server, response comes back. This way the language support matches the container's environment exactly.

### Terminal

- xterm.js rendering
- PTY allocated inside the Docker container
- Full shell access — students can run any command the container supports
- Resizable (drag the divider between editor and terminal)
- Multiple terminal tabs if needed
- Copy/paste support

The terminal connects to the container via Tauri's Docker exec interface. The Rust backend manages the PTY lifecycle.

### Test Runner

- The manifest specifies `testCommand` for each lab step (e.g., `bun test insert`)
- "Run Tests" button (or keyboard shortcut) executes the command in the container
- Output streams to the terminal
- Status bar shows pass/fail count
- All tests pass → step unlocks → student can advance
- Tests fail → student keeps working. No partial credit. No hints. Figure it out.

---

## Docker Management

The Rust backend owns all Docker interaction. The frontend never talks to Docker directly.

### Container Lifecycle

1. **Build** — When a student starts a course, Tauri builds the Docker image from `.handhold/lab/Dockerfile`. Cached for subsequent runs.
2. **Create** — Container is created with the student's workspace mounted at a known path (e.g., `/workspace`).
3. **Start** — Container runs. Ports are mapped as specified in the manifest.
4. **Exec** — Terminal sessions and test runs are `docker exec` calls into the running container.
5. **Stop** — When the student closes the course or the app, the container stops. Workspace files persist on disk.
6. **Resume** — When the student returns, the container is restarted (or recreated from the same image) with the same workspace mount.

### Tauri Commands (Rust → Frontend IPC)

```rust
// Container management
#[tauri::command]
fn start_lab(course_slug: String, step_id: String) -> Result<ContainerInfo, LabError>

#[tauri::command]
fn stop_lab(container_id: String) -> Result<(), LabError>

#[tauri::command]
fn run_tests(container_id: String, test_command: String) -> Result<TestResult, LabError>

// Terminal
#[tauri::command]
fn create_terminal(container_id: String) -> Result<TerminalId, LabError>

#[tauri::command]
fn terminal_input(terminal_id: TerminalId, data: String) -> Result<(), LabError>

// terminal output comes back via Tauri events (streaming)

// Filesystem (operates on the mounted workspace, not Docker API)
#[tauri::command]
fn read_dir(path: String) -> Result<Vec<DirEntry>, FsError>

#[tauri::command]
fn read_file(path: String) -> Result<String, FsError>

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), FsError>

#[tauri::command]
fn rename(from: String, to: String) -> Result<(), FsError>

#[tauri::command]
fn delete(path: String) -> Result<(), FsError>

#[tauri::command]
fn move_entry(from: String, to: String) -> Result<(), FsError>

// LSP (forwarded to language server in container)
#[tauri::command]
fn lsp_request(container_id: String, method: String, params: Value) -> Result<Value, LspError>

// TTS
#[tauri::command]
fn synthesize(text: String) -> Result<TTSResult, TTSError>

// Course management
#[tauri::command]
fn list_courses() -> Result<Vec<CourseInfo>, CourseError>

#[tauri::command]
fn sync_courses(org: String) -> Result<Vec<CourseInfo>, CourseError>

#[tauri::command]
fn get_progress(course_slug: String) -> Result<CourseProgress, ProgressError>

#[tauri::command]
fn mark_step_complete(course_slug: String, step_id: String) -> Result<(), ProgressError>
```

The filesystem commands operate directly on `~/.handhold/courses/<course>/workspace/` — not through Docker. Since the workspace is volume-mounted, the container sees the same files. This is simpler and faster than going through Docker's API for file operations.

---

## Course Discovery and Management

### GitHub Org Scanning

The app is configured with a GitHub org name (stored in `~/.handhold/config.json`). On sync:

1. Tauri lists all repos in the org via GitHub API
2. For each repo, checks for `.handhold/manifest.json` at the root
3. If found, clones (or pulls) the repo to `~/.handhold/cache/repos/<slug>/`
4. Parses the manifest and adds the course to the local catalog

This runs on app launch and can be triggered manually. No webhook, no server. Pull-based. Simple.

### First Run for a Course

When a student starts a new course:

1. Manifest is loaded from cache
2. `~/.handhold/courses/<slug>/workspace/` is created
3. Starter files from `.handhold/lab/starter/` are copied into the workspace
4. Docker image is built from `.handhold/lab/Dockerfile`
5. Progress is initialized (all steps pending)
6. First step begins

### Course Updates

If the course repo is updated upstream, `sync_courses` pulls the latest. The manifest and presentation content update. The student's workspace is NOT touched — it's their work. If the Dockerfile changes, the image is rebuilt on next lab start.

---

## Progress Tracking

SQLite database at `~/.handhold/db.sqlite`.

```sql
CREATE TABLE progress (
    course_slug  TEXT NOT NULL,
    step_id      TEXT NOT NULL,
    status       TEXT NOT NULL CHECK (status IN ('locked', 'available', 'complete')),
    completed_at TEXT,
    PRIMARY KEY (course_slug, step_id)
);

CREATE TABLE test_runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    course_slug  TEXT NOT NULL,
    step_id      TEXT NOT NULL,
    passed       INTEGER NOT NULL,
    failed       INTEGER NOT NULL,
    output       TEXT,
    run_at       TEXT NOT NULL
);
```

Steps are linear. Step N+1 is `locked` until step N is `complete`. A lab step is `complete` when all its tests pass. A presentation step is `complete` when it's been viewed (spacebar past the last trigger).

Test run history is stored so students can see their progress over time ("you went from 0/5 to 3/5 to 5/5").

---

## Visual Style

Dark theme throughout. Inspired by effect.institute's aesthetic.

- Background: near-black (#0a0a0a or similar)
- Text: warm off-white (#f1efe8)
- Accent: TBD (Auburn's colors are navy and orange — `#03244d` and `#dd550c`)
- Monospace font for all code: JetBrains Mono or similar
- Sans-serif for UI: Inter or system font
- Animations: smooth, 60fps, spring-based easing via Framer Motion
- Minimal chrome — no unnecessary borders, shadows, or decorations
- Content fills the space

### Sound Design

Beyond TTS narration:
- Subtle click sounds on navigation (like effect.institute)
- Success sound when tests pass
- Ambient audio is optional and can be toggled
- All sounds can be muted

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Desktop shell | Tauri 2 | Native performance, Rust backend, small binary. Not Electron. |
| Frontend | React + TypeScript | Ecosystem, component model, instructor familiarity |
| Animations | Framer Motion | Best React animation library. Spring physics, layout animations, AnimatePresence. |
| Code editor | CodeMirror 6 | Lightweight, extensible, embeds cleanly. Not Monaco (too heavy, too VS Code). |
| Terminal | xterm.js | Standard terminal emulator for the web. Battle-tested. |
| Containers | Docker | Industry standard. Students may already have it. Required dependency. |
| Database | SQLite (via rusqlite) | Local, embedded, zero config. |
| TTS | macOS system TTS (v1) | Free, local, word boundary events. Swappable later. |
| Build/runtime | Bun | Fast, TypeScript-native. |
| Syntax highlighting | Shiki | Accurate (uses TextMate grammars), works at build time and runtime. |
| Routing | TanStack Router | Type-safe, file-based routing. |
| State management | Zustand | Simple, no boilerplate, works with React Query. |
| Data fetching | React Query (TanStack Query) | For Tauri IPC calls — caching, invalidation, loading states. |

---

## Build Order

### Phase 1: Animation Primitives

Build `@handhold/code`, `@handhold/data`, `@handhold/diagram` as standalone packages. Test them in a Storybook or simple React app. Get the animations feeling right before integrating anything.

Deliverable: Three npm packages that take state snapshots and animate transitions. Working demos of each.

### Phase 2: Tauri App Shell + Presentation Engine

Scaffold the Tauri 2 app with React. Build the presentation engine:
- Narration text rendering
- TTS integration via Rust backend (macOS system TTS)
- Word timing extraction
- Trigger engine (watches clock, fires state changes)
- Integration with animation primitives
- Step navigation (sidebar + spacebar)
- Dark theme, layout, sound design

Deliverable: A Tauri app that can play a hardcoded presentation with narration and animations.

### Phase 3: Lab Engine

Build the coding environment:
- Docker management in Rust (build, create, start, exec, stop)
- File explorer component (tree view, CRUD, drag-and-drop)
- CodeMirror integration (syntax highlighting, tabs, language server bridge)
- xterm.js integration (PTY into container)
- Test runner (execute test command, parse results, gate progression)

Deliverable: A working lab environment that boots a Docker container, lets you edit code, use the terminal, and run tests.

### Phase 4: Course System

- `.handhold/manifest.json` parser
- GitHub org scanner
- Course catalog UI
- Progress tracking (SQLite)
- Step sequencing (presentation → lab transitions)
- Workspace initialization from starter files
- Course sync/update

Deliverable: End-to-end course playback. Point it at a GitHub org, it discovers courses, students can play through them.

### Phase 5: Visual Editor (Capstone)

- Timeline-based editor for presentation steps
- Narration text editing with word-level trigger placement
- Preview playback
- Animation state editor (visual manipulation of code states, data structure states, diagram states)
- Export to `.handhold/` format
- Integrated into the same Tauri app (instructor mode)

Deliverable: Instructors can visually author presentations without writing JSON by hand.

---

## Open Questions (to resolve during implementation)

1. **TTS voice quality** — macOS system TTS may not sound good enough. May need to evaluate ElevenLabs or Coqui for v1. Design the TTS interface so the provider is swappable.

2. **TTS caching** — Should generated audio be cached in the course repo (committed) or generated on each student's machine? Caching in repo means consistent experience but larger repos. Generating locally means first-playback delay.

3. **Language server protocol details** — How exactly does LSP communication flow through Tauri to the container? Need to prototype this early — it's a potential complexity trap.

4. **Docker requirement UX** — What happens when a student doesn't have Docker installed? The app needs a clear error state and installation guidance.

5. **Offline support** — Can students work through courses without internet? Courses are cloned locally, Docker images can be cached. Should work, but needs explicit design.

6. **Multi-language support in a single course** — Can a course switch Docker environments mid-course? (e.g., a system design course that starts with Node, then switches to Go). The manifest supports per-step Docker config, but the container lifecycle gets more complex.

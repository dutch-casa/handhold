# Course Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Cursor-like visual course editor with MVVM architecture, compound components, and an opencode-powered AI agent for authoring assistance.

**Architecture:** Outside-in MVVM. The View layer is compound React components with Stripe-like DX — simple defaults, composition for customization. The ViewModel layer is Zustand stores with explicitly named transitions (no arbitrary mutations). The Model layer is editable wrappers around the existing readonly IR types, with undo/redo and a new serializer (IR → markdown) for round-trip editing.

**Tech Stack:** React 19, Zustand, React Query, Monaco Editor, Motion, Tailwind CSS 4.1, opencode server (agent), Tauri 2 (persistence/fs)

---

## Part 0: The Dream API

Before any internals — this is what consuming the editor looks like.

### 0A. Top-Level Composition

```tsx
// This is the entire editor. One component, sensible defaults.
<CourseEditor courseId="dijkstra-101">
  <CourseEditor.Toolbar />
  <CourseEditor.Layout>
    <CourseEditor.Sidebar />
    <CourseEditor.Canvas />
    <CourseEditor.Panel />
  </CourseEditor.Layout>
  <CourseEditor.BottomBar />
</CourseEditor>

// Or with zero config — defaults compose everything:
<CourseEditor courseId="dijkstra-101" />
```

### 0B. Customized Composition

```tsx
<CourseEditor courseId="dijkstra-101">
  <CourseEditor.Toolbar>
    <CourseEditor.ViewToggle />     {/* source ↔ visual */}
    <CourseEditor.PreviewButton />
    <CourseEditor.UndoRedo />
    <MyCustomExportButton />        {/* extend with anything */}
  </CourseEditor.Toolbar>

  <CourseEditor.Layout>
    <CourseEditor.Sidebar defaultSection="course">
      <CourseEditor.CourseTree />
      <CourseEditor.BlockIndex />
      <CourseEditor.RegionIndex />
      <CourseEditor.DiagnosticsPanel />
    </CourseEditor.Sidebar>

    <CourseEditor.Canvas />

    <CourseEditor.Panel defaultTab="agent">
      <CourseEditor.Agent />
      <CourseEditor.Inspector />
    </CourseEditor.Panel>
  </CourseEditor.Layout>

  <CourseEditor.BottomBar>
    <CourseEditor.Timeline />
    <CourseEditor.Preview />
    <CourseEditor.DiagnosticsTable />
  </CourseEditor.BottomBar>
</CourseEditor>
```

### 0C. Block Editor Tabs (auto-opened when clicking a block card)

```tsx
// These are the editors that open in tabs. Authors don't compose these
// directly — the canvas opens them. But they're standalone compound components.

// Code block editor
<CodeBlockEditor block={codeBlock} onChange={onUpdate}>
  <CodeBlockEditor.Monaco />        {/* syntax-highlighted editor */}
  <CodeBlockEditor.RegionEditor />   {/* name → line range mapping */}
  <CodeBlockEditor.AnnotationList /> {/* inline annotation management */}
</CodeBlockEditor>

// Data structure editor
<DataBlockEditor block={dataBlock} onChange={onUpdate}>
  <DataBlockEditor.Canvas />         {/* SVG visual editor */}
  <DataBlockEditor.NodeList />       {/* tabular node editing */}
  <DataBlockEditor.RegionEditor />
</DataBlockEditor>

// Diagram editor
<DiagramBlockEditor block={diagramBlock} onChange={onUpdate}>
  <DiagramBlockEditor.Canvas />      {/* node + edge visual editor */}
  <DiagramBlockEditor.NodePalette /> {/* drag service/db/cache onto canvas */}
  <DiagramBlockEditor.RegionEditor />
</DiagramBlockEditor>

// Lab editor
<LabEditor lab={parsedLab} onChange={onUpdate}>
  <LabEditor.Config />               {/* form-based lab.yaml editor */}
  <LabEditor.Instructions />         {/* markdown editor */}
  <LabEditor.ScaffoldTree />         {/* file tree + inline editing */}
  <LabEditor.ServicePanel />         {/* service preset picker */}
</LabEditor>
```

### 0D. ViewModel Hooks (the dream DX for consuming state)

```tsx
// Root editor state — one hook to rule them all
const editor = useCourseEditor()
editor.course                        // EditableCourse
editor.activeTab                     // EditorTab | null
editor.openTab(target)               // open a step, block, or lab
editor.closeTab(tabId)
editor.save()                        // serialize → write to disk
editor.undo()
editor.redo()
editor.canUndo                       // boolean
editor.canRedo                       // boolean

// Step editing — scoped to a single step
const step = useStepEditor(stepId)
step.title                           // string
step.narration                       // NarrationBlock[]
step.blocks                          // Map<string, VisualizationState>
step.scenes                          // SceneState[] (computed, readonly)
step.diagnostics                     // LessonDiagnostic[]
step.updateNarration(index, text)    // edit paragraph text
step.addTrigger(paragraphIndex, wordIndex, verb)
step.removeTrigger(paragraphIndex, triggerIndex)
step.addBlock(kind, name)            // add empty block of given type
step.removeBlock(name)
step.dirty                           // boolean

// Block editing — scoped to a single block
const block = useBlockEditor(blockName)
block.state                          // VisualizationState (current)
block.kind                           // "code" | "data" | "diagram" | ...
block.updateContent(patch)           // type-safe partial update
block.addRegion(name, target)
block.removeRegion(name)
block.regions                        // RegionDef[]

// Agent — opencode session
const agent = useAgent()
agent.status                         // "disconnected" | "connecting" | "ready"
agent.messages                       // ChatMessage[]
agent.send(prompt)                   // send message, streamed response
agent.context                        // what the agent can see (current step, blocks)
agent.applySuggestion(id)            // accept an agent-proposed change
agent.rejectSuggestion(id)

// Layout — responsive panel management
const layout = useEditorLayout()
layout.sidebar.visible               // boolean
layout.sidebar.toggle()
layout.panel.visible
layout.panel.toggle()
layout.panel.activeTab               // "agent" | "inspector"
layout.bottomBar.visible
layout.bottomBar.toggle()
layout.bottomBar.activeTab           // "timeline" | "preview" | "diagnostics"
layout.breakpoint                    // "sm" | "md" | "lg" | "xl"
```

---

## Part 1: Model Layer — Editable Domain Types

The existing IR types are readonly (for playback). For editing, we wrap them in mutable drafts with change tracking. The key insight: **editable types mirror authoring inputs, not computed outputs.** Scenes are derived — authors don't edit scenes directly.

### Types to create: `src/editor/model/types.ts`

```ts
// --- Edit history (undo/redo command stack) ---

type EditCommand = {
  readonly description: string
  readonly forward: () => void
  readonly reverse: () => void
}

type EditHistory = {
  readonly undoStack: readonly EditCommand[]
  readonly redoStack: readonly EditCommand[]
  push(cmd: EditCommand): void
  undo(): boolean
  redo(): boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
}

// --- Editable wrapper ---
// Wraps any domain value with dirty tracking and edit history.

type Editable<T> = {
  readonly original: T        // snapshot at last save
  current: T                  // live editing state
  readonly dirty: boolean     // derived: deep-equal check
  readonly history: EditHistory
}

// --- Editable course ---

type EditableCourse = {
  readonly title: string
  readonly steps: EditableCourseStep[]  // mutable array for reordering
  addLesson(title: string): string      // returns step ID
  addLab(title: string): string
  removeStep(id: string): void
  moveStep(fromIndex: number, toIndex: number): void
}

// --- Editable lesson step ---

type EditableStep = {
  readonly id: string
  title: string
  narration: EditableNarration[]
  blocks: Map<string, EditableBlock>
  readonly scenes: readonly SceneState[]  // computed (readonly, derived from narration + blocks)
  addBlock(kind: VisualizationState["kind"], name: string): void
  removeBlock(name: string): void
  addNarrationParagraph(text: string): void
  removeNarrationParagraph(index: number): void
}

// --- Editable narration ---

type EditableNarration = {
  text: string
  triggers: EditableTrigger[]
  addTrigger(wordIndex: number, verb: TriggerVerb): void
  removeTrigger(index: number): void
  updateTrigger(index: number, verb: TriggerVerb): void
}

// --- Editable block (discriminated by kind, matching VisualizationState) ---

type EditableBlock =
  | EditableCodeBlock
  | EditableDataBlock
  | EditableDiagramBlock
  | EditableMathBlock
  | EditableChartBlock
  | EditablePreviewBlock

type EditableCodeBlock = {
  readonly kind: "code"
  name: string
  lang: string
  fileName: string
  content: string
  regions: EditableRegion[]
  annotations: EditableCodeAnnotation[]
}

type EditableDataBlock = {
  readonly kind: "data"
  name: string
  data: /* mutable version of the data union */
  regions: EditableRegion[]
}

// ... same pattern for diagram, math, chart, preview

type EditableRegion = {
  name: string
  target: string
}

// --- Editable lab ---

type EditableLab = {
  title: string
  instructions: string
  workspace: "fresh" | "continue"
  testCommand: string
  openFiles: string[]
  services: EditableService[]
  setup: string[]
  start: string[]
  scaffoldPath: string
  addService(preset: string): void
  removeService(name: string): void
}

// --- Editor tab system ---

type EditorTabTarget =
  | { readonly kind: "step-overview"; readonly stepId: string }
  | { readonly kind: "code-block"; readonly stepId: string; readonly blockName: string }
  | { readonly kind: "data-block"; readonly stepId: string; readonly blockName: string }
  | { readonly kind: "diagram-block"; readonly stepId: string; readonly blockName: string }
  | { readonly kind: "math-block"; readonly stepId: string; readonly blockName: string }
  | { readonly kind: "chart-block"; readonly stepId: string; readonly blockName: string }
  | { readonly kind: "preview-block"; readonly stepId: string; readonly blockName: string }
  | { readonly kind: "lab-config"; readonly stepId: string }
  | { readonly kind: "lab-instructions"; readonly stepId: string }
  | { readonly kind: "lab-scaffold"; readonly stepId: string; readonly filePath: string }
  | { readonly kind: "source"; readonly stepId: string }

type EditorTab = {
  readonly id: string
  readonly target: EditorTabTarget
  readonly label: string
  readonly dirty: boolean
  readonly pinned: boolean
}
```

### Serializer to create: `src/editor/model/serialize.ts`

Round-trip: `markdown → parseLesson() → IR → serialize() → markdown`

This is the missing piece. We need to serialize the editable IR back to the markdown DSL format. The serializer must:
- Emit YAML frontmatter
- Emit H1 sections per step
- Emit narration paragraphs with trigger syntax `{{verb: args}}`
- Emit code fences with block metadata and region footers
- Preserve ordering and formatting

```ts
function serializeLesson(steps: readonly EditableStep[]): string
function serializeLab(lab: EditableLab): { yaml: string; instructions: string }
function serializeCourse(course: EditableCourse): string  // handhold.yaml manifest
```

---

## Part 2: ViewModel Layer — Stores with Explicit Transitions

Every store separates **State** (readonly data) from **Actions** (named transitions). Views read state via selectors, dispatch actions. No arbitrary set() calls from views.

### 2A. CourseEditorStore — `src/editor/viewmodel/course-editor-store.ts`

The root store. Manages tabs, selection, save, undo/redo.

```ts
type CourseEditorStatus =
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "saving" }
  | { readonly kind: "error"; readonly message: string }

type CourseEditorState = {
  readonly status: CourseEditorStatus
  readonly course: EditableCourse | null
  readonly tabs: readonly EditorTab[]
  readonly activeTabId: string | null
  readonly viewMode: "visual" | "source"
  readonly dirty: boolean
}

type CourseEditorActions = {
  // Lifecycle
  loadCourse(courseId: string): Promise<void>
  save(): Promise<void>

  // Tabs
  openTab(target: EditorTabTarget): void
  closeTab(tabId: string): void
  activateTab(tabId: string): void
  reorderTab(fromIndex: number, toIndex: number): void

  // View mode
  toggleViewMode(): void

  // Undo/redo
  undo(): void
  redo(): void

  // Course structure
  addLesson(title: string): void
  addLab(title: string): void
  removeStep(stepId: string): void
  moveStep(fromIndex: number, toIndex: number): void
  renameStep(stepId: string, title: string): void
}
```

### 2B. StepEditorStore — `src/editor/viewmodel/step-editor-store.ts`

Per-step editing. Created when a step tab is opened, destroyed when closed.

```ts
type StepEditorStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "editing-narration"; readonly paragraphIndex: number }
  | { readonly kind: "editing-trigger"; readonly paragraphIndex: number; readonly triggerIndex: number }
  | { readonly kind: "previewing-scene"; readonly sceneIndex: number }

type StepEditorState = {
  readonly status: StepEditorStatus
  readonly step: EditableStep
  readonly scenes: readonly SceneState[]          // derived, recomputed on change
  readonly diagnostics: readonly LessonDiagnostic[] // derived, recomputed on change
  readonly selectedBlockName: string | null
  readonly selectedParagraphIndex: number | null
}

type StepEditorActions = {
  // Narration
  selectParagraph(index: number): void
  updateNarrationText(paragraphIndex: number, text: string): void
  addParagraph(afterIndex: number): void
  removeParagraph(index: number): void

  // Triggers
  addTrigger(paragraphIndex: number, wordIndex: number, verb: TriggerVerb): void
  updateTrigger(paragraphIndex: number, triggerIndex: number, verb: TriggerVerb): void
  removeTrigger(paragraphIndex: number, triggerIndex: number): void

  // Blocks
  addBlock(kind: VisualizationState["kind"], name: string): void
  removeBlock(name: string): void
  selectBlock(name: string): void

  // Preview
  previewScene(index: number): void
  exitPreview(): void
}
```

### 2C. BlockEditorStore — `src/editor/viewmodel/block-editor-store.ts`

Per-block editing. Discriminated by block kind — each variant has type-specific actions.

```ts
type BlockEditorState = {
  readonly block: EditableBlock
  readonly regions: readonly EditableRegion[]
}

// Actions are type-safe per kind
type CodeBlockActions = {
  updateContent(content: string): void
  updateLang(lang: string): void
  addRegion(name: string, target: string): void
  removeRegion(name: string): void
  addAnnotation(line: number, text: string): void
  removeAnnotation(line: number): void
}

type DataBlockActions = {
  updateData(data: EditableDataBlock["data"]): void
  addNode(node: DataNodeDef): void
  removeNode(id: string): void
  addEdge(from: string, to: string): void
  removeEdge(from: string, to: string): void
  addPointer(name: string, targetId: string): void
  removePointer(name: string): void
  addRegion(name: string, target: string): void
  removeRegion(name: string): void
}

type DiagramBlockActions = {
  addNode(node: DiagramNodeDef): void
  removeNode(id: string): void
  updateNode(id: string, patch: Partial<DiagramNodeDef>): void
  addEdge(from: string, to: string, label: string): void
  removeEdge(from: string, to: string): void
  addGroup(name: string, memberIds: string[]): void
  removeGroup(name: string): void
  addRegion(name: string, target: string): void
  removeRegion(name: string): void
}

// ... math, chart, preview follow same pattern
```

### 2D. LabEditorStore — `src/editor/viewmodel/lab-editor-store.ts`

```ts
type LabEditorState = {
  readonly lab: EditableLab
  readonly scaffoldTree: readonly FsEntry[]
}

type LabEditorActions = {
  updateInstructions(text: string): void
  updateTestCommand(cmd: string): void
  updateWorkspace(mode: "fresh" | "continue"): void
  addService(preset: string): void
  removeService(name: string): void
  updateService(name: string, patch: Partial<EditableService>): void
  addSetupCommand(cmd: string): void
  removeSetupCommand(index: number): void
  addStartCommand(cmd: string): void
  removeStartCommand(index: number): void
  addOpenFile(path: string): void
  removeOpenFile(path: string): void
}
```

### 2E. AgentStore — `src/editor/viewmodel/agent-store.ts`

Wraps the opencode server session.

```ts
type AgentStatus =
  | { readonly kind: "disconnected" }
  | { readonly kind: "connecting" }
  | { readonly kind: "ready"; readonly sessionId: string }
  | { readonly kind: "error"; readonly message: string }

type ChatRole = "user" | "assistant"

type ChatMessage = {
  readonly id: string
  readonly role: ChatRole
  readonly content: string
  readonly timestamp: number
  readonly suggestions: readonly AgentSuggestion[]
}

type AgentSuggestion = {
  readonly id: string
  readonly kind: "add-block" | "update-narration" | "add-trigger" | "add-step" | "update-block"
  readonly description: string
  readonly patch: unknown  // type-specific patch data
  readonly status: "pending" | "accepted" | "rejected"
}

type AgentState = {
  readonly status: AgentStatus
  readonly messages: readonly ChatMessage[]
  readonly isStreaming: boolean
}

type AgentActions = {
  connect(): Promise<void>
  disconnect(): void
  send(prompt: string): Promise<void>
  applySuggestion(id: string): void
  rejectSuggestion(id: string): void
  clearMessages(): void
}
```

### 2F. EditorLayoutStore — `src/editor/viewmodel/layout-store.ts`

Responsive panel management.

```ts
type PanelState = {
  readonly visible: boolean
  readonly width: number           // persisted
}

type BottomBarState = {
  readonly visible: boolean
  readonly height: number          // persisted
  readonly activeTab: "timeline" | "preview" | "diagnostics"
}

type SidebarSection = "course" | "blocks" | "regions" | "diagnostics"

type LayoutState = {
  readonly sidebar: PanelState & { readonly activeSection: SidebarSection }
  readonly panel: PanelState & { readonly activeTab: "agent" | "inspector" }
  readonly bottomBar: BottomBarState
  readonly breakpoint: "sm" | "md" | "lg" | "xl"
}

type LayoutActions = {
  toggleSidebar(): void
  setSidebarSection(section: SidebarSection): void
  setSidebarWidth(width: number): void
  togglePanel(): void
  setPanelTab(tab: "agent" | "inspector"): void
  setPanelWidth(width: number): void
  toggleBottomBar(): void
  setBottomBarTab(tab: "timeline" | "preview" | "diagnostics"): void
  setBottomBarHeight(height: number): void
  setBreakpoint(bp: "sm" | "md" | "lg" | "xl"): void
}
```

---

## Part 3: View Layer — Compound Components

### 3A. Component Hierarchy

```
src/editor/
├── view/
│   ├── CourseEditor.tsx              # Root compound component + provider
│   ├── Toolbar.tsx                   # Top toolbar
│   ├── Layout.tsx                    # 3-column responsive shell
│   ├── sidebar/
│   │   ├── Sidebar.tsx               # Left panel with sections
│   │   ├── CourseTree.tsx            # Lesson/lab/step tree
│   │   ├── BlockIndex.tsx            # All blocks across course
│   │   ├── RegionIndex.tsx           # All regions across course
│   │   └── DiagnosticsPanel.tsx      # Parser warnings/errors
│   ├── canvas/
│   │   ├── Canvas.tsx                # Tab bar + tab content area
│   │   ├── EditorTabs.tsx            # Tab bar (drag, close, pin)
│   │   ├── StepOverview.tsx          # Narration + block cards
│   │   ├── NarrationEditor.tsx       # Rich text with trigger pills
│   │   ├── TriggerPill.tsx           # Inline trigger chip
│   │   ├── TriggerAutocomplete.tsx   # {{ autocomplete dropdown
│   │   ├── BlockCard.tsx             # Thumbnail card for a block
│   │   ├── BlockCardGrid.tsx         # Grid of block cards + add buttons
│   │   ├── SourceEditor.tsx          # Raw markdown source view
│   │   └── block-editors/
│   │       ├── CodeBlockEditor.tsx
│   │       ├── DataBlockEditor.tsx
│   │       ├── DiagramBlockEditor.tsx
│   │       ├── MathBlockEditor.tsx
│   │       ├── ChartBlockEditor.tsx
│   │       └── PreviewBlockEditor.tsx
│   ├── panel/
│   │   ├── Panel.tsx                 # Right panel with tabs
│   │   ├── Agent.tsx                 # Chat UI
│   │   ├── AgentMessage.tsx          # Single chat message
│   │   ├── AgentSuggestion.tsx       # Accept/reject suggestion card
│   │   └── Inspector.tsx             # Context-sensitive properties
│   ├── bottom/
│   │   ├── BottomBar.tsx             # Bottom panel with tabs
│   │   ├── Timeline.tsx              # Scene scrubber
│   │   ├── PreviewPlayer.tsx         # Embedded presentation playback
│   │   └── DiagnosticsTable.tsx      # Full diagnostics view
│   └── lab/
│       ├── LabConfigEditor.tsx       # Form-based lab.yaml
│       ├── LabInstructionsEditor.tsx  # Markdown editor
│       ├── LabScaffoldTree.tsx       # File tree + context menu
│       └── LabServicePicker.tsx      # Service preset picker
├── model/
│   ├── types.ts                      # Editable domain types
│   ├── editable.ts                   # Editable<T> wrapper + EditHistory
│   ├── serialize.ts                  # IR → markdown serializer
│   ├── deserialize.ts                # Adapter: parseLesson() → EditableStep[]
│   └── scene-compiler.ts             # EditableStep → SceneState[] (reuses build-scenes.ts)
├── viewmodel/
│   ├── course-editor-store.ts        # Root store
│   ├── step-editor-store.ts          # Per-step editing
│   ├── block-editor-store.ts         # Per-block editing
│   ├── lab-editor-store.ts           # Lab editing
│   ├── agent-store.ts                # Opencode agent session
│   ├── layout-store.ts              # Responsive panel state
│   └── hooks.ts                      # Convenience hooks (useCourseEditor, useStepEditor, etc.)
└── agent/
    ├── opencode-client.ts            # HTTP + SSE client for opencode server
    ├── mcp-tools.ts                  # Custom MCP tool definitions for course authoring
    └── context-builder.ts            # Build agent context from current editor state
```

### 3B. CourseEditor Root Component

```tsx
// CourseEditor.tsx — the root compound component
// Provides the editor context to all children.
// If no children are provided, renders default composition.

type CourseEditorProps = {
  readonly courseId: string
  readonly children?: React.ReactNode
}

function CourseEditor({ courseId, children }: CourseEditorProps) {
  // Initialize all stores
  // Provide via context
  // If no children, render default layout:
  //   <Toolbar /> + <Layout><Sidebar /><Canvas /><Panel /></Layout> + <BottomBar />
}

// Compound component slots
CourseEditor.Toolbar = Toolbar
CourseEditor.Layout = Layout
CourseEditor.Sidebar = Sidebar
CourseEditor.Canvas = Canvas
CourseEditor.Panel = Panel
CourseEditor.BottomBar = BottomBar
CourseEditor.ViewToggle = ViewToggle
CourseEditor.PreviewButton = PreviewButton
CourseEditor.UndoRedo = UndoRedo
CourseEditor.CourseTree = CourseTree
CourseEditor.BlockIndex = BlockIndex
CourseEditor.RegionIndex = RegionIndex
CourseEditor.DiagnosticsPanel = DiagnosticsPanel
CourseEditor.Agent = Agent
CourseEditor.Inspector = Inspector
CourseEditor.Timeline = Timeline
CourseEditor.Preview = PreviewPlayer
CourseEditor.DiagnosticsTable = DiagnosticsTable
```

### 3C. Layout System — Responsive Panels

```tsx
// Layout.tsx — the 3-column responsive shell
// Uses CSS Grid with resizable columns.
// Panels auto-collapse based on breakpoint (from layout store).

// Grid template:
// lg+:  [sidebar] [canvas] [panel]
// md:   [canvas] [panel]      (sidebar in overlay)
// sm:   [canvas]              (sidebar + panel in overlay)

// Resize handles between columns — drag to resize, double-click to collapse.
// All widths persisted to layout store → Tauri settings.
```

---

## Part 4: Agent Integration

### 4A. opencode Server Setup

The opencode server runs alongside the Tauri app. Tauri manages the lifecycle:
- Start: spawn `opencode serve --port 4096` as a sidecar on app launch
- Stop: kill process on app quit
- Health: poll `/` endpoint until ready

### 4B. Custom MCP Tools for Course Authoring

Register these tools with the opencode server so the agent can manipulate courses:

```ts
// mcp-tools.ts — tool definitions the agent can call

const tools = {
  // Structural
  "course.addLesson":    { description: "Add a new lesson to the course", params: { title: "string" } },
  "course.addLab":       { description: "Add a new lab to the course", params: { title: "string" } },
  "course.addStep":      { description: "Add a step (H1) to a lesson", params: { lessonIndex: "number", title: "string" } },

  // Content
  "step.setNarration":   { description: "Set narration text for a paragraph", params: { stepId: "string", paragraphIndex: "number", text: "string" } },
  "step.addBlock":       { description: "Add a visualization block", params: { stepId: "string", kind: "string", name: "string", content: "string" } },
  "step.addTrigger":     { description: "Add a trigger to narration", params: { stepId: "string", paragraphIndex: "number", wordIndex: "number", verb: "string", target: "string" } },
  "step.addRegion":      { description: "Add a named region to a block", params: { stepId: "string", blockName: "string", regionName: "string", target: "string" } },

  // Validation
  "course.validate":     { description: "Parse and validate the current course, return diagnostics", params: {} },
  "course.previewStep":  { description: "Get computed scenes for a step", params: { stepId: "string" } },

  // Lab
  "lab.setInstructions": { description: "Set lab instructions markdown", params: { labId: "string", content: "string" } },
  "lab.setConfig":       { description: "Update lab.yaml fields", params: { labId: "string", config: "object" } },

  // Read (context)
  "course.getStructure": { description: "Get full course outline", params: {} },
  "step.getContent":     { description: "Get step narration, blocks, and regions", params: { stepId: "string" } },
}
```

### 4C. Agent Context Builder

Before each message, inject relevant context so the agent understands what it's looking at:

```ts
function buildAgentContext(editorState: CourseEditorState): string {
  // Current step title, narration, block names, regions
  // Course outline (all step titles)
  // Current diagnostics
  // The authoring DSL reference (condensed)
  // Recent edit history (what changed)
}
```

### 4D. Agent Chat UI

```
┌─────────────────────────┐
│ Agent                 ×  │
├─────────────────────────┤
│                          │
│ ┌──────────────────────┐ │
│ │ 🤖 Here's the        │ │
│ │ narration for step 3: │ │
│ │                       │ │
│ │ [Apply] [Reject]      │ │
│ └──────────────────────┘ │
│                          │
│ ┌──────────────────────┐ │
│ │ 👤 Add a code block   │ │
│ │ showing the hash fn   │ │
│ └──────────────────────┘ │
│                          │
├─────────────────────────┤
│ [Ask the agent...]   ➤  │
└─────────────────────────┘
```

- Suggestions render as diff-like cards with [Apply] / [Reject]
- Applying a suggestion dispatches the corresponding viewmodel action
- Agent sees the editor context (current step, blocks, diagnostics)
- Cmd+L focuses the agent input from anywhere

---

## Part 5: Key Interactions (3-Click Rule)

### Adding a code block to a step
1. Click `[+ Code]` button on step overview canvas
2. Type block name in the popup (e.g., "hash-fn")
3. Done — code block editor tab opens with empty Monaco, lang defaults to `ts`

### Adding a trigger to narration
1. Select word(s) in the narration editor
2. Right-click → trigger verb menu (show, hide, focus, zoom, annotate, etc.)
3. Pick target block from submenu → trigger pill inserted at selection

### Adding a lab
1. Click `[+]` in course tree
2. Pick "Lab"
3. Done — lab config tab opens with form defaults filled

### Asking the agent to write narration
1. Open a step
2. Press Cmd+L (focus agent)
3. Type "write narration for this step explaining the hash function" → agent streams narration with triggers, [Apply] card appears

### Previewing a step
1. Click `▶ Preview` in toolbar (or bottom bar timeline tab)
2. Presentation plays with TTS audio

### Switching to source view
1. Click `Source ↔ Visual` toggle in toolbar
2. Source tab opens showing the raw markdown for the current step

---

## Implementation Tasks

### Phase 1: Foundation (Model + ViewModel + Shell)

#### Task 1: Create editor directory structure

**Files:**
- Create: `src/editor/model/types.ts`
- Create: `src/editor/model/editable.ts`
- Create: `src/editor/viewmodel/layout-store.ts`
- Create: `src/editor/view/CourseEditor.tsx`

**Step 1:** Create directory skeleton with placeholder files

**Step 2:** Implement `EditHistory` class (undo/redo command stack)

**Step 3:** Implement `Editable<T>` wrapper with dirty tracking

**Step 4:** Implement `LayoutStore` (panel visibility, widths, breakpoints)

**Step 5:** Implement `CourseEditor` root component with context provider (renders children or defaults)

**Step 6:** Commit

---

#### Task 2: Editable domain types + deserializer

**Files:**
- Create: `src/editor/model/types.ts` (full type definitions)
- Create: `src/editor/model/deserialize.ts` (ParsedLesson → EditableStep[])
- Create: `src/editor/model/scene-compiler.ts` (EditableStep → SceneState[])

**Step 1:** Define all editable types (EditableCourse, EditableStep, EditableNarration, EditableBlock variants, EditableLab, EditorTab, EditorTabTarget)

**Step 2:** Write deserializer: adapt `parseLesson()` output to editable types. This converts readonly IR → mutable editable wrappers.

**Step 3:** Write scene compiler: reuse `buildScenes()` from `src/parser/build-scenes.ts` to derive scenes from editable step state. Called on every narration/trigger change.

**Step 4:** Commit

---

#### Task 3: Serializer (IR → markdown)

**Files:**
- Create: `src/editor/model/serialize.ts`
- Test: `src/editor/model/__tests__/serialize.test.ts`

**Step 1:** Write failing test: `serializeLesson(deserialize(parseLesson(markdown))) === markdown` for a simple lesson with one step, one code block, one trigger.

**Step 2:** Implement `serializeStep()` — emit H1 heading + narration paragraphs with trigger syntax + code fences with block metadata + region footer.

**Step 3:** Implement `serializeLesson()` — emit frontmatter + concatenate steps.

**Step 4:** Implement `serializeLab()` — emit lab.yaml + INSTRUCTIONS.md.

**Step 5:** Add round-trip tests for each block type (data, diagram, math, chart, preview).

**Step 6:** Commit

---

#### Task 4: CourseEditorStore

**Files:**
- Create: `src/editor/viewmodel/course-editor-store.ts`
- Create: `src/editor/viewmodel/hooks.ts`

**Step 1:** Implement `CourseEditorStore` — status, course, tabs, activeTabId, viewMode, dirty.

**Step 2:** Implement tab actions: openTab, closeTab, activateTab, reorderTab. Dedup tabs by target.

**Step 3:** Implement course structure actions: addLesson, addLab, removeStep, moveStep, renameStep.

**Step 4:** Implement save action: serialize all dirty steps → write to disk via Tauri `write_file`.

**Step 5:** Implement undo/redo: delegate to EditHistory.

**Step 6:** Write `useCourseEditor()` hook — convenience selector.

**Step 7:** Commit

---

#### Task 5: StepEditorStore + BlockEditorStore

**Files:**
- Create: `src/editor/viewmodel/step-editor-store.ts`
- Create: `src/editor/viewmodel/block-editor-store.ts`

**Step 1:** Implement `StepEditorStore` with status typestate, narration actions, trigger actions, block actions.

**Step 2:** Implement scene recomputation — subscribe to narration/block changes, rerun scene compiler.

**Step 3:** Implement `BlockEditorStore` — per-kind action sets (code, data, diagram, math, chart, preview).

**Step 4:** Write `useStepEditor(stepId)` and `useBlockEditor(blockName)` hooks.

**Step 5:** Commit

---

#### Task 6: LabEditorStore

**Files:**
- Create: `src/editor/viewmodel/lab-editor-store.ts`

**Step 1:** Implement `LabEditorStore` — instructions, config, scaffold, service actions.

**Step 2:** Write `useLabEditor(stepId)` hook.

**Step 3:** Commit

---

### Phase 2: Editor Shell (Layout + Navigation)

#### Task 7: Responsive Layout Shell

**Files:**
- Create: `src/editor/view/Layout.tsx`
- Create: `src/editor/view/Toolbar.tsx`

**Step 1:** Implement `Layout` — CSS Grid 3-column shell with resize handles.

**Step 2:** Implement responsive collapse: subscribe to breakpoint, auto-hide panels.

**Step 3:** Implement `Toolbar` — ViewToggle, PreviewButton, UndoRedo slots.

**Step 4:** Commit

---

#### Task 8: Sidebar + Course Tree

**Files:**
- Create: `src/editor/view/sidebar/Sidebar.tsx`
- Create: `src/editor/view/sidebar/CourseTree.tsx`

**Step 1:** Implement `Sidebar` — collapsible sections, activity bar icons.

**Step 2:** Implement `CourseTree` — expandable tree rendering lessons → steps, labs → config. Drag to reorder. Right-click context menu. `+` buttons to add.

**Step 3:** Wire tree clicks to `openTab()` on the editor store.

**Step 4:** Commit

---

#### Task 9: Editor Tabs + Canvas Shell

**Files:**
- Create: `src/editor/view/canvas/Canvas.tsx`
- Create: `src/editor/view/canvas/EditorTabs.tsx`

**Step 1:** Implement `EditorTabs` — horizontal tab bar with close, pin, drag-to-reorder, dirty indicator.

**Step 2:** Implement `Canvas` — renders the active tab's content by dispatching on `EditorTabTarget.kind`.

**Step 3:** Commit

---

### Phase 3: Step Editor

#### Task 10: Step Overview + Narration Editor

**Files:**
- Create: `src/editor/view/canvas/StepOverview.tsx`
- Create: `src/editor/view/canvas/NarrationEditor.tsx`
- Create: `src/editor/view/canvas/TriggerPill.tsx`
- Create: `src/editor/view/canvas/TriggerAutocomplete.tsx`

**Step 1:** Implement `StepOverview` — narration area + block card grid + add-block buttons.

**Step 2:** Implement `NarrationEditor` — contenteditable or textarea with trigger pills rendered inline as chips. `{{` triggers autocomplete dropdown of verbs + block names.

**Step 3:** Implement `TriggerPill` — colored chip showing verb + target. Click to edit, backspace to delete.

**Step 4:** Implement `TriggerAutocomplete` — dropdown with verb list, then target list filtered by valid targets for that verb.

**Step 5:** Commit

---

#### Task 11: Block Cards + Block Add Flow

**Files:**
- Create: `src/editor/view/canvas/BlockCard.tsx`
- Create: `src/editor/view/canvas/BlockCardGrid.tsx`

**Step 1:** Implement `BlockCard` — thumbnail preview of block content. Shows kind icon, name, line count / node count. Click to open editor tab. Right-click to delete/rename.

**Step 2:** Implement `BlockCardGrid` — responsive grid of block cards. Bottom row: `[+ Code] [+ Data] [+ Diagram] [+ Math] [+ Chart] [+ Preview]` buttons. Each opens a name dialog then creates the block + opens its editor tab.

**Step 3:** Commit

---

### Phase 4: Block Editors

#### Task 12: Code Block Editor

**Files:**
- Create: `src/editor/view/canvas/block-editors/CodeBlockEditor.tsx`

**Step 1:** Implement `CodeBlockEditor` compound component:
- `Monaco` section — full Monaco editor with syntax highlighting (reuse existing Shiki setup)
- `RegionEditor` section — table of region name → line range, add/remove rows
- `AnnotationList` section — table of line → text, add/remove rows
- Language selector dropdown

**Step 2:** Wire to `useBlockEditor(name)` store actions.

**Step 3:** Commit

---

#### Task 13: Data Block Editor

**Files:**
- Create: `src/editor/view/canvas/block-editors/DataBlockEditor.tsx`

**Step 1:** Implement `DataBlockEditor`:
- Type selector (array, linked-list, tree, graph, stack, queue, etc.)
- Visual SVG canvas (reuse existing `Data.tsx` component for rendering, add click-to-select, drag-to-move)
- Node list (tabular: add/remove/edit nodes)
- Edge list (for link-based types)
- Pointer list (named pointers)
- Region editor

**Step 2:** Commit

---

#### Task 14: Diagram Block Editor

**Files:**
- Create: `src/editor/view/canvas/block-editors/DiagramBlockEditor.tsx`

**Step 1:** Implement `DiagramBlockEditor`:
- Visual canvas (reuse `Diagram.tsx` for rendering, add click-to-select, drag-to-reposition)
- Node palette (drag service/database/cache/queue/etc. onto canvas)
- Edge creation (click node → drag to another node)
- Group management
- Region editor

**Step 2:** Commit

---

#### Task 15: Math, Chart, Preview Block Editors

**Files:**
- Create: `src/editor/view/canvas/block-editors/MathBlockEditor.tsx`
- Create: `src/editor/view/canvas/block-editors/ChartBlockEditor.tsx`
- Create: `src/editor/view/canvas/block-editors/PreviewBlockEditor.tsx`

**Step 1:** `MathBlockEditor` — LaTeX text input (Monaco with tex mode) + live KaTeX preview pane.

**Step 2:** `ChartBlockEditor` — data table editor (spreadsheet-like grid) + chart type selector + live chart preview.

**Step 3:** `PreviewBlockEditor` — Monaco for HTML/React + template selector + live iframe preview.

**Step 4:** Commit

---

### Phase 5: Lab Editor

#### Task 16: Lab Config + Instructions + Scaffold

**Files:**
- Create: `src/editor/view/lab/LabConfigEditor.tsx`
- Create: `src/editor/view/lab/LabInstructionsEditor.tsx`
- Create: `src/editor/view/lab/LabScaffoldTree.tsx`
- Create: `src/editor/view/lab/LabServicePicker.tsx`

**Step 1:** `LabConfigEditor` — form fields for workspace mode, test command, setup commands, start commands, open files. Not raw YAML — structured form.

**Step 2:** `LabInstructionsEditor` — markdown editor (Monaco with markdown mode) + live preview.

**Step 3:** `LabScaffoldTree` — file tree showing scaffold directory. Context menu: new file, new dir, rename, delete. Click to open in Monaco tab.

**Step 4:** `LabServicePicker` — preset grid (postgres, redis, mysql, etc.) + custom service form. Click to add, x to remove.

**Step 5:** Commit

---

### Phase 6: Agent Integration

#### Task 17: opencode Client + MCP Tools

**Files:**
- Create: `src/editor/agent/opencode-client.ts`
- Create: `src/editor/agent/mcp-tools.ts`
- Create: `src/editor/agent/context-builder.ts`

**Step 1:** Implement opencode HTTP+SSE client — session create, message send, event stream parsing. Types for opencode API responses.

**Step 2:** Define MCP tool schemas for course authoring (see Part 4B above).

**Step 3:** Implement context builder — serialize current editor state into a context string the agent receives with each message.

**Step 4:** Commit

---

#### Task 18: Agent Store + Chat UI

**Files:**
- Create: `src/editor/viewmodel/agent-store.ts`
- Create: `src/editor/view/panel/Agent.tsx`
- Create: `src/editor/view/panel/AgentMessage.tsx`
- Create: `src/editor/view/panel/AgentSuggestion.tsx`

**Step 1:** Implement `AgentStore` — session management, message list, streaming state, suggestion tracking.

**Step 2:** Implement `Agent` chat UI — message list, input box (Cmd+Enter to send), streaming indicator.

**Step 3:** Implement `AgentMessage` — renders user and assistant messages. Assistant messages may contain `AgentSuggestion` cards.

**Step 4:** Implement `AgentSuggestion` — diff-like card with [Apply] / [Reject]. Apply dispatches the corresponding viewmodel action and updates suggestion status.

**Step 5:** Commit

---

### Phase 7: Timeline + Preview

#### Task 19: Scene Timeline

**Files:**
- Create: `src/editor/view/bottom/Timeline.tsx`

**Step 1:** Implement scene timeline — horizontal strip of scene thumbnails computed from current step's scenes. Click to preview. Shows trigger verb labels on each transition.

**Step 2:** Commit

---

#### Task 20: Preview Player

**Files:**
- Create: `src/editor/view/bottom/PreviewPlayer.tsx`

**Step 1:** Embed existing `Presentation` component in a preview pane. Feed it the current step's computed `ParsedLesson` (single step). Play/pause/scrub controls.

**Step 2:** Add TTS preview — synthesize narration for current step, play back with scene sync.

**Step 3:** Commit

---

### Phase 8: Right Panel + Source View

#### Task 21: Inspector Panel

**Files:**
- Create: `src/editor/view/panel/Inspector.tsx`

**Step 1:** Context-sensitive inspector:
- Step selected → title, block count, scene count, narration word count
- Block selected → kind-specific properties (lang, regions, annotations for code; type, node count for data; etc.)
- Lab selected → config summary, service list
- Nothing selected → course-level properties

**Step 2:** Commit

---

#### Task 22: Source View (Markdown Editor)

**Files:**
- Create: `src/editor/view/canvas/SourceEditor.tsx`

**Step 1:** When viewMode === "source", show Monaco with the serialized markdown for the current step. Changes parse back to IR and update the step editor store.

**Step 2:** Two-way sync: source changes → reparse → update visual state. Visual changes → reserialize → update source.

**Step 3:** Commit

---

### Phase 9: Polish

#### Task 23: Keyboard Shortcuts

- `Cmd+S` — Save
- `Cmd+Z` / `Cmd+Shift+Z` — Undo / Redo
- `Cmd+L` — Focus agent chat
- `Cmd+B` — Toggle sidebar
- `Cmd+J` — Toggle bottom bar
- `Cmd+\\` — Toggle right panel
- `Cmd+P` — Quick open (step/block/lab by name)
- `Cmd+Shift+P` — Command palette

#### Task 24: Diagnostics Panel

**Files:**
- Create: `src/editor/view/sidebar/DiagnosticsPanel.tsx`
- Create: `src/editor/view/bottom/DiagnosticsTable.tsx`

Recompute diagnostics on every change. Show in sidebar (compact) and bottom bar (full table with click-to-navigate).

#### Task 25: Responsive Polish

- Breakpoint detection (ResizeObserver on root)
- Panel auto-collapse thresholds
- Touch-friendly: 44px tap targets on all buttons/tabs
- `@media (hover: hover)` for hover effects
- `prefers-reduced-motion` for all animations

#### Task 26: Routing Integration

Add `"editor"` to the existing `Route` discriminated union:

```ts
type Route =
  | { readonly kind: "browser" }
  | { readonly kind: "course"; courseId: string; stepIndex: number }
  | { readonly kind: "editor"; courseId: string }  // NEW
```

Wire up in `App.tsx`: render `<CourseEditor courseId={route.courseId} />` for editor route.

---

## Dependency Graph

```
Task 1 (foundation)
├── Task 2 (editable types) → Task 3 (serializer)
├── Task 4 (editor store) → Task 5 (step + block stores) → Task 6 (lab store)
├── Task 7 (layout shell) → Task 8 (sidebar) → Task 9 (tabs + canvas)
│   ├── Task 10 (step overview + narration)
│   │   └── Task 11 (block cards)
│   │       ├── Task 12 (code editor)
│   │       ├── Task 13 (data editor)
│   │       ├── Task 14 (diagram editor)
│   │       └── Task 15 (math/chart/preview editors)
│   └── Task 16 (lab editor)
├── Task 17 (opencode client) → Task 18 (agent UI)
├── Task 19 (timeline) + Task 20 (preview)
├── Task 21 (inspector) + Task 22 (source view)
└── Tasks 23-26 (polish)
```

Tasks on separate branches of the tree can be parallelized.

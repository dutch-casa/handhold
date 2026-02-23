# Studio Canvas — Visual Editor Redesign

The canvas IS the editor. You don't configure animations in forms — you draw them.
Right-click to add. Drag to arrange. Click to select. Double-click to edit.
The DSL is an IR that the user never sees.

## Layout

```
┌──────┬──────────────────────────────────┬──────────┐
│      │                                  │          │
│Course│        CANVAS                    │  Agent   │
│Tree  │   (dark, full bleed)             │  (chat)  │
│      │   blocks live here               │          │
│      │   drag them, resize them         │ opencode │
│      │   right-click → radial menu      │  only    │
│      │                                  │          │
│      ├──┬──┬──┬──┬──┬──┬───────────────┤          │
│      │S1│S2│S3│S4│S5│S6│  + add scene  │          │
│      ├──┴──┴──┴──┴──┴──┴───────────────┤          │
│      │ 🎤 Speaker notes for scene S3   │          │
│      │ [plain text, what TTS will say]  │          │
└──────┴──────────────────────────────────┴──────────┘
```

- **Left**: Course tree (as-is). Click step → loads in canvas.
- **Center top**: Live canvas. Dark bg. Blocks rendered at actual size. Draggable, resizable.
- **Center bottom**: Scene filmstrip + speaker notes. Filmstrip = horizontal thumbnails. Click to navigate. Drag to reorder.
- **Right**: Agent chat. Opencode ONLY. No provider picker. No Anthropic/OpenAI config.

## Canvas Interactions

**Right-click anywhere on canvas** → Radial menu appears at cursor:
- Add Code block
- Add Data Structure block
- Add Diagram block
- Add Math block
- Add Chart block
- Add trigger (show/hide/transform/focus/etc)

**Click a block** → Selected. Blue ring. Resize handles at corners/edges.
**Double-click a block** → Inline edit mode (Monaco for code, property card for others).
**Drag a block** → Moves it on the canvas. Snap guides appear.
**Delete key** → Removes selected block.
**Escape** → Deselect.

## Scene Filmstrip

Horizontal strip at bottom of canvas area. Each scene = a thumbnail card showing a miniature of the canvas state.

- Click scene → canvas shows that scene
- Drag scenes → reorder
- `+` button → add new scene after current
- Right-click scene → duplicate, delete, insert before/after
- Current scene has blue border

## Speaker Notes

Below the filmstrip. Plain textarea. One text block per scene.
This is what TTS reads. No triggers in the text — triggers are on the canvas.
Each scene has its own narration text.

## Agent Panel

- Opencode only — remove AIProviderSettings entirely
- Remove the provider/model picker dropdown
- Just: connection status + chat messages + input
- Agent has context about the current step, blocks, and scenes

## New Folder Structure

```
src/studio/                    # New feature folder — the visual editor
  view/
    StudioCanvas.tsx           # Main canvas surface (dnd-kit + motion)
    RadialMenu.tsx             # Right-click context menu (circular/arc layout)
    SceneStrip.tsx             # Bottom filmstrip (horizontal, draggable)
    SpeakerNotes.tsx           # Per-scene narration textarea
    BlockHandle.tsx            # Selection ring + resize handles
    CanvasBlock.tsx            # Renders a single block on canvas (delegates to primitives)
  viewmodel/
    studio-store.ts            # Canvas state: selection, drag, scene nav, block positions
  model/
    canvas-layout.ts           # Block position/size types, snap-to-grid math
```

The existing `src/editor/` still handles:
- Course tree / step navigation
- Lab workshop (already good)
- Overall layout shell (sidebar + center + right panel)

`src/studio/` is what renders inside the center panel when editing a lesson step.

## Invariants

- S1: One block selected at a time (or none). `selectedBlock: string | null`.
- S2: Scene index always valid: `0 <= currentScene < scenes.length`.
- S3: Block positions are per-scene. Moving a block in scene 3 doesn't affect scene 1.
- S4: Speaker notes are per-scene. `narration[sceneIndex]`.
- S5: Radial menu only appears on right-click. Dismissed on any other click.
- S6: Canvas blocks are the source of truth for VisualizationState. No forms.

## What Gets Deleted

- `src/editor/view/canvas/StepWysiwyg.tsx` — replaced by StudioCanvas
- `src/editor/view/canvas/ScriptEditor.tsx` — replaced by SpeakerNotes
- `src/editor/view/canvas/EditorStage.tsx` — subsumed into StudioCanvas
- `src/editor/view/panel/AIProviderSettings.tsx` — opencode only, no config needed
- Agent provider picker UI in agent-store — just opencode

## Build Order (Incremental)

1. **StudioCanvas shell** — dark canvas, renders existing blocks from step store, no interactions yet
2. **Block selection + handles** — click to select, blue ring, escape to deselect
3. **Block dragging** — dnd-kit, snap to grid, position stored in store
4. **Radial menu** — right-click spawns menu, add block flow
5. **Scene strip** — filmstrip at bottom, click to navigate, current scene highlight
6. **Speaker notes** — textarea per scene, wired to narration store
7. **Block resize** — drag handles on selected block corners
8. **Inline editing** — double-click block → Monaco/property card
9. **Trigger menu** — right-click block → add trigger (show/hide/transform)
10. **Agent cleanup** — strip provider config, opencode-only

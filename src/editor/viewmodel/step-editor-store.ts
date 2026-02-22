// Per-step editor store. Factory-scoped: one store per step being edited.
// Manages narration, triggers, blocks, and scene preview for a single step.
// Scene recomputation is automatic — any mutation that changes narration or blocks
// triggers compileScenes() and updates the derived scenes array.

import { create, type StoreApi, type UseBoundStore } from "zustand";
import type { SceneState, TriggerVerb, VisualizationState } from "@/types/lesson";
import type {
  EditableStep,
  EditableBlock,
  EditableNarration,
  EditableRegion,
} from "@/editor/model/types";
import { compileScenes } from "@/editor/model/scene-compiler";

// --- Status typestate ---

export type StepEditorStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "editing-narration"; readonly paragraphIndex: number }
  | { readonly kind: "editing-trigger"; readonly paragraphIndex: number; readonly triggerIndex: number }
  | { readonly kind: "previewing-scene"; readonly sceneIndex: number };

// --- State ---

type StepEditorState = {
  readonly status: StepEditorStatus;
  readonly step: EditableStep;
  readonly scenes: readonly SceneState[];
  readonly selectedBlockName: string | null;
  readonly selectedParagraphIndex: number | null;
};

// --- Actions ---

type StepEditorActions = {
  // Narration
  selectParagraph(index: number): void;
  updateNarrationText(paragraphIndex: number, text: string): void;
  addParagraph(afterIndex: number): void;
  removeParagraph(index: number): void;

  // Triggers
  addTrigger(paragraphIndex: number, wordIndex: number, verb: TriggerVerb): void;
  updateTrigger(paragraphIndex: number, triggerIndex: number, verb: TriggerVerb): void;
  removeTrigger(paragraphIndex: number, triggerIndex: number): void;

  // Blocks
  addBlock(kind: VisualizationState["kind"], name: string): void;
  removeBlock(name: string): void;
  selectBlock(name: string): void;

  // Preview
  previewScene(index: number): void;
  exitPreview(): void;
};

export type StepEditorStore = StepEditorState & StepEditorActions;

// --- Helpers ---

function recompileScenes(step: EditableStep): readonly SceneState[] {
  try {
    return compileScenes(step);
  } catch {
    // Compile can fail during intermediate editing states.
    // Return empty scenes rather than crashing the editor.
    return [];
  }
}

function triggerTextForVerb(verb: TriggerVerb): string {
  if ("target" in verb) return verb.target;
  if ("targets" in verb) return verb.targets.join(", ");
  return verb.verb;
}

function makeEmptyBlock(kind: VisualizationState["kind"], name: string): EditableBlock {
  switch (kind) {
    case "code":
      return { kind: "code", name, lang: "typescript", fileName: "", content: "", regions: [], annotations: [] };
    case "data":
      return { kind: "data", name, data: { type: "array", values: [], pointers: [] }, regions: [] };
    case "diagram":
      return { kind: "diagram", name, nodes: [], edges: [], groups: [], regions: [] };
    case "math":
      return { kind: "math", name, expressions: [], regions: [] };
    case "chart":
      return { kind: "chart", name, chartKind: "bar", series: [], annotations: [], shadedRegions: [], regions: [] };
    case "preview":
      return { kind: "preview", name, source: "", template: "html", regions: [] };
  }
}

// --- Factory ---

export function createStepEditorStore(
  step: EditableStep,
): UseBoundStore<StoreApi<StepEditorStore>> {
  const initialScenes = recompileScenes(step);

  return create<StepEditorStore>((set, get) => ({
    status: { kind: "idle" },
    step,
    scenes: initialScenes,
    selectedBlockName: null,
    selectedParagraphIndex: null,

    // --- Narration ---

    selectParagraph: (index) => {
      const { step: s } = get();
      if (index < 0 || index >= s.narration.length) return;

      set({
        status: { kind: "editing-narration", paragraphIndex: index },
        selectedParagraphIndex: index,
      });
    },

    updateNarrationText: (paragraphIndex, text) => {
      const { step: s } = get();
      const para = s.narration[paragraphIndex];
      if (!para) return;

      para.text = text;
      const scenes = recompileScenes(s);
      set({ step: { ...s }, scenes });
    },

    addParagraph: (afterIndex) => {
      const { step: s } = get();
      if (afterIndex < -1 || afterIndex >= s.narration.length) return;

      const newPara: EditableNarration = { text: "", triggers: [] };
      s.narration.splice(afterIndex + 1, 0, newPara);
      const scenes = recompileScenes(s);
      set({
        step: { ...s },
        scenes,
        status: { kind: "editing-narration", paragraphIndex: afterIndex + 1 },
        selectedParagraphIndex: afterIndex + 1,
      });
    },

    removeParagraph: (index) => {
      const { step: s } = get();
      if (index < 0 || index >= s.narration.length) return;
      if (s.narration.length <= 1) return; // keep at least one paragraph

      s.narration.splice(index, 1);
      const scenes = recompileScenes(s);

      // Adjust selection: snap to nearest valid index.
      const nextIndex = Math.min(index, s.narration.length - 1);
      set({
        step: { ...s },
        scenes,
        status: { kind: "idle" },
        selectedParagraphIndex: s.narration.length > 0 ? nextIndex : null,
      });
    },

    // --- Triggers ---

    addTrigger: (paragraphIndex, wordIndex, verb) => {
      const { step: s } = get();
      const para = s.narration[paragraphIndex];
      if (!para) return;

      const trigger = {
        wordIndex,
        text: triggerTextForVerb(verb),
        action: verb,
      };
      para.triggers.push(trigger);
      // Keep triggers sorted by wordIndex for deterministic scene compilation.
      para.triggers.sort((a, b) => a.wordIndex - b.wordIndex);

      const scenes = recompileScenes(s);
      set({ step: { ...s }, scenes });
    },

    updateTrigger: (paragraphIndex, triggerIndex, verb) => {
      const { step: s } = get();
      const para = s.narration[paragraphIndex];
      if (!para) return;
      const trigger = para.triggers[triggerIndex];
      if (!trigger) return;

      trigger.action = verb;
      trigger.text = triggerTextForVerb(verb);

      const scenes = recompileScenes(s);
      set({ step: { ...s }, scenes });
    },

    removeTrigger: (paragraphIndex, triggerIndex) => {
      const { step: s } = get();
      const para = s.narration[paragraphIndex];
      if (!para) return;
      if (triggerIndex < 0 || triggerIndex >= para.triggers.length) return;

      para.triggers.splice(triggerIndex, 1);
      const scenes = recompileScenes(s);
      set({
        step: { ...s },
        scenes,
        status: { kind: "idle" },
      });
    },

    // --- Blocks ---

    addBlock: (kind, name) => {
      const { step: s } = get();
      if (s.blocks.has(name)) return; // name collision guard

      const block = makeEmptyBlock(kind, name);
      s.blocks.set(name, block);
      const scenes = recompileScenes(s);
      set({ step: { ...s }, scenes, selectedBlockName: name });
    },

    removeBlock: (name) => {
      const { step: s, selectedBlockName } = get();
      if (!s.blocks.has(name)) return;

      s.blocks.delete(name);
      const scenes = recompileScenes(s);
      set({
        step: { ...s },
        scenes,
        selectedBlockName: selectedBlockName === name ? null : selectedBlockName,
      });
    },

    selectBlock: (name) => {
      const { step: s } = get();
      if (!s.blocks.has(name)) return;
      set({ selectedBlockName: name });
    },

    // --- Preview ---

    previewScene: (index) => {
      const { scenes } = get();
      if (index < 0 || index >= scenes.length) return;
      set({ status: { kind: "previewing-scene", sceneIndex: index } });
    },

    exitPreview: () => {
      set({ status: { kind: "idle" } });
    },
  }));
}

// --- Selectors ---

export type StepEditorSlice = {
  readonly status: StepEditorStatus;
  readonly step: EditableStep;
  readonly scenes: readonly SceneState[];
  readonly selectedBlockName: string | null;
  readonly selectedParagraphIndex: number | null;
  readonly selectedBlock: EditableBlock | undefined;
  readonly regions: readonly EditableRegion[];
};

export function selectStepEditorSlice(s: StepEditorStore): StepEditorSlice {
  const selectedBlock = s.selectedBlockName
    ? s.step.blocks.get(s.selectedBlockName)
    : undefined;

  return {
    status: s.status,
    step: s.step,
    scenes: s.scenes,
    selectedBlockName: s.selectedBlockName,
    selectedParagraphIndex: s.selectedParagraphIndex,
    selectedBlock,
    regions: selectedBlock ? selectedBlock.regions : [],
  };
}

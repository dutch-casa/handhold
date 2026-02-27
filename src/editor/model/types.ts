// Editable domain types — mutable mirrors of the readonly IR types.
// Authors edit these; scenes are derived by compiling back through buildSceneSequence.

import type {
  TriggerVerb,
  DataState,
  DiagramNodeType,
  ChartKind,
  PreviewTemplate,
} from "@/types/lesson";

// --- Type-level utilities ---

// Strip readonly recursively. Converts readonly IR types to mutable editor versions.
// Handles objects, arrays, ReadonlyArrays, ReadonlyMaps, Maps, and primitives.
export type DeepMutable<T> = T extends ReadonlyMap<infer K, infer V>
  ? Map<DeepMutable<K>, DeepMutable<V>>
  : T extends ReadonlySet<infer U>
    ? Set<DeepMutable<U>>
    : T extends readonly (infer U)[]
      ? DeepMutable<U>[]
      : T extends object
        ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
        : T;

// --- Tab system ---

export type EditorTabTarget =
  | { readonly kind: "step-overview"; readonly stepId: string }
  | {
      readonly kind: "code-block";
      readonly stepId: string;
      readonly blockName: string;
    }
  | {
      readonly kind: "data-block";
      readonly stepId: string;
      readonly blockName: string;
    }
  | {
      readonly kind: "diagram-block";
      readonly stepId: string;
      readonly blockName: string;
    }
  | {
      readonly kind: "math-block";
      readonly stepId: string;
      readonly blockName: string;
    }
  | {
      readonly kind: "chart-block";
      readonly stepId: string;
      readonly blockName: string;
    }
  | {
      readonly kind: "preview-block";
      readonly stepId: string;
      readonly blockName: string;
    }
  | { readonly kind: "lab-config"; readonly stepId: string }
  | { readonly kind: "lab-instructions"; readonly stepId: string }
  | {
      readonly kind: "lab-scaffold";
      readonly stepId: string;
      readonly filePath: string;
    }
  | { readonly kind: "source"; readonly stepId: string };

export type EditorTab = {
  readonly id: string;
  readonly target: EditorTabTarget;
  readonly label: string;
  readonly dirty: boolean;
  readonly pinned: boolean;
};

// Deterministic tab ID from target — used for dedup.
export function tabId(target: EditorTabTarget): string {
  switch (target.kind) {
    case "step-overview":
      return `overview:${target.stepId}`;
    case "code-block":
      return `code:${target.stepId}:${target.blockName}`;
    case "data-block":
      return `data:${target.stepId}:${target.blockName}`;
    case "diagram-block":
      return `diagram:${target.stepId}:${target.blockName}`;
    case "math-block":
      return `math:${target.stepId}:${target.blockName}`;
    case "chart-block":
      return `chart:${target.stepId}:${target.blockName}`;
    case "preview-block":
      return `preview:${target.stepId}:${target.blockName}`;
    case "lab-config":
      return `lab-config:${target.stepId}`;
    case "lab-instructions":
      return `lab-instructions:${target.stepId}`;
    case "lab-scaffold":
      return `lab-scaffold:${target.stepId}:${target.filePath}`;
    case "source":
      return `source:${target.stepId}`;
  }
}

// Human-readable tab label from target.
export function tabLabel(target: EditorTabTarget): string {
  switch (target.kind) {
    case "step-overview":
      return "Overview";
    case "code-block":
      return target.blockName;
    case "data-block":
      return target.blockName;
    case "diagram-block":
      return target.blockName;
    case "math-block":
      return target.blockName;
    case "chart-block":
      return target.blockName;
    case "preview-block":
      return target.blockName;
    case "lab-config":
      return "Lab Config";
    case "lab-instructions":
      return "Instructions";
    case "lab-scaffold":
      return target.filePath.split("/").pop() ?? target.filePath;
    case "source":
      return "Source";
  }
}

// --- Editable narration ---

export type EditableNarration = {
  text: string;
  triggers: Array<{
    wordIndex: number;
    text: string;
    action: TriggerVerb;
  }>;
};

// --- Editable regions ---

export type EditableRegion = {
  name: string;
  target: string;
};

// --- Editable blocks: mutable authoring state for each visualization kind ---

export type EditableCodeBlock = {
  readonly kind: "code";
  name: string;
  lang: string;
  fileName: string;
  content: string;
  regions: EditableRegion[];
  annotations: Array<{ line: number; text: string }>;
};

export type EditableDataBlock = {
  readonly kind: "data";
  name: string;
  data: DeepMutable<DataState["data"]>;
  regions: EditableRegion[];
};

export type EditableDiagramBlock = {
  readonly kind: "diagram";
  name: string;
  nodes: Array<{
    id: string;
    label: string;
    nodeType: DiagramNodeType;
    icon?: string | undefined;
  }>;
  edges: Array<{ fromId: string; toId: string; label: string }>;
  groups: Array<{ name: string; memberIds: string[] }>;
  regions: EditableRegion[];
};

export type EditableMathBlock = {
  readonly kind: "math";
  name: string;
  expressions: Array<{ id: string; latex: string }>;
  regions: EditableRegion[];
};

export type EditableChartBlock = {
  readonly kind: "chart";
  name: string;
  chartKind: ChartKind;
  series: Array<{ name: string; data: Array<{ label: string; value: number }> }>;
  annotations: Array<{ label: string; text: string }>;
  shadedRegions: Array<{ from: string; to: string; color: string }>;
  regions: EditableRegion[];
};

export type EditablePreviewBlock = {
  readonly kind: "preview";
  name: string;
  source: string;
  template: PreviewTemplate;
  regions: EditableRegion[];
};

export type EditableBlock =
  | EditableCodeBlock
  | EditableDataBlock
  | EditableDiagramBlock
  | EditableMathBlock
  | EditableChartBlock
  | EditablePreviewBlock;

// --- Editable step: one H1 section ---

export type EditableStep = {
  id: string;
  title: string;
  narration: EditableNarration[];
  blocks: Map<string, EditableBlock>;
};

// --- Editable lab ---

export type EditableService = {
  name: string;
  image: string;
  port: number;
  hostPort: number;
  env: Record<string, string>;
  healthcheck: string;
};

export type EditableLab = {
  title: string;
  instructions: string;
  workspace: "fresh" | "continue";
  testCommand: string;
  openFiles: string[];
  services: EditableService[];
  setup: string[];
  scaffoldPath: string;
};

// --- Editable course ---

export type EditableCourseStep =
  | {
      readonly kind: "lesson";
      readonly id: string;
      title: string;
      steps: EditableStep[];
    }
  | {
      readonly kind: "lab";
      readonly id: string;
      title: string;
      lab: EditableLab;
    };

export type EditableCourse = {
  title: string;
  steps: EditableCourseStep[];
};

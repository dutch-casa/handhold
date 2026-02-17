// Lesson IR — the contract between parser and renderer.
// Every field is structurally required. No optionals in the domain model.

// --- Named regions: sub-element addressing within any block ---

export type RegionDef = {
  readonly name: string;
  readonly target: string;
};

// --- Animation: opt-in per-slot enter/exit effects ---

export type AnimationEffect =
  | "fade"
  | "slide"
  | "slide-up"
  | "grow"
  | "typewriter"
  | "none";

export type EasingKind = "ease-out" | "ease-in-out" | "spring" | "linear";

// Tagged union — absence of custom animation is an explicit variant, not a missing field.
export type AnimationOverride =
  | { readonly kind: "default" }
  | {
      readonly kind: "custom";
      readonly effect: AnimationEffect;
      readonly durationS: number;
      readonly easing: EasingKind;
    };

export const DEFAULT_ANIMATION: AnimationOverride = {
  kind: "default",
} as const;

// Flat struct stored in SceneState. One per entering/exiting slot.
export type SlotEnterEffect = {
  readonly target: string;
  readonly effect: AnimationEffect;
  readonly durationS: number;
  readonly easing: EasingKind;
};

// --- Trigger verbs: the scene-control DSL ---

export type TransitionKind = "fade" | "slide" | "instant";

export type TriggerVerb =
  | {
      readonly verb: "show";
      readonly target: string;
      readonly animation: AnimationOverride;
    }
  | {
      readonly verb: "hide";
      readonly target: string;
      readonly animation: AnimationOverride;
    }
  | {
      readonly verb: "clear";
      readonly transition: TransitionKind;
      readonly animation: AnimationOverride;
    }
  | { readonly verb: "split" }
  | { readonly verb: "unsplit" }
  | { readonly verb: "focus"; readonly target: string }
  | {
      readonly verb: "annotate";
      readonly target: string;
      readonly text: string;
    }
  | {
      readonly verb: "zoom";
      readonly scale: number;
      readonly target: string;
    }
  | { readonly verb: "flow"; readonly target: string }
  | { readonly verb: "advance" };

export type Trigger = {
  readonly wordIndex: number;
  readonly text: string;
  readonly action: TriggerVerb;
};

// --- Narration ---

export type NarrationBlock = {
  readonly text: string;
  readonly triggers: readonly Trigger[];
};

// --- Code ---

export type CodeAnnotation = {
  readonly line: number;
  readonly text: string;
};

export type FocusRange = {
  readonly start: number;
  readonly end: number;
};

export type CodeState = {
  readonly kind: "code";
  readonly name: string;
  readonly lang: string;
  readonly fileName: string;
  readonly content: string;
  readonly focus: readonly FocusRange[];
  readonly annotations: readonly CodeAnnotation[];
  readonly regions: readonly RegionDef[];
};

// --- Data Structures ---

export type DataNodeDef = {
  readonly id: string;
  readonly value: string;
};

export type DataPointerDef = {
  readonly name: string;
  readonly targetId: string;
};

export type DataEdgeDef = {
  readonly fromId: string;
  readonly toId: string;
};

export type ArrayData = {
  readonly type: "array";
  readonly values: readonly string[];
  readonly pointers: readonly DataPointerDef[];
};

export type LinkedListData = {
  readonly type: "linked-list";
  readonly nodes: readonly DataNodeDef[];
  readonly edges: readonly DataEdgeDef[];
  readonly pointers: readonly DataPointerDef[];
  readonly hasNull: boolean;
  readonly floatingGroups: readonly (readonly DataNodeDef[])[];
};

export type BinaryTreeData = {
  readonly type: "binary-tree";
  readonly nodes: readonly DataNodeDef[];
  readonly edges: readonly DataEdgeDef[];
  readonly pointers: readonly DataPointerDef[];
};

export type StackData = {
  readonly type: "stack";
  readonly values: readonly string[];
  readonly topIndex: number;
};

export type HashMapData = {
  readonly type: "hash-map";
  readonly buckets: readonly {
    readonly index: number;
    readonly chain: readonly DataNodeDef[];
  }[];
};

export type GraphEdgeDef = {
  readonly fromId: string;
  readonly toId: string;
  readonly weight: string;
};

export type GraphLayoutKind = "ring" | "force" | "tree" | "grid" | "bipartite";

export type GraphData = {
  readonly type: "graph";
  readonly nodes: readonly DataNodeDef[];
  readonly edges: readonly GraphEdgeDef[];
  readonly pointers: readonly DataPointerDef[];
  readonly directed: boolean;
  readonly layout: GraphLayoutKind;
};

export type DataState = {
  readonly kind: "data";
  readonly name: string;
  readonly data:
    | ArrayData
    | LinkedListData
    | BinaryTreeData
    | StackData
    | HashMapData
    | GraphData;
  readonly regions: readonly RegionDef[];
};

// --- Diagrams ---

export type DiagramNodeType =
  | "client"
  | "service"
  | "database"
  | "cache"
  | "queue";

export type DiagramNodeDef = {
  readonly id: string;
  readonly label: string;
  readonly nodeType: DiagramNodeType;
};

export type DiagramEdgeDef = {
  readonly fromId: string;
  readonly toId: string;
  readonly label: string;
};

export type DiagramGroupDef = {
  readonly name: string;
  readonly memberIds: readonly string[];
};

export type DiagramState = {
  readonly kind: "diagram";
  readonly name: string;
  readonly nodes: readonly DiagramNodeDef[];
  readonly edges: readonly DiagramEdgeDef[];
  readonly groups: readonly DiagramGroupDef[];
  readonly regions: readonly RegionDef[];
};

// --- Math ---

export type MathExpression = {
  readonly id: string;
  readonly latex: string;
};

export type MathState = {
  readonly kind: "math";
  readonly name: string;
  readonly expressions: readonly MathExpression[];
  readonly regions: readonly RegionDef[];
};

// --- Preview ---

export type PreviewTemplate = "html" | "react";

export type PreviewState = {
  readonly kind: "preview";
  readonly name: string;
  readonly source: string;
  readonly template: PreviewTemplate;
  readonly regions: readonly RegionDef[];
};

// --- Chart ---

export type ChartKind = "bar" | "line" | "scatter" | "area";

export type ChartDataPoint = {
  readonly label: string;
  readonly value: number;
};

export type ChartSeries = {
  readonly name: string;
  readonly data: readonly ChartDataPoint[];
};

export type ChartAnnotation = {
  readonly label: string;
  readonly text: string;
};

export type ShadedRegion = {
  readonly from: string;
  readonly to: string;
  readonly color: string;
};

export type ChartState = {
  readonly kind: "chart";
  readonly name: string;
  readonly chartKind: ChartKind;
  readonly series: readonly ChartSeries[];
  readonly annotations: readonly ChartAnnotation[];
  readonly shadedRegions: readonly ShadedRegion[];
  readonly regions: readonly RegionDef[];
};

// --- Visualization: discriminated union ---

export type VisualizationState =
  | CodeState
  | DataState
  | DiagramState
  | MathState
  | ChartState
  | PreviewState;

// --- Scene: a single frame of the presentation ---
// enterEffects/exitEffects empty = default behavior. epoch bumps on clear.

export type SceneAnnotation = {
  readonly target: string;
  readonly text: string;
};

export type SceneState = {
  readonly slots: readonly VisualizationState[];
  readonly transition: TransitionKind;
  readonly enterEffects: readonly SlotEnterEffect[];
  readonly exitEffects: readonly SlotEnterEffect[];
  readonly epoch: number;
  readonly focus: string;
  readonly flow: string;
  readonly annotations: readonly SceneAnnotation[];
  readonly zoom: { readonly scale: number; readonly target: string };
};

// --- Step: one H1 section of a lesson ---

export type LessonStep = {
  readonly id: string;
  readonly title: string;
  readonly narration: readonly NarrationBlock[];
  readonly blocks: ReadonlyMap<string, VisualizationState>;
  readonly scenes: readonly SceneState[];
};

// --- Lesson: the top-level parsed result ---

export type ParsedLesson = {
  readonly title: string;
  readonly steps: readonly LessonStep[];
};

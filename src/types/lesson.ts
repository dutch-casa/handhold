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

export type EasingKind =
  | "ease-out"
  | "ease-in-out"
  | "spring"
  | "linear"
  | "reveal"
  | "emphasis"
  | "handoff";

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
      readonly verb: "show-group";
      readonly targets: readonly string[];
      readonly animation: AnimationOverride;
    }
  | {
      readonly verb: "hide";
      readonly target: string;
      readonly animation: AnimationOverride;
    }
  | {
      readonly verb: "hide-group";
      readonly targets: readonly string[];
      readonly animation: AnimationOverride;
    }
  | {
      readonly verb: "transform";
      readonly from: string;
      readonly to: string;
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
  | { readonly verb: "pulse"; readonly target: string }
  | { readonly verb: "trace"; readonly target: string }
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
  | { readonly verb: "pan"; readonly target: string }
  | { readonly verb: "draw"; readonly target: string }
  | { readonly verb: "play"; readonly target: string }
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

// N-ary tree: replaces BinaryTreeData. Variant controls rendering hints
// (color dots for red-black, balance factors for AVL, etc.)
export type TreeNodeDef = {
  readonly id: string;
  readonly value: string;
  readonly children: readonly string[];
  readonly annotation: string;
};

export type TreeVariant =
  | "generic"
  | "bst"
  | "avl"
  | "red-black"
  | "heap-min"
  | "heap-max"
  | "splay"
  | "treap"
  | "aa"
  | "segment"
  | "interval"
  | "fenwick"
  | "merkle"
  | "kd"
  | "rope";

export type TreeData = {
  readonly type: "tree";
  readonly variant: TreeVariant;
  readonly nodes: readonly TreeNodeDef[];
  readonly rootId: string;
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

export type QueueData = {
  readonly type: "queue";
  readonly values: readonly string[];
  readonly front: number;
  readonly rear: number;
  readonly pointers: readonly DataPointerDef[];
};

export type DequeData = {
  readonly type: "deque";
  readonly values: readonly string[];
  readonly front: number;
  readonly rear: number;
  readonly pointers: readonly DataPointerDef[];
};

export type RingBufferData = {
  readonly type: "ring-buffer";
  readonly values: readonly string[];
  readonly head: number;
  readonly tail: number;
  readonly capacity: number;
};

export type DoublyLinkedListData = {
  readonly type: "doubly-linked-list";
  readonly nodes: readonly DataNodeDef[];
  readonly edges: readonly DataEdgeDef[];
  readonly pointers: readonly DataPointerDef[];
  readonly hasNull: boolean;
};

export type SkipListLevel = {
  readonly level: number;
  readonly nodeIds: readonly string[];
};

export type SkipListData = {
  readonly type: "skip-list";
  readonly nodes: readonly DataNodeDef[];
  readonly levels: readonly SkipListLevel[];
  readonly pointers: readonly DataPointerDef[];
};

export type BTreeNodeDef = {
  readonly id: string;
  readonly keys: readonly string[];
  readonly children: readonly string[];
};

export type BTreeVariant = "b-tree" | "b-plus-tree" | "2-3-tree" | "2-3-4-tree";

export type BTreeData = {
  readonly type: "b-tree";
  readonly variant: BTreeVariant;
  readonly nodes: readonly BTreeNodeDef[];
  readonly rootId: string;
  readonly order: number;
  readonly pointers: readonly DataPointerDef[];
  readonly leafLinks: boolean;
};

export type TrieNodeDef = {
  readonly id: string;
  readonly value: string;
  readonly terminal: boolean;
  readonly children: readonly string[];
};

export type TrieVariant = "trie" | "radix-tree" | "suffix-tree";

export type TrieData = {
  readonly type: "trie";
  readonly variant: TrieVariant;
  readonly nodes: readonly TrieNodeDef[];
  readonly rootId: string;
  readonly pointers: readonly DataPointerDef[];
};

export type BitArrayVariant =
  | "bloom-filter"
  | "cuckoo-filter"
  | "count-min-sketch"
  | "hyperloglog";

export type HashHighlight = {
  readonly name: string;
  readonly indices: readonly number[];
};

export type BitArrayData = {
  readonly type: "bit-array";
  readonly variant: BitArrayVariant;
  readonly bits: readonly number[];
  readonly hashHighlights: readonly HashHighlight[];
  readonly rows: number;
};

export type MatrixData = {
  readonly type: "matrix";
  readonly rows: readonly (readonly string[])[];
  readonly rowLabels: readonly string[];
  readonly colLabels: readonly string[];
};

export type UnionFindData = {
  readonly type: "union-find";
  readonly elements: readonly string[];
  readonly parent: readonly number[];
  readonly rank: readonly number[];
  readonly pointers: readonly DataPointerDef[];
};

export type LsmTreeData = {
  readonly type: "lsm-tree";
  readonly memtable: readonly string[];
  readonly levels: readonly {
    readonly name: string;
    readonly runs: readonly (readonly string[])[];
  }[];
};

export type FibonacciHeapData = {
  readonly type: "fibonacci-heap";
  readonly trees: readonly {
    readonly rootId: string;
    readonly nodes: readonly TreeNodeDef[];
  }[];
  readonly minId: string;
  readonly markedIds: readonly string[];
};

export type DataState = {
  readonly kind: "data";
  readonly name: string;
  readonly data:
    | ArrayData
    | LinkedListData
    | TreeData
    | StackData
    | HashMapData
    | GraphData
    | QueueData
    | DequeData
    | RingBufferData
    | DoublyLinkedListData
    | SkipListData
    | BTreeData
    | TrieData
    | BitArrayData
    | MatrixData
    | UnionFindData
    | LsmTreeData
    | FibonacciHeapData;
  readonly regions: readonly RegionDef[];
};

// --- Diagrams ---

export type DiagramNodeType =
  | "client"
  | "service"
  | "database"
  | "cache"
  | "queue"
  | "load-balancer"
  | "api-gateway"
  | "message-queue"
  | "user"
  | "server";

export type DiagramNodeDef = {
  readonly id: string;
  readonly label: string;
  readonly nodeType: DiagramNodeType;
  readonly icon?: string;
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

export type ChartKind = "bar" | "line" | "scatter" | "area" | "pie" | "radar" | "radial";

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
  readonly pulse: string;
  readonly trace: string;
  readonly transformFrom: readonly { readonly to: string; readonly from: string }[];
  readonly annotations: readonly SceneAnnotation[];
  readonly zoom: { readonly scale: number; readonly target: string };
  readonly pan: string;
  readonly draw: string;
};

// --- Step: one H1 section of a lesson ---

export type LessonStep = {
  readonly id: string;
  readonly title: string;
  readonly narration: readonly NarrationBlock[];
  readonly blocks: ReadonlyMap<string, VisualizationState>;
  readonly scenes: readonly SceneState[];
};

export type DiagnosticLocation =
  | { readonly kind: "lesson" }
  | { readonly kind: "step"; readonly stepId: string; readonly stepTitle: string }
  | {
      readonly kind: "paragraph";
      readonly stepId: string;
      readonly stepTitle: string;
      readonly paragraphIndex: number;
    }
  | {
      readonly kind: "trigger";
      readonly stepId: string;
      readonly stepTitle: string;
      readonly paragraphIndex: number;
      readonly triggerIndex: number;
    };

export type LessonDiagnostic = {
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly location: DiagnosticLocation;
};

// --- Lesson: the top-level parsed result ---

export type ParsedLesson = {
  readonly title: string;
  readonly steps: readonly LessonStep[];
  readonly diagnostics: readonly LessonDiagnostic[];
};

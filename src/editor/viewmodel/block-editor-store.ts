// Per-block editor store. Factory-scoped: one store per block being edited.
// Dispatches to kind-specific action sets (code, data, diagram, math, chart, preview).
// Each kind's actions mutate the block in place and signal Zustand with a spread.

import { create, type StoreApi, type UseBoundStore } from "zustand";
import type {
  DiagramNodeType,
  ChartKind,
  PreviewTemplate,
} from "@/types/lesson";
import type {
  EditableBlock,
  EditableCodeBlock,
  EditableDataBlock,
  EditableDiagramBlock,
  EditableMathBlock,
  EditableChartBlock,
  EditablePreviewBlock,
  EditableRegion,
} from "@/editor/model/types";

// --- Per-kind action types ---

export type CodeBlockActions = {
  updateContent(content: string): void;
  updateLang(lang: string): void;
  updateFileName(fileName: string): void;
  addRegion(name: string, target: string): void;
  removeRegion(name: string): void;
  addAnnotation(line: number, text: string): void;
  removeAnnotation(line: number): void;
};

export type DataBlockActions = {
  updateData(data: EditableDataBlock["data"]): void;
  addRegion(name: string, target: string): void;
  removeRegion(name: string): void;
};

export type DiagramBlockActions = {
  addNode(node: { id: string; label: string; nodeType: DiagramNodeType; icon?: string | undefined }): void;
  removeNode(id: string): void;
  updateNode(id: string, patch: Partial<{ label: string; nodeType: DiagramNodeType; icon: string }>): void;
  addEdge(fromId: string, toId: string, label: string): void;
  removeEdge(fromId: string, toId: string): void;
  addGroup(name: string, memberIds: string[]): void;
  removeGroup(name: string): void;
  addRegion(name: string, target: string): void;
  removeRegion(name: string): void;
};

export type MathBlockActions = {
  addExpression(id: string, latex: string): void;
  updateExpression(id: string, latex: string): void;
  removeExpression(id: string): void;
  addRegion(name: string, target: string): void;
  removeRegion(name: string): void;
};

export type ChartBlockActions = {
  updateChartKind(chartKind: ChartKind): void;
  addSeries(name: string): void;
  removeSeries(name: string): void;
  addDataPoint(seriesName: string, label: string, value: number): void;
  removeDataPoint(seriesName: string, label: string): void;
  addAnnotation(label: string, text: string): void;
  removeAnnotation(label: string): void;
  addShadedRegion(from: string, to: string, color: string): void;
  removeShadedRegion(from: string, to: string): void;
  addRegion(name: string, target: string): void;
  removeRegion(name: string): void;
};

export type PreviewBlockActions = {
  updateSource(source: string): void;
  updateTemplate(template: PreviewTemplate): void;
  addRegion(name: string, target: string): void;
  removeRegion(name: string): void;
};

// --- Discriminated union: state + kind-specific actions ---

type BlockEditorStateBase = {
  readonly block: EditableBlock;
  readonly regions: readonly EditableRegion[];
};

export type CodeBlockEditorState = BlockEditorStateBase & {
  readonly block: EditableCodeBlock;
} & CodeBlockActions;

export type DataBlockEditorState = BlockEditorStateBase & {
  readonly block: EditableDataBlock;
} & DataBlockActions;

export type DiagramBlockEditorState = BlockEditorStateBase & {
  readonly block: EditableDiagramBlock;
} & DiagramBlockActions;

export type MathBlockEditorState = BlockEditorStateBase & {
  readonly block: EditableMathBlock;
} & MathBlockActions;

export type ChartBlockEditorState = BlockEditorStateBase & {
  readonly block: EditableChartBlock;
} & ChartBlockActions;

export type PreviewBlockEditorState = BlockEditorStateBase & {
  readonly block: EditablePreviewBlock;
} & PreviewBlockActions;

// Discriminated at the type level by block.kind.
export type BlockEditorStore =
  | CodeBlockEditorState
  | DataBlockEditorState
  | DiagramBlockEditorState
  | MathBlockEditorState
  | ChartBlockEditorState
  | PreviewBlockEditorState;

// --- Region helpers (shared across all block kinds) ---

function addRegionToBlock(block: EditableBlock, name: string, target: string): boolean {
  if (block.regions.some((r) => r.name === name)) return false;
  block.regions.push({ name, target });
  return true;
}

function removeRegionFromBlock(block: EditableBlock, name: string): boolean {
  const idx = block.regions.findIndex((r) => r.name === name);
  if (idx === -1) return false;
  block.regions.splice(idx, 1);
  return true;
}

function refreshState(block: EditableBlock): { block: EditableBlock; regions: readonly EditableRegion[] } {
  return { block: { ...block } as EditableBlock, regions: [...block.regions] };
}

// --- Factory per kind ---

function createCodeBlockStore(
  block: EditableCodeBlock,
): UseBoundStore<StoreApi<CodeBlockEditorState>> {
  return create<CodeBlockEditorState>((set) => ({
    block,
    regions: block.regions,

    updateContent: (content) => {
      block.content = content;
      set(refreshState(block) as { block: EditableCodeBlock; regions: readonly EditableRegion[] });
    },

    updateLang: (lang) => {
      block.lang = lang;
      set(refreshState(block) as { block: EditableCodeBlock; regions: readonly EditableRegion[] });
    },

    updateFileName: (fileName) => {
      block.fileName = fileName;
      set(refreshState(block) as { block: EditableCodeBlock; regions: readonly EditableRegion[] });
    },

    addRegion: (name, target) => {
      if (!addRegionToBlock(block, name, target)) return;
      set(refreshState(block) as { block: EditableCodeBlock; regions: readonly EditableRegion[] });
    },

    removeRegion: (name) => {
      if (!removeRegionFromBlock(block, name)) return;
      set(refreshState(block) as { block: EditableCodeBlock; regions: readonly EditableRegion[] });
    },

    addAnnotation: (line, text) => {
      if (block.annotations.some((a) => a.line === line)) return;
      block.annotations.push({ line, text });
      set(refreshState(block) as { block: EditableCodeBlock; regions: readonly EditableRegion[] });
    },

    removeAnnotation: (line) => {
      const idx = block.annotations.findIndex((a) => a.line === line);
      if (idx === -1) return;
      block.annotations.splice(idx, 1);
      set(refreshState(block) as { block: EditableCodeBlock; regions: readonly EditableRegion[] });
    },
  }));
}

function createDataBlockStore(
  block: EditableDataBlock,
): UseBoundStore<StoreApi<DataBlockEditorState>> {
  return create<DataBlockEditorState>((set) => ({
    block,
    regions: block.regions,

    updateData: (data) => {
      block.data = data;
      set(refreshState(block) as { block: EditableDataBlock; regions: readonly EditableRegion[] });
    },

    addRegion: (name, target) => {
      if (!addRegionToBlock(block, name, target)) return;
      set(refreshState(block) as { block: EditableDataBlock; regions: readonly EditableRegion[] });
    },

    removeRegion: (name) => {
      if (!removeRegionFromBlock(block, name)) return;
      set(refreshState(block) as { block: EditableDataBlock; regions: readonly EditableRegion[] });
    },
  }));
}

function createDiagramBlockStore(
  block: EditableDiagramBlock,
): UseBoundStore<StoreApi<DiagramBlockEditorState>> {
  return create<DiagramBlockEditorState>((set) => ({
    block,
    regions: block.regions,

    addNode: (node) => {
      if (block.nodes.some((n) => n.id === node.id)) return;
      block.nodes.push(node);
      set(refreshState(block) as { block: EditableDiagramBlock; regions: readonly EditableRegion[] });
    },

    removeNode: (id) => {
      const idx = block.nodes.findIndex((n) => n.id === id);
      if (idx === -1) return;
      block.nodes.splice(idx, 1);
      // Cascade: remove edges referencing this node.
      block.edges = block.edges.filter((e) => e.fromId !== id && e.toId !== id);
      // Cascade: remove from groups.
      for (const g of block.groups) {
        const memberIdx = g.memberIds.indexOf(id);
        if (memberIdx !== -1) g.memberIds.splice(memberIdx, 1);
      }
      set(refreshState(block) as { block: EditableDiagramBlock; regions: readonly EditableRegion[] });
    },

    updateNode: (id, patch) => {
      const node = block.nodes.find((n) => n.id === id);
      if (!node) return;
      if (patch.label !== undefined) node.label = patch.label;
      if (patch.nodeType !== undefined) node.nodeType = patch.nodeType;
      if (patch.icon !== undefined) node.icon = patch.icon;
      set(refreshState(block) as { block: EditableDiagramBlock; regions: readonly EditableRegion[] });
    },

    addEdge: (fromId, toId, label) => {
      if (block.edges.some((e) => e.fromId === fromId && e.toId === toId)) return;
      block.edges.push({ fromId, toId, label });
      set(refreshState(block) as { block: EditableDiagramBlock; regions: readonly EditableRegion[] });
    },

    removeEdge: (fromId, toId) => {
      const idx = block.edges.findIndex((e) => e.fromId === fromId && e.toId === toId);
      if (idx === -1) return;
      block.edges.splice(idx, 1);
      set(refreshState(block) as { block: EditableDiagramBlock; regions: readonly EditableRegion[] });
    },

    addGroup: (name, memberIds) => {
      if (block.groups.some((g) => g.name === name)) return;
      block.groups.push({ name, memberIds: [...memberIds] });
      set(refreshState(block) as { block: EditableDiagramBlock; regions: readonly EditableRegion[] });
    },

    removeGroup: (name) => {
      const idx = block.groups.findIndex((g) => g.name === name);
      if (idx === -1) return;
      block.groups.splice(idx, 1);
      set(refreshState(block) as { block: EditableDiagramBlock; regions: readonly EditableRegion[] });
    },

    addRegion: (name, target) => {
      if (!addRegionToBlock(block, name, target)) return;
      set(refreshState(block) as { block: EditableDiagramBlock; regions: readonly EditableRegion[] });
    },

    removeRegion: (name) => {
      if (!removeRegionFromBlock(block, name)) return;
      set(refreshState(block) as { block: EditableDiagramBlock; regions: readonly EditableRegion[] });
    },
  }));
}

function createMathBlockStore(
  block: EditableMathBlock,
): UseBoundStore<StoreApi<MathBlockEditorState>> {
  return create<MathBlockEditorState>((set) => ({
    block,
    regions: block.regions,

    addExpression: (id, latex) => {
      if (block.expressions.some((e) => e.id === id)) return;
      block.expressions.push({ id, latex });
      set(refreshState(block) as { block: EditableMathBlock; regions: readonly EditableRegion[] });
    },

    updateExpression: (id, latex) => {
      const expr = block.expressions.find((e) => e.id === id);
      if (!expr) return;
      expr.latex = latex;
      set(refreshState(block) as { block: EditableMathBlock; regions: readonly EditableRegion[] });
    },

    removeExpression: (id) => {
      const idx = block.expressions.findIndex((e) => e.id === id);
      if (idx === -1) return;
      block.expressions.splice(idx, 1);
      set(refreshState(block) as { block: EditableMathBlock; regions: readonly EditableRegion[] });
    },

    addRegion: (name, target) => {
      if (!addRegionToBlock(block, name, target)) return;
      set(refreshState(block) as { block: EditableMathBlock; regions: readonly EditableRegion[] });
    },

    removeRegion: (name) => {
      if (!removeRegionFromBlock(block, name)) return;
      set(refreshState(block) as { block: EditableMathBlock; regions: readonly EditableRegion[] });
    },
  }));
}

function createChartBlockStore(
  block: EditableChartBlock,
): UseBoundStore<StoreApi<ChartBlockEditorState>> {
  return create<ChartBlockEditorState>((set) => ({
    block,
    regions: block.regions,

    updateChartKind: (chartKind) => {
      block.chartKind = chartKind;
      set(refreshState(block) as { block: EditableChartBlock; regions: readonly EditableRegion[] });
    },

    addSeries: (name) => {
      if (block.series.some((s) => s.name === name)) return;
      block.series.push({ name, data: [] });
      set(refreshState(block) as { block: EditableChartBlock; regions: readonly EditableRegion[] });
    },

    removeSeries: (name) => {
      const idx = block.series.findIndex((s) => s.name === name);
      if (idx === -1) return;
      block.series.splice(idx, 1);
      set(refreshState(block) as { block: EditableChartBlock; regions: readonly EditableRegion[] });
    },

    addDataPoint: (seriesName, label, value) => {
      const series = block.series.find((s) => s.name === seriesName);
      if (!series) return;
      series.data.push({ label, value });
      set(refreshState(block) as { block: EditableChartBlock; regions: readonly EditableRegion[] });
    },

    removeDataPoint: (seriesName, label) => {
      const series = block.series.find((s) => s.name === seriesName);
      if (!series) return;
      const idx = series.data.findIndex((d) => d.label === label);
      if (idx === -1) return;
      series.data.splice(idx, 1);
      set(refreshState(block) as { block: EditableChartBlock; regions: readonly EditableRegion[] });
    },

    addAnnotation: (label, text) => {
      if (block.annotations.some((a) => a.label === label)) return;
      block.annotations.push({ label, text });
      set(refreshState(block) as { block: EditableChartBlock; regions: readonly EditableRegion[] });
    },

    removeAnnotation: (label) => {
      const idx = block.annotations.findIndex((a) => a.label === label);
      if (idx === -1) return;
      block.annotations.splice(idx, 1);
      set(refreshState(block) as { block: EditableChartBlock; regions: readonly EditableRegion[] });
    },

    addShadedRegion: (from, to, color) => {
      if (block.shadedRegions.some((r) => r.from === from && r.to === to)) return;
      block.shadedRegions.push({ from, to, color });
      set(refreshState(block) as { block: EditableChartBlock; regions: readonly EditableRegion[] });
    },

    removeShadedRegion: (from, to) => {
      const idx = block.shadedRegions.findIndex((r) => r.from === from && r.to === to);
      if (idx === -1) return;
      block.shadedRegions.splice(idx, 1);
      set(refreshState(block) as { block: EditableChartBlock; regions: readonly EditableRegion[] });
    },

    addRegion: (name, target) => {
      if (!addRegionToBlock(block, name, target)) return;
      set(refreshState(block) as { block: EditableChartBlock; regions: readonly EditableRegion[] });
    },

    removeRegion: (name) => {
      if (!removeRegionFromBlock(block, name)) return;
      set(refreshState(block) as { block: EditableChartBlock; regions: readonly EditableRegion[] });
    },
  }));
}

function createPreviewBlockStore(
  block: EditablePreviewBlock,
): UseBoundStore<StoreApi<PreviewBlockEditorState>> {
  return create<PreviewBlockEditorState>((set) => ({
    block,
    regions: block.regions,

    updateSource: (source) => {
      block.source = source;
      set(refreshState(block) as { block: EditablePreviewBlock; regions: readonly EditableRegion[] });
    },

    updateTemplate: (template) => {
      block.template = template;
      set(refreshState(block) as { block: EditablePreviewBlock; regions: readonly EditableRegion[] });
    },

    addRegion: (name, target) => {
      if (!addRegionToBlock(block, name, target)) return;
      set(refreshState(block) as { block: EditablePreviewBlock; regions: readonly EditableRegion[] });
    },

    removeRegion: (name) => {
      if (!removeRegionFromBlock(block, name)) return;
      set(refreshState(block) as { block: EditablePreviewBlock; regions: readonly EditableRegion[] });
    },
  }));
}

// --- Unified factory: dispatches by block.kind ---

export function createBlockEditorStore(block: EditableBlock): UseBoundStore<StoreApi<BlockEditorStore>> {
  switch (block.kind) {
    case "code":
      return createCodeBlockStore(block) as UseBoundStore<StoreApi<BlockEditorStore>>;
    case "data":
      return createDataBlockStore(block) as UseBoundStore<StoreApi<BlockEditorStore>>;
    case "diagram":
      return createDiagramBlockStore(block) as UseBoundStore<StoreApi<BlockEditorStore>>;
    case "math":
      return createMathBlockStore(block) as UseBoundStore<StoreApi<BlockEditorStore>>;
    case "chart":
      return createChartBlockStore(block) as UseBoundStore<StoreApi<BlockEditorStore>>;
    case "preview":
      return createPreviewBlockStore(block) as UseBoundStore<StoreApi<BlockEditorStore>>;
  }
}

// --- Type-safe selectors: narrow BlockEditorStore to specific kind ---

export function isCodeEditor(s: BlockEditorStore): s is CodeBlockEditorState {
  return s.block.kind === "code";
}

export function isDataEditor(s: BlockEditorStore): s is DataBlockEditorState {
  return s.block.kind === "data";
}

export function isDiagramEditor(s: BlockEditorStore): s is DiagramBlockEditorState {
  return s.block.kind === "diagram";
}

export function isMathEditor(s: BlockEditorStore): s is MathBlockEditorState {
  return s.block.kind === "math";
}

export function isChartEditor(s: BlockEditorStore): s is ChartBlockEditorState {
  return s.block.kind === "chart";
}

export function isPreviewEditor(s: BlockEditorStore): s is PreviewBlockEditorState {
  return s.block.kind === "preview";
}

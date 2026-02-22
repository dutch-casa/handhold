// Scene compiler — thin adapter from editable step back to readonly IR for scene building.
// Feeds mutable editor state into the existing buildSceneSequence() pure function.

import type {
  VisualizationState,
  NarrationBlock,
  SceneState,
  CodeState,
  DataState,
  DiagramState,
  MathState,
  ChartState,
  PreviewState,
} from "@/types/lesson";
import type { EditableStep, EditableBlock } from "@/editor/model/types";
import { buildSceneSequence } from "@/parser/build-scenes";

// Convert a mutable editable block back to its readonly IR counterpart.
// Fields like `focus` on CodeState are scene-derived, not author-edited — fill with defaults.
function freezeBlock(block: EditableBlock): VisualizationState {
  switch (block.kind) {
    case "code": {
      const frozen: CodeState = {
        kind: "code",
        name: block.name,
        lang: block.lang,
        fileName: block.fileName,
        content: block.content,
        focus: [],
        annotations: block.annotations.map((a) => ({ line: a.line, text: a.text })),
        regions: block.regions.map((r) => ({ name: r.name, target: r.target })),
      };
      return frozen;
    }

    case "data": {
      const frozen: DataState = {
        kind: "data",
        name: block.name,
        data: structuredClone(block.data) as DataState["data"],
        regions: block.regions.map((r) => ({ name: r.name, target: r.target })),
      };
      return frozen;
    }

    case "diagram": {
      const frozen: DiagramState = {
        kind: "diagram",
        name: block.name,
        nodes: block.nodes.map((n) => {
          const base = { id: n.id, label: n.label, nodeType: n.nodeType } as const;
          return n.icon !== undefined ? { ...base, icon: n.icon } : base;
        }),
        edges: block.edges.map((e) => ({
          fromId: e.fromId,
          toId: e.toId,
          label: e.label,
        })),
        groups: block.groups.map((g) => ({
          name: g.name,
          memberIds: [...g.memberIds],
        })),
        regions: block.regions.map((r) => ({ name: r.name, target: r.target })),
      };
      return frozen;
    }

    case "math": {
      const frozen: MathState = {
        kind: "math",
        name: block.name,
        expressions: block.expressions.map((e) => ({
          id: e.id,
          latex: e.latex,
        })),
        regions: block.regions.map((r) => ({ name: r.name, target: r.target })),
      };
      return frozen;
    }

    case "chart": {
      const frozen: ChartState = {
        kind: "chart",
        name: block.name,
        chartKind: block.chartKind,
        series: block.series.map((s) => ({
          name: s.name,
          data: s.data.map((d) => ({ label: d.label, value: d.value })),
        })),
        annotations: block.annotations.map((a) => ({
          label: a.label,
          text: a.text,
        })),
        shadedRegions: block.shadedRegions.map((r) => ({
          from: r.from,
          to: r.to,
          color: r.color,
        })),
        regions: block.regions.map((r) => ({ name: r.name, target: r.target })),
      };
      return frozen;
    }

    case "preview": {
      const frozen: PreviewState = {
        kind: "preview",
        name: block.name,
        source: block.source,
        template: block.template,
        regions: block.regions.map((r) => ({ name: r.name, target: r.target })),
      };
      return frozen;
    }
  }
}

// Convert mutable narration back to readonly IR.
function freezeNarration(narration: EditableStep["narration"]): readonly NarrationBlock[] {
  return narration.map((n) => ({
    text: n.text,
    triggers: n.triggers.map((t) => ({
      wordIndex: t.wordIndex,
      text: t.text,
      action: structuredClone(t.action) as typeof t.action,
    })),
  }));
}

// Compile an editable step's current state into a readonly scene sequence.
// Bridge: editor mutable state -> readonly IR -> buildSceneSequence.
export function compileScenes(step: EditableStep): readonly SceneState[] {
  const blocks: ReadonlyMap<string, VisualizationState> = new Map(
    [...step.blocks.entries()].map(([name, block]) => [name, freezeBlock(block)] as const),
  );
  const narration = freezeNarration(step.narration);
  return buildSceneSequence(blocks, narration);
}

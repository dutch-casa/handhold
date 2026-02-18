import { useMemo } from "react";
import { motion } from "motion/react";
import type { DataState, SceneAnnotation } from "@/types/lesson";
import type { Layout } from "./layout-types";
import { layoutArray } from "./layouts/array-layout";
import { layoutLinkedList } from "./layouts/linked-list-layout";
import { layoutBinaryTree } from "./layouts/binary-tree-layout";
import { layoutGraph } from "./layouts/graph-layout";
import { layoutTree } from "./layouts/graph-tree-layout";
import { layoutGrid } from "./layouts/graph-grid-layout";
import { layoutBipartite } from "./layouts/graph-bipartite-layout";
import { layoutForce } from "./layouts/graph-force-layout";
import { DataNode } from "./DataNode";
import { DataEdge } from "./DataEdge";
import { DataPointer } from "./DataPointer";
import { colors, fonts, fade } from "@/app/theme";

type DataProps = {
  readonly state: DataState;
  readonly prevState: DataState | undefined;
  readonly focus: string;
  readonly flow: string;
  readonly annotations: readonly SceneAnnotation[];
};

export function Data({ state, focus, flow, annotations }: DataProps) {
  const layout = useMemo(() => computeLayout(state), [state]);
  if (layout.width === 0 || layout.height === 0) return null;

  const focusedIds = useMemo(
    () => resolveDataRegion(focus, state),
    [focus, state],
  );

  // Resolve flow region to a set of edge IDs that should animate
  const flowingEdgeIds = useMemo(
    () => resolveFlowEdges(flow, state),
    [flow, state],
  );

  // Only show the last annotation per node (single annotation constraint)
  const dedupedAnnotations = useMemo(() => {
    const byTarget = new Map<string, SceneAnnotation>();
    for (const anno of annotations) {
      byTarget.set(anno.target, anno);
    }
    return [...byTarget.values()];
  }, [annotations]);

  const VIEW_PAD_X = 16;
  const VIEW_PAD_TOP = 28;
  const VIEW_PAD_BOTTOM = 16;

  return (
    <svg
      viewBox={`${-VIEW_PAD_X} ${-VIEW_PAD_TOP} ${layout.width + VIEW_PAD_X * 2} ${layout.height + VIEW_PAD_TOP + VIEW_PAD_BOTTOM}`}
      width={layout.width}
      height={layout.height}
      style={{ maxWidth: "100%", height: "auto", display: "block" }}
    >
      {layout.edges.map((edge) => (
        <DataEdge
          key={edge.id}
          edge={edge}
          flowing={flowingEdgeIds.has(edge.id)}
        />
      ))}
      {layout.nodes.map((node) => (
        <DataNode
          key={node.id}
          node={node}
          dimmed={focusedIds.length > 0 && !focusedIds.includes(node.id)}
        />
      ))}
      {layout.pointers.map((pointer) => (
        <DataPointer key={pointer.name} pointer={pointer} />
      ))}
      {dedupedAnnotations.map((anno) => {
        const nodeId = resolveDataRegion(anno.target, state)[0];
        if (!nodeId) return null;
        const node = layout.nodes.find((n) => n.id === nodeId);
        if (!node) return null;
        return (
          <motion.g
            key={`anno-${anno.target}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fade}
          >
            <text
              x={node.x + node.width / 2}
              y={node.y - 10}
              textAnchor="middle"
              fill={colors.accent}
              fontSize="12"
              fontFamily={fonts.ui}
              stroke={colors.bg}
              strokeWidth={4}
              paintOrder="stroke"
            >
              {anno.text}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}

function computeLayout(state: DataState): Layout {
  switch (state.data.type) {
    case "array":
      return layoutArray(state.data);
    case "linked-list":
      return layoutLinkedList(state.data);
    case "binary-tree":
      return layoutBinaryTree(state.data);
    case "graph":
      return layoutGraphByKind(state.data);
    case "stack":
    case "hash-map":
      return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }
}

function layoutGraphByKind(data: import("@/types/lesson").GraphData): Layout {
  switch (data.layout) {
    case "ring":
      return layoutGraph(data);
    case "tree":
      return layoutTree(data);
    case "grid":
      return layoutGrid(data);
    case "bipartite":
      return layoutBipartite(data);
    case "force":
      return layoutForce(data);
  }
}

function resolveDataRegion(regionName: string, state: DataState): string[] {
  if (regionName.length === 0) return [];
  const ids: string[] = [];
  for (const r of state.regions) {
    if (r.name !== regionName) continue;
    for (const segment of r.target.split(",")) {
      ids.push(segment.trim());
    }
  }
  return ids;
}

/** Walk pairwise through the flow region's node list to build the set of flowing edge IDs. */
function resolveFlowEdges(flowRegion: string, state: DataState): Set<string> {
  const edgeIds = new Set<string>();
  if (flowRegion.length === 0) return edgeIds;

  const nodeIds = resolveDataRegion(flowRegion, state);
  if (nodeIds.length < 2) return edgeIds;

  for (let i = 0; i < nodeIds.length - 1; i++) {
    const from = nodeIds[i];
    const to = nodeIds[i + 1];
    if (from && to) {
      // Check both directions — edge might be stored either way
      edgeIds.add(`${from}->${to}`);
      edgeIds.add(`${to}->${from}`);
    }
  }
  return edgeIds;
}

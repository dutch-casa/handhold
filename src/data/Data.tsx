import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { DataState, SceneAnnotation } from "@/types/lesson";
import type { Layout } from "./layout-types";
import { layoutArray } from "./layouts/array-layout";
import { arrayNodeIds } from "./array-ids";
import { layoutLinkedList } from "./layouts/linked-list-layout";
import { layoutNaryTree } from "./layouts/tree-layout";
import { layoutGraph } from "./layouts/graph-layout";
import { layoutTree as layoutGraphTree } from "./layouts/graph-tree-layout";
import { layoutGrid } from "./layouts/graph-grid-layout";
import { layoutBipartite } from "./layouts/graph-bipartite-layout";
import { layoutForce } from "./layouts/graph-force-layout";
import { layoutStack } from "./layouts/stack-layout";
import { layoutQueue } from "./layouts/queue-layout";
import { layoutRingBuffer } from "./layouts/ring-buffer-layout";
import { layoutDoublyLinkedList } from "./layouts/doubly-linked-list-layout";
import { layoutSkipList } from "./layouts/skip-list-layout";
import { layoutHashMap } from "./layouts/hash-map-layout";
import { layoutBTree } from "./layouts/b-tree-layout";
import { layoutTrie } from "./layouts/trie-layout";
import { layoutBitArray } from "./layouts/bit-array-layout";
import { layoutMatrix } from "./layouts/matrix-layout";
import { layoutUnionFind } from "./layouts/union-find-layout";
import { layoutLsmTree } from "./layouts/lsm-tree-layout";
import { layoutFibonacciHeap } from "./layouts/fibonacci-heap-layout";
import { DataNode } from "./DataNode";
import { DataEdge } from "./DataEdge";
import { DataPointer } from "./DataPointer";
import { colors, fonts, fade } from "@/app/theme";

type DataProps = {
  readonly state: DataState;
  readonly prevState: DataState | undefined;
  readonly focus: string;
  readonly flow: string;
  readonly pulse: string;
  readonly trace: string;
  readonly draw: string;
  readonly pan: string;
  readonly annotations: readonly SceneAnnotation[];
};

export function Data({ state, prevState, focus, flow, pulse, trace, draw, pan, annotations }: DataProps) {
  const layout = useMemo(() => computeLayout(state), [state]);
  const prevLayout = useMemo(
    () => (prevState ? computeLayout(prevState) : undefined),
    [prevState],
  );

  const prevNodeMap = new Map(
    (prevLayout?.nodes ?? []).map((n) => [n.id, n]),
  );

  // Track edges from previous layout for exit animation
  const currentEdgeIds = useMemo(
    () => new Set(layout.edges.map((e) => e.id)),
    [layout.edges],
  );
  const exitingEdges = useMemo(
    () => (prevLayout?.edges ?? []).filter((e) => !currentEdgeIds.has(e.id)),
    [prevLayout?.edges, currentEdgeIds],
  );

  // Track nodes from previous layout for exit animation
  const currentNodeIds = useMemo(
    () => new Set(layout.nodes.map((n) => n.id)),
    [layout.nodes],
  );
  const exitingNodes = useMemo(
    () => (prevLayout?.nodes ?? []).filter((n) => !currentNodeIds.has(n.id)),
    [prevLayout?.nodes, currentNodeIds],
  );

  // Previous edge positions for spring interpolation
  const prevEdgeMap = useMemo(
    () => new Map((prevLayout?.edges ?? []).map((e) => [e.id, e])),
    [prevLayout?.edges],
  );

  const focusedIds = useMemo(
    () => resolveDataRegion(focus, state),
    [focus, state],
  );
  const pulsedIds = useMemo(
    () => resolveDataRegion(pulse, state),
    [pulse, state],
  );

  // Resolve flow region to a set of edge IDs that should animate
  const flowingEdgeIds = useMemo(
    () => resolveFlowEdges(flow, state),
    [flow, state],
  );
  const tracedEdgeIds = useMemo(
    () => resolveFlowEdges(trace, state),
    [trace, state],
  );
  const drawingEdgeIds = useMemo(
    () => resolveFlowEdges(draw, state),
    [draw, state],
  );
  const panNodeIds = useMemo(
    () => resolveDataRegion(pan, state),
    [pan, state],
  );

  // Dedup annotations by resolved node ID — multiple annotations targeting
  // the same node via different region names collapse to the latest one
  const dedupedAnnotations = useMemo(() => {
    const byNodeId = new Map<string, SceneAnnotation>();
    for (const anno of annotations) {
      const nodeId = resolveDataRegion(anno.target, state)[0];
      if (nodeId) {
        byNodeId.set(nodeId, anno);
      }
    }
    return [...byNodeId.values()];
  }, [annotations, state]);

  const VIEW_PAD_X = 16;
  const VIEW_PAD_TOP = 28;
  const VIEW_PAD_BOTTOM = 16;

  if (layout.width === 0 || layout.height === 0) return null;

  return (
    <svg
      viewBox={`${-VIEW_PAD_X} ${-VIEW_PAD_TOP} ${layout.width + VIEW_PAD_X * 2} ${layout.height + VIEW_PAD_TOP + VIEW_PAD_BOTTOM}`}
      width={layout.width}
      height={layout.height}
      style={{ maxWidth: "100%", height: "auto", display: "block" }}
    >
      <AnimatePresence>
        {/* Exiting edges: fade out */}
        {exitingEdges.map((edge) => (
          <DataEdge key={`exit-${edge.id}`} edge={edge} exiting />
        ))}
      </AnimatePresence>
      {layout.edges.map((edge) => (
        <DataEdge
          key={edge.id}
          edge={edge}
          flowing={flowingEdgeIds.has(edge.id)}
          tracing={tracedEdgeIds.has(edge.id)}
          drawing={drawingEdgeIds.has(edge.id)}
          prevEdge={prevEdgeMap.get(edge.id)}
        />
      ))}
      <AnimatePresence>
        {/* Exiting nodes: fade out at their last position */}
        {exitingNodes.map((node) => (
          <DataNode key={`exit-${node.id}`} node={node} exiting />
        ))}
      </AnimatePresence>
      {layout.nodes.map((node) => {
        const prevNode = prevNodeMap.get(node.id);
        return (
          <DataNode
            key={node.id}
            node={node}
            dimmed={focusedIds.length > 0 && !focusedIds.includes(node.id)}
            pulsing={pulsedIds.includes(node.id)}
            panTarget={panNodeIds.includes(node.id)}
            initialX={prevNode?.x}
            initialY={prevNode?.y}
            prevValue={prevNode?.value}
            prevMarker={prevNode?.marker}
          />
        );
      })}
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
    case "tree":
      return layoutNaryTree(state.data);
    case "graph":
      return layoutGraphByKind(state.data);
    case "stack":
      return layoutStack(state.data);
    case "queue":
    case "deque":
      return layoutQueue(state.data);
    case "ring-buffer":
      return layoutRingBuffer(state.data);
    case "doubly-linked-list":
      return layoutDoublyLinkedList(state.data);
    case "skip-list":
      return layoutSkipList(state.data);
    case "hash-map":
      return layoutHashMap(state.data);
    case "b-tree":
      return layoutBTree(state.data);
    case "trie":
      return layoutTrie(state.data);
    case "bit-array":
      return layoutBitArray(state.data);
    case "matrix":
      return layoutMatrix(state.data);
    case "union-find":
      return layoutUnionFind(state.data);
    case "lsm-tree":
      return layoutLsmTree(state.data);
    case "fibonacci-heap":
      return layoutFibonacciHeap(state.data);
  }
}

function layoutGraphByKind(data: import("@/types/lesson").GraphData): Layout {
  switch (data.layout) {
    case "ring":
      return layoutGraph(data);
    case "tree":
      return layoutGraphTree(data);
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
  const arrayIds = state.data.type === "array" ? arrayNodeIds(state.data.values) : null;
  for (const r of state.regions) {
    if (r.name !== regionName) continue;
    for (const segment of r.target.split(",")) {
      const raw = segment.trim();
      if (arrayIds) {
        const idx = Number(raw);
        if (Number.isFinite(idx) && idx >= 0 && idx < arrayIds.length) {
          const mapped = arrayIds[idx];
          if (mapped) {
            ids.push(mapped);
            continue;
          }
        }
      }
      ids.push(raw);
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

import type { GraphData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";

// Bipartite layout: two-coloring via BFS, left/right columns.
// Falls back to alternating assignment if the graph isn't bipartite.

const NODE_W = 44;
const NODE_H = 44;
const COL_GAP = 160;
const V_GAP = 24;
const PAD = 32;
const POINTER_OFFSET_Y = 36;

export function layoutBipartite(data: GraphData): Layout {
  if (data.nodes.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  // Two-color via BFS
  const color = new Map<string, 0 | 1>();
  const adj = new Map<string, string[]>();
  for (const node of data.nodes) adj.set(node.id, []);
  for (const edge of data.edges) {
    adj.get(edge.fromId)?.push(edge.toId);
    if (!data.directed) adj.get(edge.toId)?.push(edge.fromId);
  }

  for (const node of data.nodes) {
    if (color.has(node.id)) continue;
    color.set(node.id, 0);
    const queue = [node.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentColor = color.get(current)!;
      const nextColor: 0 | 1 = currentColor === 0 ? 1 : 0;
      for (const neighbor of adj.get(current) ?? []) {
        if (color.has(neighbor)) continue;
        color.set(neighbor, nextColor);
        queue.push(neighbor);
      }
    }
  }

  const left = data.nodes.filter((n) => color.get(n.id) === 0);
  const right = data.nodes.filter((n) => color.get(n.id) === 1);

  const positioned = new Map<string, PositionedNode>();
  const nodes: PositionedNode[] = [];

  const placeColumn = (
    column: readonly { readonly id: string; readonly value: string }[],
    x: number,
  ) => {
    for (let i = 0; i < column.length; i++) {
      const def = column[i]!;
      const node: PositionedNode = {
        id: def.id,
        value: def.value,
        x,
        y: PAD + i * (NODE_H + V_GAP),
        width: NODE_W,
        height: NODE_H,
        shape: "circle",
      };
      nodes.push(node);
      positioned.set(def.id, node);
    }
  };

  placeColumn(left, PAD);
  placeColumn(right, PAD + NODE_W + COL_GAP);

  const edges: PositionedEdge[] = data.edges.map((e) => {
    const from = positioned.get(e.fromId);
    const to = positioned.get(e.toId);
    return {
      id: `${e.fromId}->${e.toId}`,
      x1: from ? from.x + NODE_W : 0,
      y1: from ? from.y + NODE_H / 2 : 0,
      x2: to ? to.x : 0,
      y2: to ? to.y + NODE_H / 2 : 0,
      ...(e.weight ? { label: e.weight } : {}),
    };
  });

  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const target = positioned.get(p.targetId);
    return {
      name: p.name,
      x: target ? target.x + NODE_W / 2 : PAD,
      y: (target ? target.y + NODE_H : PAD + NODE_H) + POINTER_OFFSET_Y,
    };
  });

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const p of pointers) maxY = Math.max(maxY, p.y + 20);

  return { nodes, edges, pointers, width: maxX + PAD, height: maxY + PAD };
}

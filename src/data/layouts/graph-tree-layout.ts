import type { GraphData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";

// Tree layout: BFS from first node, level-order positioning.
// Nodes at same depth are evenly spaced horizontally.

const NODE_W = 44;
const NODE_H = 44;
const H_GAP = 24;
const V_GAP = 60;
const PAD = 32;
const POINTER_OFFSET_Y = 36;

export function layoutTree(data: GraphData): Layout {
  if (data.nodes.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  // Build adjacency list (directed: from→to, undirected: both ways)
  const adj = new Map<string, string[]>();
  for (const node of data.nodes) adj.set(node.id, []);
  for (const edge of data.edges) {
    adj.get(edge.fromId)?.push(edge.toId);
    if (!data.directed) adj.get(edge.toId)?.push(edge.fromId);
  }

  // BFS from first node to assign levels
  const root = data.nodes[0]!;
  const levels = new Map<string, number>();
  const queue: string[] = [root.id];
  levels.set(root.id, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const depth = levels.get(current)!;
    for (const neighbor of adj.get(current) ?? []) {
      if (levels.has(neighbor)) continue;
      levels.set(neighbor, depth + 1);
      queue.push(neighbor);
    }
  }

  // Group nodes by level
  const byLevel = new Map<number, string[]>();
  let maxLevel = 0;
  for (const node of data.nodes) {
    const level = levels.get(node.id) ?? 0;
    maxLevel = Math.max(maxLevel, level);
    const group = byLevel.get(level);
    if (group) group.push(node.id);
    else byLevel.set(level, [node.id]);
  }

  // Position nodes: each level is a row
  const nodeMap = new Map<string, DataNodeLookup>();
  for (const n of data.nodes) nodeMap.set(n.id, n);

  const positioned = new Map<string, PositionedNode>();
  const nodes: PositionedNode[] = [];

  for (let level = 0; level <= maxLevel; level++) {
    const ids = byLevel.get(level) ?? [];
    const y = PAD + level * (NODE_H + V_GAP);

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const def = nodeMap.get(id);
      const x = PAD + i * (NODE_W + H_GAP);
      const node: PositionedNode = {
        id,
        value: def?.value ?? id,
        x,
        y,
        width: NODE_W,
        height: NODE_H,
        shape: "circle",
      };
      nodes.push(node);
      positioned.set(id, node);
    }
  }

  // Center each level relative to the widest level
  const maxWidth = Math.max(
    ...Array.from(byLevel.values()).map(
      (ids) => ids.length * NODE_W + (ids.length - 1) * H_GAP,
    ),
  );
  for (let level = 0; level <= maxLevel; level++) {
    const ids = byLevel.get(level) ?? [];
    const rowWidth = ids.length * NODE_W + (ids.length - 1) * H_GAP;
    const offset = (maxWidth - rowWidth) / 2;
    for (const id of ids) {
      const node = positioned.get(id);
      if (node && offset > 0) {
        const shifted = { ...node, x: node.x + offset };
        positioned.set(id, shifted);
        const idx = nodes.findIndex((n) => n.id === id);
        if (idx >= 0) nodes[idx] = shifted;
      }
    }
  }

  const edges: PositionedEdge[] = data.edges.map((e) => {
    const from = positioned.get(e.fromId);
    const to = positioned.get(e.toId);
    return {
      id: `${e.fromId}->${e.toId}`,
      x1: from ? from.x + NODE_W / 2 : 0,
      y1: from ? from.y + NODE_H : 0,
      x2: to ? to.x + NODE_W / 2 : 0,
      y2: to ? to.y : 0,
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

type DataNodeLookup = { readonly id: string; readonly value: string };

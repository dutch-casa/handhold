import type { GraphData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";
import { measureCellWidth } from "./measure";

// Grid layout: nodes in a sqrt(n)-column grid, edges as straight lines.

const H_GAP = 32;
const V_GAP = 32;
const PAD = 32;
const POINTER_OFFSET_Y = 36;

export function layoutGrid(data: GraphData): Layout {
  if (data.nodes.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const nodeW = Math.max(44, ...data.nodes.map((n) => measureCellWidth(n.value, 44)));
  const NODE_H = nodeW; // square cells

  const cols = Math.ceil(Math.sqrt(data.nodes.length));
  const positioned = new Map<string, PositionedNode>();
  const nodes: PositionedNode[] = [];

  for (let i = 0; i < data.nodes.length; i++) {
    const def = data.nodes[i]!;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const node: PositionedNode = {
      id: def.id,
      value: def.value,
      x: PAD + col * (nodeW + H_GAP),
      y: PAD + row * (NODE_H + V_GAP),
      width: nodeW,
      height: NODE_H,
      shape: "rect",
    };
    nodes.push(node);
    positioned.set(def.id, node);
  }

  const edges: PositionedEdge[] = data.edges.map((e) => {
    const from = positioned.get(e.fromId);
    const to = positioned.get(e.toId);
    return {
      id: `${e.fromId}->${e.toId}`,
      x1: from ? from.x + nodeW / 2 : 0,
      y1: from ? from.y + NODE_H / 2 : 0,
      x2: to ? to.x + nodeW / 2 : 0,
      y2: to ? to.y + NODE_H / 2 : 0,
      ...(e.weight ? { label: e.weight } : {}),
    };
  });

  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const target = positioned.get(p.targetId);
    return {
      name: p.name,
      x: target ? target.x + nodeW / 2 : PAD,
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

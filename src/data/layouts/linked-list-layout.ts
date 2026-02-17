import type { LinkedListData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";

// Layout: horizontal chain of nodes with arrows between them.
// Floating groups sit on a row below the main chain.
// Null terminus rendered as a small box at the end.

const NODE_W = 72;
const NODE_H = 44;
const H_GAP = 48;
const V_GAP = 64;
const PAD = 24;
const NULL_W = 40;
const POINTER_OFFSET_Y = 36;

export function layoutLinkedList(data: LinkedListData): Layout {
  const nodePositions = new Map<string, PositionedNode>();
  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  // Identify which nodes are in the main chain vs floating
  const floatingIds = new Set(data.floatingGroups.flatMap((g) => g.map((n) => n.id)));
  const mainNodes = data.nodes.filter((n) => !floatingIds.has(n.id));

  // Layout main chain horizontally
  let x = PAD;
  for (const node of mainNodes) {
    const positioned: PositionedNode = {
      id: node.id,
      value: node.value,
      x,
      y: PAD,
      width: NODE_W,
      height: NODE_H,
    };
    nodes.push(positioned);
    nodePositions.set(node.id, positioned);
    x += NODE_W + H_GAP;
  }

  // Layout floating groups below main chain
  let floatX = PAD + NODE_W + H_GAP; // offset slightly from left
  const floatY = PAD + NODE_H + V_GAP;
  for (const group of data.floatingGroups) {
    for (const node of group) {
      const positioned: PositionedNode = {
        id: node.id,
        value: node.value,
        x: floatX,
        y: floatY,
        width: NODE_W,
        height: NODE_H,
      };
      nodes.push(positioned);
      nodePositions.set(node.id, positioned);
      floatX += NODE_W + H_GAP;
    }
  }

  // Edges
  for (const edge of data.edges) {
    const from = nodePositions.get(edge.fromId);
    const to = nodePositions.get(edge.toId);
    if (!from || !to) continue;

    edges.push({
      id: `${edge.fromId}->${edge.toId}`,
      x1: from.x + from.width,
      y1: from.y + from.height / 2,
      x2: to.x,
      y2: to.y + to.height / 2,
    });
  }

  // Null terminus edge
  if (data.hasNull && mainNodes.length > 0) {
    const last = nodePositions.get(mainNodes[mainNodes.length - 1]!.id);
    if (last) {
      const nullX = last.x + last.width + H_GAP;
      const nullNode: PositionedNode = {
        id: "__null__",
        value: "null",
        x: nullX,
        y: PAD + (NODE_H - 24) / 2,
        width: NULL_W,
        height: 24,
      };
      nodes.push(nullNode);
      nodePositions.set("__null__", nullNode);

      edges.push({
        id: `${last.id}->null`,
        x1: last.x + last.width,
        y1: last.y + last.height / 2,
        x2: nullX,
        y2: PAD + NODE_H / 2,
      });
    }
  }

  // Pointers
  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const target = nodePositions.get(p.targetId);
    return {
      name: p.name,
      x: target ? target.x + target.width / 2 : PAD,
      y: (target ? target.y + target.height : PAD + NODE_H) + POINTER_OFFSET_Y,
    };
  });

  // Compute bounds
  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const p of pointers) {
    maxY = Math.max(maxY, p.y + 20);
  }

  return {
    nodes,
    edges,
    pointers,
    width: maxX + PAD,
    height: maxY + PAD,
  };
}

import type { DoublyLinkedListData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";
import { measureCellWidth } from "./measure";

// Same horizontal chain as linked-list, but edges are bidirectional.

const NODE_H = 44;
const H_GAP = 48;
const PAD = 24;
const NULL_W = 40;
const POINTER_OFFSET_Y = 36;

export function layoutDoublyLinkedList(data: DoublyLinkedListData): Layout {
  const nodePositions = new Map<string, PositionedNode>();
  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  let x = PAD;
  for (const node of data.nodes) {
    const nodeW = measureCellWidth(node.value, 72);
    const positioned: PositionedNode = {
      id: node.id,
      value: node.value,
      x,
      y: PAD,
      width: nodeW,
      height: NODE_H,
    };
    nodes.push(positioned);
    nodePositions.set(node.id, positioned);
    x += nodeW + H_GAP;
  }

  // Bidirectional edges
  for (const edge of data.edges) {
    const from = nodePositions.get(edge.fromId);
    const to = nodePositions.get(edge.toId);
    if (!from || !to) continue;

    edges.push({
      id: `${edge.fromId}<->${edge.toId}`,
      x1: from.x + from.width,
      y1: from.y + from.height / 2,
      x2: to.x,
      y2: to.y + to.height / 2,
      bidirectional: true,
    });
  }

  // Null terminus
  if (data.hasNull && data.nodes.length > 0) {
    const last = nodePositions.get(data.nodes[data.nodes.length - 1]!.id);
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
      edges.push({
        id: `${last.id}->null`,
        x1: last.x + last.width,
        y1: last.y + last.height / 2,
        x2: nullX,
        y2: PAD + NODE_H / 2,
      });
    }
  }

  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const target = nodePositions.get(p.targetId);
    return {
      name: p.name,
      x: target ? target.x + target.width / 2 : PAD,
      y: (target ? target.y + target.height : PAD + NODE_H) + POINTER_OFFSET_Y,
    };
  });

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const p of pointers) {
    maxY = Math.max(maxY, p.y + 20);
  }

  return { nodes, edges, pointers, width: maxX + PAD, height: maxY + PAD };
}

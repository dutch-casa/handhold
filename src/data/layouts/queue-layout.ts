import type { QueueData, DequeData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";
import { arrayNodeIds } from "../array-ids";
import { measureCellWidth } from "./measure";

// Horizontal row with front/rear indicators.

const CELL_H = 44;
const GAP = 8;
const PAD = 24;
const POINTER_OFFSET_Y = 36;
const ARROW_LEN = 24;

export function layoutQueue(data: QueueData | DequeData): Layout {
  if (data.values.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const ids = arrayNodeIds(data.values);
  const widths = data.values.map((v) => measureCellWidth(String(v), 64));
  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  let x = PAD;
  for (let i = 0; i < data.values.length; i++) {
    const value = data.values[i] ?? "";
    const cellW = widths[i] ?? 64;
    nodes.push({
      id: ids[i] ?? String(i),
      value,
      x,
      y: PAD,
      width: cellW,
      height: CELL_H,
    });
    x += cellW + GAP;
  }

  // Front/rear pointers
  const pointers: PositionedPointer[] = [];
  const frontNode = nodes[data.front];
  const rearNode = nodes[data.rear];

  if (frontNode) {
    pointers.push({
      name: "front",
      x: frontNode.x + frontNode.width / 2,
      y: PAD + CELL_H + POINTER_OFFSET_Y,
    });
  }
  if (rearNode) {
    pointers.push({
      name: "rear",
      x: rearNode.x + rearNode.width / 2,
      y: PAD + CELL_H + POINTER_OFFSET_Y,
    });
  }

  // Deque gets bidirectional arrows at both ends
  if (data.type === "deque" && nodes.length > 0) {
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    edges.push({
      id: "deque-left",
      x1: first.x - ARROW_LEN,
      y1: first.y + CELL_H / 2,
      x2: first.x,
      y2: first.y + CELL_H / 2,
      bidirectional: true,
    });
    edges.push({
      id: "deque-right",
      x1: last.x + last.width,
      y1: last.y + CELL_H / 2,
      x2: last.x + last.width + ARROW_LEN,
      y2: last.y + CELL_H / 2,
      bidirectional: true,
    });
  }

  // Additional named pointers
  for (const p of data.pointers) {
    const idx = Number(p.targetId);
    const target = Number.isFinite(idx) ? nodes[idx] : undefined;
    if (target) {
      pointers.push({
        name: p.name,
        x: target.x + target.width / 2,
        y: PAD + CELL_H + POINTER_OFFSET_Y,
      });
    }
  }

  const last = nodes[nodes.length - 1];
  const totalW = (last ? last.x + last.width : 0) + PAD + (data.type === "deque" ? ARROW_LEN : 0);
  const totalH = CELL_H + POINTER_OFFSET_Y + PAD * 2 + 16;

  return { nodes, edges, pointers, width: totalW, height: totalH };
}

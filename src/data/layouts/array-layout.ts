import type { ArrayData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedPointer } from "../layout-types";

// Layout: horizontal row of equal-width cells.
// Pointers sit below their target cell.

const CELL_W = 56;
const CELL_H = 44;
const GAP = 4;
const POINTER_OFFSET_Y = 32;
const PAD = 16;

export function layoutArray(data: ArrayData): Layout {
  const nodes: PositionedNode[] = data.values.map((value, i) => ({
    id: String(i),
    value,
    x: PAD + i * (CELL_W + GAP),
    y: PAD,
    width: CELL_W,
    height: CELL_H,
  }));

  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const targetIdx = Number(p.targetId);
    const targetNode = nodes[targetIdx];
    const x = targetNode ? targetNode.x + targetNode.width / 2 : PAD;
    const y = PAD + CELL_H + POINTER_OFFSET_Y;
    return { name: p.name, x, y };
  });

  const totalW = data.values.length * (CELL_W + GAP) - GAP + PAD * 2;
  const totalH = CELL_H + POINTER_OFFSET_Y + PAD * 2 + 16;

  return { nodes, edges: [], pointers, width: totalW, height: totalH };
}

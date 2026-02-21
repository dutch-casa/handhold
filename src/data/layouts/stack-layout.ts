import type { StackData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedPointer } from "../layout-types";
import { arrayNodeIds } from "../array-ids";
import { measureCellWidth } from "./measure";

// Vertical column: bottom = index 0, top = last element.

const CELL_H = 44;
const PAD = 24;
const POINTER_OFFSET_X = -40;

export function layoutStack(data: StackData): Layout {
  if (data.values.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const ids = arrayNodeIds(data.values);
  const cellW = Math.max(...data.values.map((v) => measureCellWidth(String(v), 80)));
  const nodes: PositionedNode[] = [];

  // Stack grows upward: index 0 at the bottom, last at top
  for (let i = 0; i < data.values.length; i++) {
    const value = data.values[i] ?? "";
    const row = data.values.length - 1 - i;
    nodes.push({
      id: ids[i] ?? String(i),
      value,
      x: PAD,
      y: PAD + row * CELL_H,
      width: cellW,
      height: CELL_H,
    });
  }

  // Top pointer sits to the left of the top element
  const pointers: PositionedPointer[] = [];
  if (data.topIndex >= 0 && data.topIndex < data.values.length) {
    const topRow = data.values.length - 1 - data.topIndex;
    pointers.push({
      name: "top",
      x: PAD + POINTER_OFFSET_X,
      y: PAD + topRow * CELL_H + CELL_H / 2,
    });
  }

  const totalW = cellW + PAD * 2;
  const totalH = data.values.length * CELL_H + PAD * 2;

  return { nodes, edges: [], pointers, width: totalW, height: totalH };
}

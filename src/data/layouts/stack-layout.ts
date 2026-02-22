import type { StackData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedPointer } from "../layout-types";
import { arrayNodeIds } from "../array-ids";
import { measureCellWidth } from "./measure";

// Vertical column: bottom = index 0, top = last element.
// Pointer sits to the left, so nodes are offset right to make room.

const CELL_H = 44;
const POINTER_MARGIN = 48;
const PAD = 24;

export function layoutStack(data: StackData): Layout {
  if (data.values.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const ids = arrayNodeIds(data.values);
  const cellW = Math.max(...data.values.map((v) => measureCellWidth(String(v), 80)));
  const hasPointer = data.topIndex >= 0 && data.topIndex < data.values.length;
  const nodeX = hasPointer ? PAD + POINTER_MARGIN : PAD;
  const nodes: PositionedNode[] = [];

  for (let i = 0; i < data.values.length; i++) {
    const value = data.values[i] ?? "";
    const row = data.values.length - 1 - i;
    nodes.push({
      id: ids[i] ?? String(i),
      value,
      x: nodeX,
      y: PAD + row * CELL_H,
      width: cellW,
      height: CELL_H,
      shape: "grid-cell",
    });
  }

  const pointers: PositionedPointer[] = [];
  if (hasPointer) {
    const topRow = data.values.length - 1 - data.topIndex;
    pointers.push({
      name: "top",
      x: PAD,
      y: PAD + topRow * CELL_H + CELL_H / 2,
      angle: 90,
    });
  }

  const totalW = nodeX + cellW + PAD;
  const totalH = data.values.length * CELL_H + PAD * 2;

  return { nodes, edges: [], pointers, width: totalW, height: totalH };
}

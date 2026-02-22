import type { ArrayData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedPointer } from "../layout-types";
import { arrayNodeIds } from "../array-ids";
import { measureCellWidth } from "./measure";

// Layout: horizontal row with per-cell width (content-aware).
// Pointers sit below their target cell.

const CELL_H = 44;
const GAP = 8;
const POINTER_OFFSET_Y = 32;
const PAD = 16;

export function layoutArray(data: ArrayData): Layout {
  const ids = arrayNodeIds(data.values);
  const widths = data.values.map((value) => measureCellWidth(String(value), 56));

  const nodes: PositionedNode[] = [];
  let x = PAD;
  for (let i = 0; i < data.values.length; i++) {
    const value = data.values[i] ?? "";
    const width = widths[i] ?? 56;
    nodes.push({
      id: ids[i] ?? String(i),
      value,
      x,
      y: PAD,
      width,
      height: CELL_H,
      shape: "grid-cell",
    });
    x += width + GAP;
  }

  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const targetIdx = Number(p.targetId);
    const targetId = Number.isFinite(targetIdx) ? ids[targetIdx] : undefined;
    const targetNode = targetId
      ? nodes.find((n) => n.id === targetId)
      : nodes.find((n) => n.id === p.targetId);
    const x = targetNode ? targetNode.x + targetNode.width / 2 : PAD;
    const y = PAD + CELL_H + POINTER_OFFSET_Y;
    return { name: p.name, x, y };
  });

  const last = nodes[nodes.length - 1];
  const totalW = (last?.x ?? PAD) + (last?.width ?? 0) + PAD;
  const totalH = CELL_H + POINTER_OFFSET_Y + PAD * 2 + 16;

  return { nodes, edges: [], pointers, width: totalW, height: totalH };
}

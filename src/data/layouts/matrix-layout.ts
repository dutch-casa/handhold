import type { MatrixData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedPointer } from "../layout-types";

// 2D grid of cells with row/column headers.

const CELL_W = 48;
const CELL_H = 36;
const HEADER_W = 48;
const HEADER_H = 36;
const GAP = 2;
const PAD = 24;

export function layoutMatrix(data: MatrixData): Layout {
  if (data.rows.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const nodes: PositionedNode[] = [];
  const hasRowLabels = data.rowLabels.length > 0;
  const hasColLabels = data.colLabels.length > 0;
  const offsetX = hasRowLabels ? HEADER_W + GAP : 0;
  const offsetY = hasColLabels ? HEADER_H + GAP : 0;

  // Column headers
  if (hasColLabels) {
    for (let c = 0; c < data.colLabels.length; c++) {
      const label = data.colLabels[c] ?? "";
      nodes.push({
        id: `col-${c}`,
        value: label,
        x: PAD + offsetX + c * (CELL_W + GAP),
        y: PAD,
        width: CELL_W,
        height: HEADER_H,
        marker: "bucket-header",
      });
    }
  }

  // Rows
  for (let r = 0; r < data.rows.length; r++) {
    const row = data.rows[r];
    if (!row) continue;

    // Row label
    if (hasRowLabels) {
      const label = data.rowLabels[r] ?? "";
      nodes.push({
        id: `row-${r}`,
        value: label,
        x: PAD,
        y: PAD + offsetY + r * (CELL_H + GAP),
        width: HEADER_W,
        height: CELL_H,
        marker: "bucket-header",
      });
    }

    // Data cells
    for (let c = 0; c < row.length; c++) {
      const value = row[c] ?? "";
      nodes.push({
        id: `${r},${c}`,
        value,
        x: PAD + offsetX + c * (CELL_W + GAP),
        y: PAD + offsetY + r * (CELL_H + GAP),
        width: CELL_W,
        height: CELL_H,
      });
    }
  }

  const numCols = data.rows[0]?.length ?? 0;
  const totalW = PAD * 2 + offsetX + numCols * (CELL_W + GAP) - GAP;
  const totalH = PAD * 2 + offsetY + data.rows.length * (CELL_H + GAP) - GAP;

  const pointers: PositionedPointer[] = [];
  return { nodes, edges: [], pointers, width: totalW, height: totalH };
}

import type { LsmTreeData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";

// Vertical stack: memtable at top, levels below.
// Each level contains one or more sorted runs (horizontal arrays).

const CELL_W = 48;
const CELL_H = 36;
const CELL_GAP = 2;
const RUN_GAP = 16;
const LEVEL_GAP = 32;
const PAD = 24;
const ARROW_GAP = 16;

export function layoutLsmTree(data: LsmTreeData): Layout {
  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];
  let y = PAD;

  // Memtable row
  if (data.memtable.length > 0) {
    let x = PAD;
    for (let i = 0; i < data.memtable.length; i++) {
      const value = data.memtable[i] ?? "";
      nodes.push({
        id: `mem-${i}`,
        value,
        x,
        y,
        width: CELL_W,
        height: CELL_H,
        marker: "active-bit",
      });
      x += CELL_W + CELL_GAP;
    }
    y += CELL_H + LEVEL_GAP;
  }

  // Level rows
  for (let li = 0; li < data.levels.length; li++) {
    const level = data.levels[li];
    if (!level) continue;

    let x = PAD;
    for (let ri = 0; ri < level.runs.length; ri++) {
      const run = level.runs[ri];
      if (!run) continue;

      for (let ci = 0; ci < run.length; ci++) {
        const value = run[ci] ?? "";
        nodes.push({
          id: `${level.name}-r${ri}-${ci}`,
          value,
          x,
          y,
          width: CELL_W,
          height: CELL_H,
        });
        x += CELL_W + CELL_GAP;
      }
      x += RUN_GAP;
    }

    // Flush/compaction arrow from level above
    if (li === 0 && data.memtable.length > 0) {
      const memMidX = PAD + (data.memtable.length * (CELL_W + CELL_GAP)) / 2;
      edges.push({
        id: "flush-arrow",
        x1: memMidX,
        y1: PAD + CELL_H + ARROW_GAP,
        x2: memMidX,
        y2: y - ARROW_GAP,
        label: "flush",
        style: "dashed",
      });
    } else if (li > 0) {
      const prevLevel = data.levels[li - 1];
      if (prevLevel) {
        const prevRunCells = prevLevel.runs.reduce((sum, r) => sum + r.length, 0);
        const midX = PAD + (prevRunCells * (CELL_W + CELL_GAP)) / 2;
        edges.push({
          id: `compact-${li}`,
          x1: midX,
          y1: y - LEVEL_GAP + CELL_H + ARROW_GAP,
          x2: midX,
          y2: y - ARROW_GAP,
          label: "compact",
          style: "dashed",
        });
      }
    }

    y += CELL_H + LEVEL_GAP;
  }

  let maxX = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
  }

  const pointers: PositionedPointer[] = [];
  return { nodes, edges, pointers, width: maxX + PAD, height: y + PAD };
}

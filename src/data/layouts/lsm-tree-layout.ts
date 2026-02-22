import type { LsmTreeData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";
import { measureCellWidth } from "./measure";

// Vertical stack: memtable at top, levels below.
// Each level contains one or more sorted runs (horizontal arrays).

const CELL_H = 36;
const CELL_GAP = 2;
const RUN_GAP = 16;
const LEVEL_GAP = 56;
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
      const cellW = measureCellWidth(value, 48);
      nodes.push({
        id: `mem-${i}`,
        value,
        x,
        y,
        width: cellW,
        height: CELL_H,
        shape: "grid-cell",
        marker: "active-bit",
      });
      x += cellW + CELL_GAP;
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
        const cellW = measureCellWidth(value, 48);
        nodes.push({
          id: `${level.name}-r${ri}-${ci}`,
          value,
          x,
          y,
          width: cellW,
          height: CELL_H,
          shape: "grid-cell",
        });
        x += cellW + CELL_GAP;
      }
      x += RUN_GAP;
    }

    // Flush/compaction arrow — use actual node positions for midpoint
    if (li === 0 && data.memtable.length > 0) {
      const memNodes = nodes.filter((n) => n.id.startsWith("mem-"));
      const firstMem = memNodes[0];
      const lastMem = memNodes[memNodes.length - 1];
      const memMidX = firstMem && lastMem
        ? (firstMem.x + lastMem.x + lastMem.width) / 2
        : PAD;
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
        const prevNodes = nodes.filter((n) => n.id.startsWith(`${prevLevel.name}-`));
        const firstPrev = prevNodes[0];
        const lastPrev = prevNodes[prevNodes.length - 1];
        const midX = firstPrev && lastPrev
          ? (firstPrev.x + lastPrev.x + lastPrev.width) / 2
          : PAD;
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

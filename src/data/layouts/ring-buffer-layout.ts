import type { RingBufferData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedPointer } from "../layout-types";
import { measureCellWidth } from "./measure";

// Cells arranged on a circle. Active segment (head→tail) gets accent marker.

const CELL_H = 36;
const PAD = 40;

export function layoutRingBuffer(data: RingBufferData): Layout {
  if (data.capacity === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const cellW = data.values.length > 0
    ? Math.max(...data.values.map((v) => measureCellWidth(String(v), 40)))
    : 40;
  const ringR = Math.max(60, data.capacity * (cellW + 8) / (2 * Math.PI));
  const pointerR = ringR + 40;
  const cx = PAD + ringR + cellW / 2;
  const cy = PAD + ringR + CELL_H / 2;
  const nodes: PositionedNode[] = [];

  // Determine which indices are in the active segment
  const activeIndices = new Set<number>();
  if (data.values.length > 0) {
    let i = data.head;
    while (i !== data.tail) {
      activeIndices.add(i);
      i = (i + 1) % data.capacity;
    }
    activeIndices.add(data.tail);
  }

  for (let i = 0; i < data.capacity; i++) {
    const angle = (2 * Math.PI * i) / data.capacity - Math.PI / 2;
    const x = cx + ringR * Math.cos(angle) - cellW / 2;
    const y = cy + ringR * Math.sin(angle) - CELL_H / 2;
    const value = data.values[i] ?? "_";
    const isActive = activeIndices.has(i) && value !== "_";

    nodes.push({
      id: String(i),
      value,
      x,
      y,
      width: cellW,
      height: CELL_H,
      marker: isActive ? "active-bit" : undefined,
    });
  }

  // Head/tail pointers positioned outside the ring
  const pointers: PositionedPointer[] = [];
  const headAngle = (2 * Math.PI * data.head) / data.capacity - Math.PI / 2;
  pointers.push({
    name: "head",
    x: cx + pointerR * Math.cos(headAngle),
    y: cy + pointerR * Math.sin(headAngle),
  });

  const tailAngle = (2 * Math.PI * data.tail) / data.capacity - Math.PI / 2;
  pointers.push({
    name: "tail",
    x: cx + pointerR * Math.cos(tailAngle),
    y: cy + pointerR * Math.sin(tailAngle),
  });

  const totalSize = (ringR + cellW + PAD) * 2 + 40;

  return {
    nodes,
    edges: [],
    pointers,
    width: totalSize,
    height: totalSize,
  };
}

import type { RingBufferData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedPointer } from "../layout-types";

// Cells arranged on a circle. Active segment (head→tail) gets accent marker.

const RING_R = 100;
const CELL_W = 40;
const CELL_H = 32;
const PAD = 40;
const POINTER_R = RING_R + 50;

export function layoutRingBuffer(data: RingBufferData): Layout {
  if (data.capacity === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const cx = PAD + RING_R + CELL_W / 2;
  const cy = PAD + RING_R + CELL_H / 2;
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
    const x = cx + RING_R * Math.cos(angle) - CELL_W / 2;
    const y = cy + RING_R * Math.sin(angle) - CELL_H / 2;
    const value = data.values[i] ?? "_";
    const isActive = activeIndices.has(i) && value !== "_";

    nodes.push({
      id: String(i),
      value,
      x,
      y,
      width: CELL_W,
      height: CELL_H,
      marker: isActive ? "active-bit" : undefined,
    });
  }

  // Head/tail pointers positioned outside the ring
  const pointers: PositionedPointer[] = [];
  const headAngle = (2 * Math.PI * data.head) / data.capacity - Math.PI / 2;
  pointers.push({
    name: "head",
    x: cx + POINTER_R * Math.cos(headAngle),
    y: cy + POINTER_R * Math.sin(headAngle),
  });

  const tailAngle = (2 * Math.PI * data.tail) / data.capacity - Math.PI / 2;
  pointers.push({
    name: "tail",
    x: cx + POINTER_R * Math.cos(tailAngle),
    y: cy + POINTER_R * Math.sin(tailAngle),
  });

  const totalSize = (RING_R + CELL_W + PAD) * 2 + 40;

  return {
    nodes,
    edges: [],
    pointers,
    width: totalSize,
    height: totalSize,
  };
}

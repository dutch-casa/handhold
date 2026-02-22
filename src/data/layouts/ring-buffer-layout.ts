import type { RingBufferData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedPointer } from "../layout-types";

// Cells arranged on a circle. Active segment (head→tail) gets accent marker.
// Radius computed so adjacent cells never overlap.

const CELL_SIZE = 44;
const CELL_GAP = 12;
const PAD = 40;
const POINTER_GAP = 48;

export function layoutRingBuffer(data: RingBufferData): Layout {
  if (data.capacity === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const n = data.capacity;
  // Minimum chord length between adjacent cell centers = cell diagonal + gap
  const minChord = CELL_SIZE + CELL_GAP;
  // chord = 2R * sin(π/n), so R = minChord / (2 * sin(π/n))
  const ringR = n <= 1
    ? 0
    : Math.max(CELL_SIZE, minChord / (2 * Math.sin(Math.PI / n)));
  const pointerR = ringR + POINTER_GAP;
  const cx = PAD + ringR + CELL_SIZE / 2;
  const cy = PAD + ringR + CELL_SIZE / 2;
  const nodes: PositionedNode[] = [];

  // Determine which indices are in the active segment
  const activeIndices = new Set<number>();
  if (data.values.length > 0) {
    let i = data.head;
    while (i !== data.tail) {
      activeIndices.add(i);
      i = (i + 1) % n;
    }
    activeIndices.add(data.tail);
  }

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = cx + ringR * Math.cos(angle) - CELL_SIZE / 2;
    const y = cy + ringR * Math.sin(angle) - CELL_SIZE / 2;
    const value = data.values[i] ?? "_";
    const isActive = activeIndices.has(i) && value !== "_";

    nodes.push({
      id: String(i),
      value,
      x,
      y,
      width: CELL_SIZE,
      height: CELL_SIZE,
      marker: isActive ? "active-bit" : undefined,
    });
  }

  // Head/tail pointers outside the ring, arrows pointing inward
  const pointers: PositionedPointer[] = [];

  function addPointer(name: string, index: number): void {
    const α = (2 * Math.PI * index) / n - Math.PI / 2;
    // Rotation to point inward: default arrow is "up", rotate to face center
    const deg = (α * 180) / Math.PI + 270;
    pointers.push({
      name,
      x: cx + pointerR * Math.cos(α),
      y: cy + pointerR * Math.sin(α),
      angle: deg,
    });
  }

  addPointer("head", data.head);
  addPointer("tail", data.tail);

  const totalSize = (ringR + CELL_SIZE + PAD) * 2;

  return {
    nodes,
    edges: [],
    pointers,
    width: totalSize,
    height: totalSize,
  };
}

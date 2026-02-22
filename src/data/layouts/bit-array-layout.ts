import type { BitArrayData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedPointer } from "../layout-types";

// Row of small square cells. Active bits = accent fill.
// Count-min sketch: multiple rows (uses the `rows` field to wrap).

const CELL_SIZE = 32;
const GAP = 2;
const PAD = 24;
const HASH_LABEL_OFFSET_Y = 40;

export function layoutBitArray(data: BitArrayData): Layout {
  if (data.bits.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const nodes: PositionedNode[] = [];
  const rowCount = data.rows > 1 ? data.rows : 1;
  const colCount = Math.ceil(data.bits.length / rowCount);

  for (let i = 0; i < data.bits.length; i++) {
    const row = Math.floor(i / colCount);
    const col = i % colCount;
    const bitValue = data.bits[i] ?? 0;
    const isActive = bitValue > 0;

    nodes.push({
      id: String(i),
      value: String(bitValue),
      x: PAD + col * (CELL_SIZE + GAP),
      y: PAD + row * (CELL_SIZE + GAP),
      width: CELL_SIZE,
      height: CELL_SIZE,
      shape: "grid-cell",
      marker: isActive ? "active-bit" : "inactive-bit",
    });
  }

  // Hash function highlight pointers
  const pointers: PositionedPointer[] = [];
  let hashY = PAD + rowCount * (CELL_SIZE + GAP) + HASH_LABEL_OFFSET_Y;

  for (const h of data.hashHighlights) {
    for (const idx of h.indices) {
      const col = idx % colCount;
      pointers.push({
        name: `${h.name}→${idx}`,
        x: PAD + col * (CELL_SIZE + GAP) + CELL_SIZE / 2,
        y: hashY,
      });
    }
    hashY += 24;
  }

  const totalW = colCount * (CELL_SIZE + GAP) - GAP + PAD * 2;
  let maxY = PAD + rowCount * (CELL_SIZE + GAP);
  for (const p of pointers) {
    maxY = Math.max(maxY, p.y + 20);
  }

  return { nodes, edges: [], pointers, width: totalW, height: maxY + PAD };
}

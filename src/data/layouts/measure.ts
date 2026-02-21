const CHAR_W = 8;
const CELL_PADDING_X = 16;
const MIN_CELL_W = 48;
const MAX_CELL_W = 220;

export function measureCellWidth(value: string, minW = MIN_CELL_W): number {
  const contentW = value.length * CHAR_W + CELL_PADDING_X * 2;
  return Math.min(MAX_CELL_W, Math.max(minW, contentW));
}

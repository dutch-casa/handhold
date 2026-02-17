import type { MathExpression } from "@/types/lesson";

export type PositionedExpression = {
  readonly id: string;
  readonly latex: string;
  readonly x: number;
  readonly y: number;
};

const GAP = 24;
const PAD = 16;

// Vertical stack, centered. Dimensions come from KaTeX measurement at render time.
export function layoutMath(
  expressions: readonly MathExpression[],
  measurements: ReadonlyMap<string, { width: number; height: number }>,
): { items: readonly PositionedExpression[]; width: number; height: number } {
  let maxW = 0;
  let totalH = 0;

  for (const expr of expressions) {
    const m = measurements.get(expr.id);
    if (m) {
      maxW = Math.max(maxW, m.width);
      totalH += m.height;
    }
  }

  totalH += Math.max(0, expressions.length - 1) * GAP;

  const items: PositionedExpression[] = [];
  let y = PAD;

  for (const expr of expressions) {
    const m = measurements.get(expr.id);
    const w = m?.width ?? 0;
    items.push({
      id: expr.id,
      latex: expr.latex,
      x: PAD + (maxW - w) / 2,
      y,
    });
    y += (m?.height ?? 0) + GAP;
  }

  return {
    items,
    width: maxW + PAD * 2,
    height: totalH + PAD * 2,
  };
}

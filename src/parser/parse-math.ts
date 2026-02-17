import type { MathState, MathExpression } from "@/types/lesson";
import { splitContentAndRegions } from "./parse-regions";

// Parse math block content: LaTeX expressions separated by blank lines.
// Pure function: string → MathState.

export function parseMath(text: string, name: string): MathState {
  const { content, regions } = splitContentAndRegions(text);

  const rawExpressions = content
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const expressions: MathExpression[] = rawExpressions.map((latex, i) => ({
    id: `expr-${i}`,
    latex,
  }));

  return { kind: "math", name, expressions, regions };
}

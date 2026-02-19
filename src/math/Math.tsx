import { useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { MathState } from "@/types/lesson";
import katex from "katex";
// layout-math available for future SVG-based rendering
import { colors, spring, fade } from "@/app/theme";
import "katex/dist/katex.min.css";

type MathProps = {
  readonly state: MathState;
  readonly focus: string;
};

export function Math({ state, focus }: MathProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: 16 }}>
      <AnimatePresence mode="popLayout">
        {state.expressions.map((expr) => (
          <MathExpression
            key={expr.id}
            id={expr.id}
            latex={expr.latex}
            regions={state.regions}
            focus={focus}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function MathExpression({
  id,
  latex,
  regions,
  focus,
}: {
  readonly id: string;
  readonly latex: string;
  readonly regions: MathState["regions"];
  readonly focus: string;
}) {
  const focusedIds = useMemo(() => resolveRegion(focus, regions), [focus, regions]);

  const dimmed = focusedIds.length > 0 && !focusedIds.includes(id);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";
    katex.render(latex, el, { displayMode: true, throwOnError: false, output: "html" });
  }, [latex]);

  return (
    <motion.div
      layoutId={id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: dimmed ? 0.3 : 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ layout: spring, opacity: fade, y: spring }}
      style={{
        padding: "8px 12px",
        color: colors.text,
      }}
      ref={containerRef}
    />
  );
}

function resolveRegion(
  regionName: string,
  regions: MathState["regions"],
): string[] {
  if (regionName.length === 0) return [];
  const ids: string[] = [];
  for (const r of regions) {
    if (r.name !== regionName) {
      continue;
    }
    // Target for math: expression ID (numeric like "0", "1") or latex substring
    ids.push(r.target.replace(/^"|"$/g, ""));
  }
  return ids;
}

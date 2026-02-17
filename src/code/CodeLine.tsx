import { motion } from "motion/react";
import type { ShikiToken } from "./use-shiki";
import { CodeTokens } from "./CodeTokens";
import { colors, fonts, fontSizes, spacing, radii, spring, fade } from "@/app/theme";

type CodeLineProps = {
  readonly layoutKey: string;
  readonly tokens: readonly ShikiToken[];
  readonly lineNumber: number;
  readonly dimmed: boolean;
  readonly status: "kept" | "added" | "removed";
  readonly annotation: string;
  readonly substringTarget: string;
  readonly pointerAnnotation: string;
};

export function CodeLine({ layoutKey, tokens, lineNumber, dimmed, status, annotation, substringTarget, pointerAnnotation }: CodeLineProps) {
  return (
    <motion.div
      layoutId={layoutKey}
      layout="position"
      initial={status === "added" ? { opacity: 0, x: -8 } : false}
      animate={{ opacity: dimmed ? 0.3 : 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ layout: spring, opacity: fade, x: spring }}
      {...(!dimmed ? { "data-focused": true } : {})}
      style={{
        display: "flex",
        alignItems: "baseline",
        fontFamily: fonts.code,
        fontSize: fontSizes.code,
        lineHeight: "1.5",
        padding: "2px 0",
        whiteSpace: "pre",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: "3em",
          textAlign: "right",
          paddingRight: spacing.md,
          color: colors.textDim,
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        {lineNumber > 0 ? lineNumber : ""}
      </span>
      <CodeTokens
        tokens={tokens}
        dimmed={dimmed}
        substringTarget={substringTarget}
        pointerAnnotation={pointerAnnotation}
      />
      {annotation.length > 0 && (
        <span
          style={{
            marginLeft: spacing.md,
            color: colors.accent,
            fontSize: fontSizes.codeSmall,
            fontFamily: fonts.ui,
            whiteSpace: "nowrap",
            background: colors.bg,
            padding: "2px 6px",
            borderRadius: radii.sm,
          }}
        >
          {annotation}
        </span>
      )}
    </motion.div>
  );
}

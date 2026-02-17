import { motion } from "motion/react";
import type { ShikiToken } from "./use-shiki";
import { splitTokensAtSubstring } from "./split-tokens";
import { colors, fonts, fontSizes, radii, fade } from "@/app/theme";

type CodeTokensProps = {
  readonly tokens: readonly ShikiToken[];
  readonly dimmed: boolean;
  readonly substringTarget: string;
  readonly pointerAnnotation: string;
};

export function CodeTokens({ tokens, dimmed, substringTarget, pointerAnnotation }: CodeTokensProps) {
  if (substringTarget.length === 0) {
    return <span style={{ flex: 1 }}>{renderTokens(tokens, dimmed)}</span>;
  }

  const segments = splitTokensAtSubstring(tokens, substringTarget);

  return (
    <span style={{ flex: 1 }}>
      {segments.map((seg, i) =>
        seg.kind === "match" ? (
          <span key={i} style={{ position: "relative", display: "inline" }}>
            <span style={{ borderBottom: `2px solid ${colors.accent}`, paddingBottom: 1 }}>
              {renderTokens(seg.tokens, false)}
            </span>
            {pointerAnnotation.length > 0 && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={fade}
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  color: colors.accent,
                  fontSize: fontSizes.codeSmall,
                  fontFamily: fonts.ui,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  background: colors.bg,
                  padding: "2px 6px",
                  borderRadius: radii.sm,
                }}
              >
                {pointerAnnotation}
              </motion.span>
            )}
          </span>
        ) : (
          <span key={i}>{renderTokens(seg.tokens, dimmed)}</span>
        ),
      )}
    </span>
  );
}

function renderTokens(tokens: readonly ShikiToken[], dimmed: boolean) {
  return tokens.map((token, i) => (
    <span key={i} style={{ color: dimmed ? colors.textDim : token.color }}>
      {token.content}
    </span>
  ));
}

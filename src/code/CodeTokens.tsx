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
    return (
      <span style={{ flex: 1 }}>
        <TokenRun tokens={tokens} dimmed={dimmed} />
      </span>
    );
  }

  const segments = splitTokensAtSubstring(tokens, substringTarget);

  const segmentKeys = buildSegmentKeys(segments);

  return (
    <span style={{ flex: 1 }}>
      {segments.map((seg, idx) =>
        seg.kind === "match" ? (
          <span key={segmentKeys[idx]} style={{ position: "relative", display: "inline" }}>
            <span style={{ borderBottom: `2px solid ${colors.accent}`, paddingBottom: 1 }}>
              <TokenRun tokens={seg.tokens} dimmed={false} />
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
          <span key={segmentKeys[idx]}>
            <TokenRun tokens={seg.tokens} dimmed={dimmed} />
          </span>
        ),
      )}
    </span>
  );
}

function TokenRun({
  tokens,
  dimmed,
}: {
  readonly tokens: readonly ShikiToken[];
  readonly dimmed: boolean;
}) {
  const tokenKeys = buildTokenKeys(tokens);
  return (
    <>
      {tokens.map((token, idx) => (
        <span
          key={tokenKeys[idx]}
          style={{ color: dimmed ? colors.textDim : token.color }}
        >
          {token.content}
        </span>
      ))}
    </>
  );
}

function buildTokenKeys(tokens: readonly ShikiToken[]): readonly string[] {
  const counts = new Map<string, number>();
  return tokens.map((token) => {
    const signature = `${token.content}-${token.color}`;
    const next = (counts.get(signature) ?? 0) + 1;
    counts.set(signature, next);
    return `${signature}-${next}`;
  });
}

function buildSegmentKeys(segments: ReturnType<typeof splitTokensAtSubstring>): readonly string[] {
  const counts = new Map<string, number>();
  return segments.map((segment) => {
    const signature = `${segment.kind}-${segment.tokens[0]?.content ?? ""}-${segment.tokens[segment.tokens.length - 1]?.content ?? ""}-${segment.tokens.length}`;
    const next = (counts.get(signature) ?? 0) + 1;
    counts.set(signature, next);
    return `${signature}-${next}`;
  });
}

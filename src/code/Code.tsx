import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { CodeState, RegionDef, SlotEnterEffect, SceneAnnotation } from "@/types/lesson";
import { useShiki, type ShikiToken } from "./use-shiki";
import { diffCode } from "./code-diff";
import { diffTokens } from "./token-diff";
import type { TokenEntry } from "./token-diff";
import { CodeLine } from "./CodeLine";
import { CodeTokens } from "./CodeTokens";
import { colors, fonts, fontSizes, spacing, radii, spring, fade } from "@/app/theme";

type CodeProps = {
  readonly state: CodeState;
  readonly prevState: CodeState | undefined;
  readonly enterEffect: SlotEnterEffect | undefined;
  readonly focus: string;
  readonly pan: string;
  readonly annotations: readonly SceneAnnotation[];
};

export function Code({ state, prevState, enterEffect, focus, pan, annotations }: CodeProps) {
  const prevContent = prevState?.content ?? "";

  const diff = useMemo(
    () => diffCode(prevContent, state.content),
    [prevContent, state.content],
  );

  const { data: tokenLines } = useShiki(state.content, state.lang);
  const { data: prevTokenLines } = useShiki(prevContent || " ", prevState?.lang ?? state.lang);

  const useTokenMorph = prevState !== undefined && prevState.content !== state.content;
  const tokenDiff = useMemo(() => {
    if (!useTokenMorph || !prevTokenLines || !tokenLines) return null;
    return diffTokens(prevTokenLines, tokenLines);
  }, [useTokenMorph, prevTokenLines, tokenLines]);

  const focusResolved = useMemo(
    () => resolveCodeRegionDetailed(focus, state.regions),
    [focus, state.regions],
  );

  const panResolved = useMemo(
    () => resolveCodeRegionDetailed(pan, state.regions),
    [pan, state.regions],
  );
  const panLineSet = useMemo(() => {
    if (panResolved.length === 0) return null;
    return new Set(panResolved.map((e) => e.line));
  }, [panResolved]);

  const focusSet = useMemo(() => {
    if (state.focus.length === 0 && focusResolved.length === 0) return null;
    const set = new Set<number>();
    for (const range of state.focus) {
      for (let i = range.start; i <= range.end; i++) set.add(i);
    }
    for (const entry of focusResolved) set.add(entry.line);
    return set;
  }, [state.focus, focusResolved]);

  // Substring map: line → substring text (from focused region's text match)
  const substringFocusMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const entry of focusResolved) {
      if (entry.substring.length > 0) map.set(entry.line, entry.substring);
    }
    return map;
  }, [focusResolved]);

  // Pointer annotations: line → { substring, text } from scene annotations targeting code regions with text matches
  const pointerAnnotationMap = useMemo(() => {
    const map = new Map<number, { readonly substring: string; readonly text: string }>();
    for (const anno of annotations) {
      const resolved = resolveCodeRegionDetailed(anno.target, state.regions);
      for (const entry of resolved) {
        if (entry.substring.length > 0) {
          map.set(entry.line, { substring: entry.substring, text: anno.text });
        }
      }
    }
    return map;
  }, [annotations, state.regions]);

  const annotationMap = useMemo(() => {
    if (state.annotations.length === 0) return null;
    return new Map(state.annotations.map((a) => [a.line, a.text]));
  }, [state.annotations]);

  const renderedLines = useMemo(() => {
    const visible = diff.lines.filter((l) => l.status !== "removed");
    return visible.map((diffLine): RenderedLine => {
      const lineIdx = diffLine.lineNumber - 1;
      const tokens: readonly ShikiToken[] =
        tokenLines && lineIdx >= 0
          ? (tokenLines[lineIdx] ?? PLAIN_TOKENS(diffLine.content))
          : PLAIN_TOKENS(diffLine.content);

      const pointer = pointerAnnotationMap.get(diffLine.lineNumber);
      const focusSub = substringFocusMap.get(diffLine.lineNumber) ?? "";

      return {
        key: diffLine.key,
        tokens,
        lineNumber: diffLine.lineNumber,
        dimmed: focusSet !== null && !focusSet.has(diffLine.lineNumber),
        panTarget: panLineSet !== null && panLineSet.has(diffLine.lineNumber),
        status: diffLine.status,
        annotation: annotationMap?.get(diffLine.lineNumber) ?? "",
        substringTarget: pointer?.substring ?? focusSub,
        pointerAnnotation: pointer?.text ?? "",
      };
    });
  }, [diff.lines, tokenLines, focusSet, panLineSet, annotationMap, substringFocusMap, pointerAnnotationMap]);

  // Typewriter: spread the total animation duration evenly across lines
  const staggerDelay =
    enterEffect?.effect === "typewriter" && renderedLines.length > 0
      ? enterEffect.durationS / renderedLines.length
      : 0;

  // Group token diff entries by line for rendering
  const tokenLineGroups = useMemo(() => {
    if (!tokenDiff) return null;
    const groups = new Map<number, TokenEntry[]>();
    for (const t of tokenDiff.tokens) {
      if (t.status === "removed") continue;
      const arr = groups.get(t.line) ?? [];
      arr.push(t);
      groups.set(t.line, arr);
    }
    // Sort tokens within each line by column
    for (const arr of groups.values()) {
      arr.sort((a, b) => a.col - b.col);
    }
    return groups;
  }, [tokenDiff]);

  const removedTokens = useMemo(() => {
    if (!tokenDiff) return [];
    return tokenDiff.tokens.filter((t) => t.status === "removed");
  }, [tokenDiff]);

  if (tokenDiff && tokenLineGroups && enterEffect?.effect !== "typewriter") {
    const lineCount = tokenLines?.length ?? 0;
    return (
      <div style={{ background: "transparent", overflow: "hidden" }}>
        <div style={{ padding: `${spacing.md} 0`, overflowX: "auto", position: "relative" }}>
          <AnimatePresence>
            {removedTokens.map((token) => (
              <motion.span
                key={token.key}
                layoutId={token.key}
                initial={false}
                exit={{ opacity: 0 }}
                transition={{ opacity: fade }}
                style={{
                  position: "absolute",
                  fontFamily: fonts.code,
                  fontSize: fontSizes.code,
                  color: token.color,
                  whiteSpace: "pre",
                  pointerEvents: "none",
                }}
              />
            ))}
          </AnimatePresence>
          {Array.from({ length: lineCount }, (_, lineIdx) => {
            const lineTokens = tokenLineGroups.get(lineIdx) ?? [];
            return (
              <div
                key={lineIdx}
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
                  {lineIdx + 1}
                </span>
                <span>
                  {lineTokens.map((token) => (
                    <motion.span
                      key={token.key}
                      layoutId={token.key}
                      layout="position"
                      initial={token.status === "added" ? { opacity: 0 } : false}
                      animate={{ opacity: 1 }}
                      transition={{ layout: spring, opacity: fade }}
                      style={{ color: token.color }}
                    >
                      {token.content}
                    </motion.span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "transparent", overflow: "hidden" }}>
      {enterEffect?.effect === "typewriter" ? (
        <motion.div
          style={{ padding: `${spacing.md} 0`, overflowX: "auto" }}
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: staggerDelay }}
        >
          {renderedLines.map((line) => (
            <TypewriterLine
              key={line.key}
              tokens={line.tokens}
              lineNumber={line.lineNumber}
              dimmed={line.dimmed}
              annotation={line.annotation}
              substringTarget={line.substringTarget}
              pointerAnnotation={line.pointerAnnotation}
            />
          ))}
        </motion.div>
      ) : (
        <div style={{ padding: `${spacing.md} 0`, overflowX: "auto" }}>
          <AnimatePresence mode="popLayout">
            {renderedLines.map((line) => (
              <CodeLine
                key={line.key}
                layoutKey={line.key}
                tokens={line.tokens}
                lineNumber={line.lineNumber}
                dimmed={line.dimmed}
                panTarget={line.panTarget}
                status={line.status}
                annotation={line.annotation}
                substringTarget={line.substringTarget}
                pointerAnnotation={line.pointerAnnotation}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

type RenderedLine = {
  readonly key: string;
  readonly tokens: readonly ShikiToken[];
  readonly lineNumber: number;
  readonly dimmed: boolean;
  readonly panTarget: boolean;
  readonly status: "kept" | "added" | "removed";
  readonly annotation: string;
  readonly substringTarget: string;
  readonly pointerAnnotation: string;
};

function PLAIN_TOKENS(content: string): readonly ShikiToken[] {
  return [{ content, color: colors.text }];
}

const annotationStyle: React.CSSProperties = {
  marginLeft: spacing.md,
  color: colors.accent,
  fontSize: fontSizes.codeSmall,
  fontFamily: fonts.ui,
  whiteSpace: "nowrap",
  background: colors.bg,
  padding: "2px 6px",
  borderRadius: radii.sm,
};

type ResolvedCodeLine = {
  readonly line: number;
  readonly substring: string;
};

/** Resolve region to line numbers with optional substring text matches. */
function resolveCodeRegionDetailed(
  regionName: string,
  regions: readonly RegionDef[],
): ResolvedCodeLine[] {
  if (regionName.length === 0) return [];
  const results: ResolvedCodeLine[] = [];
  for (const r of regions) {
    if (r.name !== regionName) continue;
    for (const segment of r.target.split(",")) {
      const trimmed = segment.trim();
      // Format: `4 "| 0"` or `2-6` or bare `4`
      const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = Number(rangeMatch[1]);
        const end = Number(rangeMatch[2]);
        for (let i = start; i <= end; i++) {
          results.push({ line: i, substring: "" });
        }
        continue;
      }
      const textMatch = trimmed.match(/^(\d+)\s+"(.+)"$/);
      if (textMatch) {
        results.push({
          line: Number(textMatch[1]),
          substring: textMatch[2] ?? "",
        });
        continue;
      }
      const lineMatch = trimmed.match(/^(\d+)$/);
      if (lineMatch) {
        results.push({ line: Number(lineMatch[1]), substring: "" });
      }
    }
  }
  return results;
}

// --- Typewriter ---

const TYPEWRITER_VARIANTS = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0 },
} as const;

function TypewriterLine({
  tokens,
  lineNumber,
  dimmed,
  annotation,
  substringTarget,
  pointerAnnotation,
}: {
  readonly tokens: readonly ShikiToken[];
  readonly lineNumber: number;
  readonly dimmed: boolean;
  readonly annotation: string;
  readonly substringTarget: string;
  readonly pointerAnnotation: string;
}) {
  return (
    <motion.div
      variants={TYPEWRITER_VARIANTS}
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
        <span style={annotationStyle}>{annotation}</span>
      )}
    </motion.div>
  );
}

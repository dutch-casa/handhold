import type { ShikiToken } from "./use-shiki";

export type TokenSegment = {
  readonly tokens: readonly ShikiToken[];
  readonly kind: "before" | "match" | "after";
};

/** Split a token array at the first occurrence of a substring, preserving colors. */
export function splitTokensAtSubstring(
  tokens: readonly ShikiToken[],
  substring: string,
): readonly TokenSegment[] {
  const fullText = tokens.map((t) => t.content).join("");
  const matchIdx = fullText.indexOf(substring);
  if (matchIdx === -1) return [{ tokens, kind: "before" }];

  const matchEnd = matchIdx + substring.length;
  const before: ShikiToken[] = [];
  const matched: ShikiToken[] = [];
  const after: ShikiToken[] = [];

  let pos = 0;
  for (const token of tokens) {
    const tStart = pos;
    const tEnd = pos + token.content.length;

    if (tEnd <= matchIdx) {
      before.push(token);
    } else if (tStart >= matchEnd) {
      after.push(token);
    } else {
      const sliceStart = Math.max(0, matchIdx - tStart);
      const sliceEnd = Math.min(token.content.length, matchEnd - tStart);
      if (sliceStart > 0) {
        before.push({ content: token.content.slice(0, sliceStart), color: token.color });
      }
      matched.push({ content: token.content.slice(sliceStart, sliceEnd), color: token.color });
      if (sliceEnd < token.content.length) {
        after.push({ content: token.content.slice(sliceEnd), color: token.color });
      }
    }

    pos = tEnd;
  }

  return [
    { tokens: before, kind: "before" },
    { tokens: matched, kind: "match" },
    { tokens: after, kind: "after" },
  ];
}

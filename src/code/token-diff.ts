import type { ShikiToken } from "./use-shiki";

// Token-level diff for code morphing.
// Flattens two tokenized states into positional entries, then matches
// tokens by content+occurrence to produce stable keys for Motion layoutId.

export type TokenEntry = {
  readonly content: string;
  readonly color: string;
  readonly line: number;
  readonly col: number;
  readonly key: string;
  readonly status: "kept" | "added" | "removed";
};

export type TokenDiffResult = {
  readonly tokens: readonly TokenEntry[];
};

export function diffTokens(
  prevLines: readonly (readonly ShikiToken[])[],
  nextLines: readonly (readonly ShikiToken[])[],
): TokenDiffResult {
  const prevFlat = flatten(prevLines);
  const nextFlat = flatten(nextLines);

  // Count occurrences of each token content in prev
  const prevCounts = new Map<string, number>();
  for (const t of prevFlat) {
    prevCounts.set(t.content, (prevCounts.get(t.content) ?? 0) + 1);
  }

  // Count occurrences in next
  const nextCounts = new Map<string, number>();
  for (const t of nextFlat) {
    nextCounts.set(t.content, (nextCounts.get(t.content) ?? 0) + 1);
  }

  // Assign keys using occurrence counting (same approach as code-diff.ts keyFor)
  const prevCounters = new Map<string, number>();
  const prevKeyed = prevFlat.map((t) => {
    const idx = prevCounters.get(t.content) ?? 0;
    prevCounters.set(t.content, idx + 1);
    return { ...t, key: `${t.content}::${idx}` };
  });

  const nextCounters = new Map<string, number>();
  const nextKeyed = nextFlat.map((t) => {
    const idx = nextCounters.get(t.content) ?? 0;
    nextCounters.set(t.content, idx + 1);
    return { ...t, key: `${t.content}::${idx}` };
  });

  // Build set of next keys for matching
  const nextKeySet = new Set(nextKeyed.map((t) => t.key));
  const prevKeySet = new Set(prevKeyed.map((t) => t.key));

  const tokens: TokenEntry[] = [];

  // Removed tokens (in prev, not in next)
  for (const t of prevKeyed) {
    if (!nextKeySet.has(t.key)) {
      tokens.push({ ...t, status: "removed" });
    }
  }

  // Kept and added tokens (in next)
  for (const t of nextKeyed) {
    if (prevKeySet.has(t.key)) {
      tokens.push({ ...t, status: "kept" });
    } else {
      tokens.push({ ...t, status: "added" });
    }
  }

  return { tokens };
}

type FlatToken = {
  readonly content: string;
  readonly color: string;
  readonly line: number;
  readonly col: number;
};

function flatten(
  lines: readonly (readonly ShikiToken[])[],
): readonly FlatToken[] {
  const result: FlatToken[] = [];
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (!line) continue;
    let col = 0;
    for (const token of line) {
      if (token.content.trim().length > 0) {
        result.push({
          content: token.content,
          color: token.color,
          line: lineIdx,
          col,
        });
      }
      col += token.content.length;
    }
  }
  return result;
}

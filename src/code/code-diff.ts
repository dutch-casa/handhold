import { diffArrays } from "diff";

// Diff two code snapshots → stable-keyed lines for Motion's layoutId.
//
// "Stable key" means: if a line's content is the same across states,
// it gets the same key. Motion tracks identity by layoutId, so lines
// that move (insertion above pushes them down) animate smoothly.

export type DiffedLine = {
  readonly key: string;
  readonly content: string;
  readonly lineNumber: number;
  readonly status: "kept" | "added" | "removed";
};

export type DiffResult = {
  readonly lines: readonly DiffedLine[];
};

// --- Main entry ---
// Diffs prev vs next code strings by lines.
// Returns the NEXT state's lines, each with a stable key and status.

export function diffCode(prev: string, next: string): DiffResult {
  const prevLines = prev.split("\n");
  const nextLines = next.split("\n");

  const changes = diffArrays(prevLines, nextLines);

  const lines: DiffedLine[] = [];
  // Track occurrence count per content to disambiguate identical lines
  const contentCounters = new Map<string, number>();

  function keyFor(content: string): string {
    const count = contentCounters.get(content) ?? 0;
    contentCounters.set(content, count + 1);
    return `${content}::${count}`;
  }

  let lineNumber = 1;

  for (const change of changes) {
    if (!change.value) continue;

    if (change.removed) {
      // Lines being removed — include them for AnimatePresence exit
      for (const content of change.value) {
        lines.push({
          key: keyFor(content),
          content,
          lineNumber: -1,
          status: "removed",
        });
      }
      continue;
    }

    if (change.added) {
      for (const content of change.value) {
        lines.push({
          key: keyFor(content),
          content,
          lineNumber,
          status: "added",
        });
        lineNumber++;
      }
      continue;
    }

    // Unchanged
    for (const content of change.value) {
      lines.push({
        key: keyFor(content),
        content,
        lineNumber,
        status: "kept",
      });
      lineNumber++;
    }
  }

  return { lines };
}

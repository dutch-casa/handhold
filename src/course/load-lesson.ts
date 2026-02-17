// Concatenates glob-imported lesson parts in alphabetical order.
// Vite's import.meta.glob returns { path: content } — sort keys, join values.
// Parser sees a single markdown string. No parser changes needed.
export function concatLessonParts(parts: Record<string, string>): string {
  return Object.entries(parts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, content]) => content)
    .join("\n\n");
}

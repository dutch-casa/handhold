export function arrayNodeIds(values: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();
  return values.map((value) => {
    const key = String(value);
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return `v:${encodeURIComponent(key)}#${next}`;
  });
}

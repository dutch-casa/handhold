import type { RegionDef } from "@/types/lesson";

// Split block content from its `---` region footer.
// The footer defines named sub-elements for focus/highlight targeting.
// Format: `name: target` per line after the last `\n---\n`.

const SEPARATOR = "\n---\n";

export function splitContentAndRegions(raw: string): {
  content: string;
  regions: readonly RegionDef[];
} {
  const idx = raw.lastIndexOf(SEPARATOR);
  if (idx === -1) return { content: raw, regions: [] };

  const content = raw.slice(0, idx);
  const footer = raw.slice(idx + SEPARATOR.length);
  const regions = parseRegionLines(footer);
  return { content, regions };
}

function parseRegionLines(footer: string): RegionDef[] {
  const regions: RegionDef[] = [];
  for (const line of footer.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const name = trimmed.slice(0, colonIdx).trim();
    const target = trimmed.slice(colonIdx + 1).trim();
    if (name.length > 0 && target.length > 0) {
      regions.push({ name, target });
    }
  }
  return regions;
}

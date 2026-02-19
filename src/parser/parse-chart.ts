import type {
  ChartState,
  ChartKind,
  ChartSeries,
  ChartDataPoint,
  ChartAnnotation,
  ShadedRegion,
} from "@/types/lesson";
import { splitContentAndRegions } from "./parse-regions";

// Parse chart block content.
// Two formats:
//   Simple: `Label: value` pairs (single series)
//   Table:  `| x | Series1 | Series2 |` markdown table (multi-series)
// Decorations: `shade:` and `annotate:` lines after data, before `---`

const VALID_CHART_KINDS = new Set(["bar", "line", "scatter", "area", "pie", "radar", "radial"]);

export function parseChart(
  text: string,
  name: string,
  chartKindRaw: string,
): ChartState {
  const chartKind: ChartKind = VALID_CHART_KINDS.has(chartKindRaw)
    ? (chartKindRaw as ChartKind)
    : "bar";

  const { content, regions } = splitContentAndRegions(text);

  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const annotations: ChartAnnotation[] = [];
  const shadedRegions: ShadedRegion[] = [];
  const dataLines: string[] = [];

  // Separate data lines from decoration lines
  for (const line of lines) {
    const trimmed = line.trim();

    const shadeMatch = trimmed.match(
      /^shade:\s+(\S+)\.\.(\S+)\s+(\S+)$/,
    );
    if (shadeMatch) {
      shadedRegions.push({
        from: shadeMatch[1] ?? "",
        to: shadeMatch[2] ?? "",
        color: shadeMatch[3] ?? "",
      });
      continue;
    }

    const annotateMatch = trimmed.match(
      /^annotate:\s+(\S+)\s+"(.+)"$/,
    );
    if (annotateMatch) {
      annotations.push({
        label: annotateMatch[1] ?? "",
        text: annotateMatch[2] ?? "",
      });
      continue;
    }

    dataLines.push(trimmed);
  }

  // Detect format: table (starts with |) vs simple (key: value)
  const isTable = dataLines.some((l) => l.startsWith("|"));
  const series = isTable
    ? parseTableFormat(dataLines)
    : parseSimpleFormat(dataLines);

  return {
    kind: "chart",
    name,
    chartKind,
    series,
    annotations,
    shadedRegions,
    regions,
  };
}

// Simple format: `Label: value` per line → single series named "default"
function parseSimpleFormat(lines: readonly string[]): ChartSeries[] {
  const data: ChartDataPoint[] = [];
  for (const line of lines) {
    const match = line.match(/^(.+?):\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) continue;
    data.push({
      label: match[1]?.trim() ?? "",
      value: Number(match[2]),
    });
  }
  if (data.length === 0) return [];
  return [{ name: "default", data }];
}

// Table format: markdown pipe-delimited table
// First column is x-axis labels, remaining columns are series
function parseTableFormat(lines: readonly string[]): ChartSeries[] {
  const tableLines = lines.filter((l) => l.startsWith("|"));
  if (tableLines.length === 0) return [];

  const headerLine = tableLines[0];
  if (!headerLine) return [];

  const headers = parsePipeRow(headerLine);
  if (headers.length < 2) return [];

  // Skip separator row (contains dashes)
  const dataRows = tableLines
    .slice(1)
    .filter((l) => !l.includes("---") && !l.match(/^\|[\s-|]+\|$/));

  const seriesNames = headers.slice(1);
  const seriesMap = new Map<string, ChartDataPoint[]>();
  for (const sName of seriesNames) {
    if (sName) seriesMap.set(sName, []);
  }

  for (const row of dataRows) {
    const cells = parsePipeRow(row);
    const label = cells[0] ?? "";
    for (let i = 1; i < cells.length; i++) {
      const sName = seriesNames[i - 1];
      const val = cells[i];
      if (sName && val !== undefined) {
        const points = seriesMap.get(sName);
        if (points) {
          points.push({ label, value: Number(val) || 0 });
        }
      }
    }
  }

  const series: ChartSeries[] = [];
  for (const [sName, data] of seriesMap) {
    series.push({ name: sName, data });
  }
  return series;
}

function parsePipeRow(line: string): string[] {
  return line
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

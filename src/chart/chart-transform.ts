import type { ChartState } from "@/types/lesson";

// Transform ChartState into the flat record[] format Recharts expects.
// Each record has a "label" key (x-axis) plus one key per series name.

export type RechartsRecord = Record<string, string | number>;

export function toRechartsData(state: ChartState): RechartsRecord[] {
  if (state.series.length === 0) return [];

  const firstSeries = state.series[0];
  if (!firstSeries) return [];

  return firstSeries.data.map((point, i) => {
    const record: Record<string, string | number> = { label: point.label };
    for (const series of state.series) {
      const dp = series.data[i];
      if (dp) record[series.name] = dp.value;
    }
    return record;
  });
}

// Color palette for chart series
const SERIES_COLORS = [
  "oklch(69.4% 0.202 41.8)",   // accent (orange)
  "oklch(56.5% 0.196 256.5)",  // secondary (blue)
  "#4ade80",                     // green
  "#fbbf24",                     // amber
  "#f87171",                     // red
  "#a78bfa",                     // purple
] as const;

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length] ?? SERIES_COLORS[0];
}

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { ChartState } from "@/types/lesson";
import { toRechartsData, seriesColor } from "./chart-transform";
import { colors, fonts } from "@/app/theme";

type ChartProps = {
  readonly state: ChartState;
  readonly focus: string;
};

const CHART_HEIGHT = 300;

const axisStyle = {
  fontSize: 12,
  fontFamily: fonts.code,
  fill: colors.textMuted,
};

const gridStyle = {
  stroke: colors.border,
  strokeDasharray: "3 3",
};

export function Chart({ state, focus }: ChartProps) {
  const data = useMemo(() => toRechartsData(state), [state]);
  const seriesNames = state.series.map((s) => s.name);

  const focusedLabels = useMemo(
    () => resolveChartRegion(focus, state),
    [focus, state],
  );
  return (
    <div style={{ width: "100%", height: CHART_HEIGHT, padding: "8px 0" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartBody
          kind={state.chartKind}
          data={data}
          seriesNames={seriesNames}
          focusedLabels={focusedLabels}
          state={state}
        />
      </ResponsiveContainer>
    </div>
  );
}

function ChartBody({
  kind,
  data,
  seriesNames,
  focusedLabels: _focusedLabels,
  state,
}: {
  readonly kind: ChartState["chartKind"];
  readonly data: ReturnType<typeof toRechartsData>;
  readonly seriesNames: readonly string[];
  readonly focusedLabels: readonly string[];
  readonly state: ChartState;
}) {
  const annotations = state.annotations.map((a) => (
    <ReferenceLine
      key={`anno-${a.label}`}
      x={a.label}
      stroke={colors.warning}
      strokeDasharray="4 4"
      label={{ value: a.text, fill: colors.warning, fontSize: 11, fontFamily: fonts.code }}
    />
  ));

  switch (kind) {
    case "bar":
      return (
        <BarChart data={data}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="label" {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          {annotations}
          {seriesNames.map((name, i) => (
            <Bar
              key={name}
              dataKey={name}
              fill={seriesColor(i)}
              fillOpacity={0.85}
              animationDuration={400}
            />
          ))}
        </BarChart>
      );

    case "line":
      return (
        <LineChart data={data}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="label" {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          {annotations}
          {seriesNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={seriesColor(i)}
              strokeWidth={2}
              dot={{ r: 3, fill: seriesColor(i) }}
              animationDuration={400}
            />
          ))}
        </LineChart>
      );

    case "area":
      return (
        <AreaChart data={data}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="label" {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          {annotations}
          {seriesNames.map((name, i) => (
            <Area
              key={name}
              type="monotone"
              dataKey={name}
              stroke={seriesColor(i)}
              fill={seriesColor(i)}
              fillOpacity={0.2}
              strokeWidth={2}
              animationDuration={400}
            />
          ))}
        </AreaChart>
      );

    case "scatter":
      return (
        <ScatterChart>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="label" {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          {seriesNames.map((name, i) => (
            <Scatter
              key={name}
              dataKey={name}
              data={data}
              fill={seriesColor(i)}
              animationDuration={400}
            />
          ))}
        </ScatterChart>
      );
  }
}

const tooltipStyle: React.CSSProperties = {
  background: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  fontFamily: fonts.code,
  fontSize: 12,
  color: colors.text,
};

function resolveChartRegion(
  regionName: string,
  state: ChartState,
): string[] {
  if (regionName.length === 0) return [];
  const labels: string[] = [];
  for (const r of state.regions) {
    if (r.name !== regionName) continue;
    labels.push(r.target);
  }
  return labels;
}

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBarChart,
  RadialBar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
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
        {renderChart(state.chartKind, data, seriesNames, focusedLabels, state)}
      </ResponsiveContainer>
    </div>
  );
}

function renderChart(
  kind: ChartState["chartKind"],
  data: ReturnType<typeof toRechartsData>,
  seriesNames: string[],
  _focusedLabels: string[],
  state: ChartState,
) {
  const annotations = state.annotations.map((a) => (
    <ReferenceLine
      key={`anno-${a.label}`}
      x={a.label}
      stroke={colors.warning}
      strokeDasharray="4 4"
      label={{ value: a.text, fill: colors.warning, fontSize: 11, fontFamily: fonts.code }}
    />
  ));
  const shaded = state.shadedRegions.map((s, idx) => (
    <ReferenceArea
      key={`shade-${s.from}-${s.to}-${idx}`}
      x1={s.from}
      x2={s.to}
      fill={s.color}
      fillOpacity={0.12}
      strokeOpacity={0}
    />
  ));

  switch (kind) {
    case "bar":
      return (
        <BarChart data={data}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="label" {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipTextStyle}
            itemStyle={tooltipTextStyle}
            wrapperStyle={tooltipWrapperStyle}
          />
          {shaded}
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
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipTextStyle}
            itemStyle={tooltipTextStyle}
            wrapperStyle={tooltipWrapperStyle}
          />
          {shaded}
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
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipTextStyle}
            itemStyle={tooltipTextStyle}
            wrapperStyle={tooltipWrapperStyle}
          />
          {shaded}
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
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={tooltipTextStyle}
            itemStyle={tooltipTextStyle}
            wrapperStyle={tooltipWrapperStyle}
          />
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
    case "pie": {
      const series = state.series[0];
      const pieData = series?.data.map((point) => ({
        name: point.label,
        value: point.value,
      })) ?? [];
      return (
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            innerRadius={40}
            outerRadius={90}
            paddingAngle={2}
            animationDuration={400}
          >
            {pieData.map((entry, i) => (
              <Cell key={entry.name} fill={seriesColor(i)} />
            ))}
          </Pie>
        </PieChart>
      );
    }
    case "radar":
      return (
        <RadarChart data={data}>
          <PolarGrid stroke={colors.border} />
          <PolarAngleAxis dataKey="label" tick={{ ...axisStyle }} />
          <PolarRadiusAxis tick={{ ...axisStyle }} />
          <Tooltip contentStyle={tooltipStyle} />
          {seriesNames.map((name, i) => (
            <Radar
              key={name}
              dataKey={name}
              stroke={seriesColor(i)}
              fill={seriesColor(i)}
              fillOpacity={0.15}
              animationDuration={400}
            />
          ))}
        </RadarChart>
      );
    case "radial": {
      const series = state.series[0];
      const radialData = series?.data.map((point) => ({
        name: point.label,
        value: point.value,
      })) ?? [];
      return (
        <RadialBarChart
          data={radialData}
          innerRadius={30}
          outerRadius={110}
          barSize={10}
          startAngle={90}
          endAngle={-270}
        >
          <Tooltip contentStyle={tooltipStyle} />
          <RadialBar
            dataKey="value"
            cornerRadius={6}
            animationDuration={400}
          >
            {radialData.map((entry, i) => (
              <Cell key={entry.name} fill={seriesColor(i)} />
            ))}
          </RadialBar>
        </RadialBarChart>
      );
    }
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

const tooltipTextStyle: React.CSSProperties = {
  color: colors.text,
  fontFamily: fonts.code,
  fontSize: 12,
};

const tooltipWrapperStyle: React.CSSProperties = {
  outline: "none",
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

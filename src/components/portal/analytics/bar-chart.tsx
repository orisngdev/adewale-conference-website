"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, GRID_STROKE, seriesColor } from "./chart-theme";
import type { Series } from "./trend-chart";

export type BarPoint = { label: string; color?: string } & Record<string, string | number>;

const TOOLTIP_STYLE = {
  background: "#FFFFFF",
  border: "1px solid rgba(10,15,30,0.12)",
  borderRadius: 0,
  fontSize: 12,
} as const;

/**
 * Categorical bar chart. `horizontal` puts categories on the Y-axis (bars grow
 * left→right — used for the competition ladder, LGA/category breakdowns). With a
 * single series and per-point `color`, each bar is coloured individually
 * (semantic buckets); multiple series render grouped or `stacked` bars.
 */
export default function BarChartCard({
  data,
  series,
  horizontal = false,
  stacked = false,
  height = 240,
}: {
  data: BarPoint[];
  series: Series[];
  horizontal?: boolean;
  stacked?: boolean;
  height?: number;
}) {
  if (!data.length) return <NoData height={height} />;
  const showLegend = series.length > 1;
  const perPointColor = series.length === 1 && data.some((d) => d.color);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 8, bottom: 0, left: horizontal ? 8 : -12 }}
      >
        <CartesianGrid horizontal={!horizontal} vertical={horizontal} stroke={GRID_STROKE} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={AXIS.tick} stroke={AXIS.stroke} tickLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="label"
              tick={AXIS.tick}
              stroke={AXIS.stroke}
              tickLine={false}
              width={110}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={AXIS.tick} stroke={AXIS.stroke} tickLine={false} minTickGap={8} />
            <YAxis tick={AXIS.tick} stroke={AXIS.stroke} tickLine={false} width={40} allowDecimals={false} />
          </>
        )}
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(10,15,30,0.04)" }} />
        {showLegend ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId={stacked ? "1" : undefined}
            fill={s.color ?? seriesColor(i)}
            radius={horizontal ? [0, 2, 2, 0] : [2, 2, 0, 0]}
            maxBarSize={horizontal ? 26 : 48}
          >
            {perPointColor
              ? data.map((d, idx) => <Cell key={idx} fill={d.color ?? seriesColor(i)} />)
              : null}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function NoData({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-muted-foreground"
      style={{ height }}
    >
      No data yet.
    </div>
  );
}

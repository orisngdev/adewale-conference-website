"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS, GRID_STROKE, seriesColor } from "./chart-theme";

export type Series = { key: string; name: string; color?: string };
export type TrendPoint = { label: string } & Record<string, string | number>;

const TOOLTIP_STYLE = {
  background: "#FFFFFF",
  border: "1px solid rgba(10,15,30,0.12)",
  borderRadius: 0,
  fontSize: 12,
} as const;

/**
 * Time-series line/area chart. Pass one or more numeric `series` keyed into each
 * `data` point (which also carries a string `label` for the x-axis). Renders a
 * stacked area when `stacked`, otherwise overlaid lines/areas.
 */
export default function TrendChart({
  data,
  series,
  variant = "area",
  stacked = false,
  height = 240,
}: {
  data: TrendPoint[];
  series: Series[];
  variant?: "area" | "line";
  stacked?: boolean;
  height?: number;
}) {
  if (!data.length) return <NoData height={height} />;
  const showLegend = series.length > 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      {variant === "area" ? (
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            {series.map((s, i) => {
              const c = s.color ?? seriesColor(i);
              return (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={c} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" tick={AXIS.tick} stroke={AXIS.stroke} tickLine={false} minTickGap={24} />
          <YAxis tick={AXIS.tick} stroke={AXIS.stroke} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {showLegend ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
          {series.map((s, i) => {
            const c = s.color ?? seriesColor(i);
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stackId={stacked ? "1" : undefined}
                stroke={c}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
              />
            );
          })}
        </AreaChart>
      ) : (
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" tick={AXIS.tick} stroke={AXIS.stroke} tickLine={false} minTickGap={24} />
          <YAxis tick={AXIS.tick} stroke={AXIS.stroke} tickLine={false} width={40} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {showLegend ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color ?? seriesColor(i)}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      )}
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

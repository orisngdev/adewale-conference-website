"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
import { Button } from "@/components/ui/button";
import type { BarPointDetail } from "@/lib/analytics-buckets";
import { AXIS, GRID_STROKE, seriesColor } from "./chart-theme";
import type { Series } from "./trend-chart";

export type BarPoint = {
  label: string;
  color?: string;
  detail?: BarPointDetail;
} & Record<string, string | number | BarPointDetail | undefined>;

const TOOLTIP_STYLE = {
  background: "#FFFFFF",
  border: "1px solid rgba(10,15,30,0.12)",
  borderRadius: 0,
  fontSize: 12,
} as const;

/**
 * Categorical bar chart. `horizontal` puts categories on the Y-axis (bars grow
 * left→right — used for the competition ladder and compact breakdowns). With a
 * single series and per-point `color`, each bar is coloured individually
 * (semantic buckets); multiple series render grouped or `stacked` bars.
 */
export default function BarChartCard({
  data,
  series,
  horizontal = false,
  stacked = false,
  height = 240,
  minWidth,
  wrapXAxisLabels = false,
}: {
  data: BarPoint[];
  series: Series[];
  horizontal?: boolean;
  stacked?: boolean;
  height?: number;
  minWidth?: number;
  wrapXAxisLabels?: boolean;
}) {
  const [selected, setSelected] = useState<BarPoint | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  if (!data.length) return <NoData height={height} />;
  const showLegend = series.length > 1;
  const perPointColor = series.length === 1 && data.some((d) => d.color);
  const canInspect = data.some((d) => d.detail);

  return (
    <>
      <div className={minWidth ? "overflow-x-auto" : undefined}>
        <div style={{ height, minWidth }}>
          <ResponsiveContainer width="100%" height="100%">
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
                  <XAxis
                    dataKey="label"
                    tick={wrapXAxisLabels ? <WrappedCategoryTick /> : AXIS.tick}
                    stroke={AXIS.stroke}
                    tickLine={false}
                    minTickGap={wrapXAxisLabels ? 0 : 8}
                    interval={wrapXAxisLabels ? 0 : undefined}
                    height={wrapXAxisLabels ? 72 : undefined}
                  />
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
                  cursor={canInspect ? "pointer" : undefined}
                  onClick={(payload) => {
                    const point = (payload as { payload?: BarPoint }).payload;
                    if (point?.detail) setSelected(point);
                  }}
                >
                  {perPointColor
                    ? data.map((d, idx) => <Cell key={idx} fill={d.color ?? seriesColor(i)} />)
                    : null}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {selected ? <PointDetailDialog point={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function WrappedCategoryTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}) {
  const label = String(payload?.value ?? "");
  const parts = label.split(/[\s/-]+/);

  return (
    <text x={x} y={y + 12} textAnchor="middle" fill={AXIS.tick.fill} fontSize={10}>
      {parts.map((part, i) => (
        <tspan key={`${part}-${i}`} x={x} dy={i === 0 ? 0 : 12}>
          {part}
        </tspan>
      ))}
    </text>
  );
}

function PointDetailDialog({ point, onClose }: { point: BarPoint; onClose: () => void }) {
  const detail = point.detail;
  if (!detail || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chart-point-detail-title"
    >
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/50 cursor-default"
      />
      <div className="relative w-full max-w-sm bg-card border border-foreground/10 shadow-[0_4px_40px_rgba(10,15,30,0.2)] p-6">
        <h2 id="chart-point-detail-title" className="font-bebas text-2xl text-foreground leading-tight">
          {detail.title ?? point.label}
        </h2>
        {detail.description ? (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{detail.description}</p>
        ) : null}
        {detail.rows?.length ? (
          <dl className="mt-5 divide-y divide-border text-sm">
            {detail.rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[7.5rem_1fr] gap-3 py-2">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {detail.items?.length ? (
          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {detail.itemsTitle ?? "Details"}
            </p>
            <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1 text-sm text-foreground">
              {detail.items.map((item, i) => (
                <li key={`${item}-${i}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end">
          <Button type="button" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body,
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

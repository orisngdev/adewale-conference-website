"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { seriesColor } from "./chart-theme";

export type Slice = { name: string; value: number; color?: string };

const TOOLTIP_STYLE = {
  background: "#FFFFFF",
  border: "1px solid rgba(10,15,30,0.12)",
  borderRadius: 0,
  fontSize: 12,
} as const;

/** Composition donut — status splits, practice/exam mix, engagement mix. */
export default function DonutChart({
  data,
  height = 240,
}: {
  data: Slice[];
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <NoData height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={1}
          strokeWidth={0}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? seriesColor(i)} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
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

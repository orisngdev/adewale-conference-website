export type BarPointDetail = {
  title?: string;
  description?: string;
  rows?: { label: string; value: string | number }[];
  itemsTitle?: string;
  items?: string[];
};

export type AnalyticsBarPoint = {
  label: string;
  value: number;
  color?: string;
  detail?: BarPointDetail;
};

export function topN(counts: Map<string, number>, n: number, otherLabel = "Other"): AnalyticsBarPoint[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const out: AnalyticsBarPoint[] = sorted.slice(0, n).map(([label, value]) => ({ label: label || "-", value }));
  const rest = sorted.slice(n).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) out.push({ label: otherLabel, value: rest });
  return out;
}

export function tally<T>(rows: T[], keyOf: (r: T) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k == null) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function orderedBuckets(counts: Map<string, number>, labels: readonly string[]): AnalyticsBarPoint[] {
  const seen = new Set(labels);
  const fixed = labels.map((label) => ({ label, value: counts.get(label) ?? 0 }));
  const extras = [...counts.entries()]
    .filter(([label, value]) => !seen.has(label) && value > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label: label || "-", value }));

  return [...fixed, ...extras];
}

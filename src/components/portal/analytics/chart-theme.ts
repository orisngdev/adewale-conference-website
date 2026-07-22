// Shared chart palette + axis styling for the admin analytics dashboard.
// Colours are the literal hex values behind the design tokens in globals.css
// (Recharts needs concrete colours, not Tailwind utility classes). The portal is
// light-only, so there is no dark variant to track.

/** Brand tokens (mirror src/app/globals.css @theme). */
export const BRAND = {
  gold: "#E8A020", // --color-primary / accent
  goldInk: "#8A5E0E", // --color-gold-ink (AA-safe gold for text)
  navy: "#1C2540", // --color-secondary
  ink: "#0A0F1E", // --color-foreground
  muted: "#4A4E5C", // --color-muted-foreground
  border: "rgba(10,15,30,0.12)", // --color-border
} as const;

/** Semantic colours for the acceptance / competition-ladder buckets. */
export const STATUS_COLOR: Record<string, string> = {
  submitted: "#94A3B8", // slate — awaiting review
  registered: "#94A3B8",
  verified: "#2563EB", // blue — matches StatusBadge "verified"
  accepted: "#2563EB",
  qualified: "#E8A020", // gold — past zonals
  finalist: "#16A34A", // green — reached the finale
  declined: "#B91C1C", // --color-destructive
  waitlist: "#A855F7",
};

/**
 * Ordered categorical palette for series that have no inherent semantic colour
 * (editions, LGAs, challenges, roles…). Distinguishable and on-brand.
 */
export const SERIES: string[] = [
  "#E8A020", // gold
  "#1C2540", // navy
  "#2563EB", // blue
  "#16A34A", // green
  "#A855F7", // violet
  "#DC2626", // red
  "#0891B2", // cyan
  "#D97706", // amber
];

/** Shared Recharts axis/grid props so every chart reads the same. */
export const AXIS = {
  tick: { fill: BRAND.muted, fontSize: 11 },
  stroke: BRAND.border,
} as const;

export const GRID_STROKE = "rgba(10,15,30,0.06)";

/** Pick a series colour by index, wrapping around the palette. */
export function seriesColor(i: number): string {
  return SERIES[i % SERIES.length];
}

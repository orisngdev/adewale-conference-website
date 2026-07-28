import Link from "next/link";
import { listQuery } from "@/components/portal/list-controls";

// Zero-JS analytics controls: the time window is a segmented set of links, the
// edition selector (competition section only) likewise, and the jump-nav is
// plain anchor links. No client state — every control is a navigation.

export type WindowKey = "30d" | "90d" | "12mo" | "all";

export const TIME_WINDOWS: { key: WindowKey; label: string; days: number | null }[] = [
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "12mo", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: null },
];

export const DEFAULT_WINDOW: WindowKey = "all";

export function windowDays(key: string | undefined): number | null {
  return (TIME_WINDOWS.find((w) => w.key === key) ?? TIME_WINDOWS[3]).days;
}

export function resolveWindow(key: string | undefined): WindowKey {
  return (TIME_WINDOWS.find((w) => w.key === key)?.key ?? DEFAULT_WINDOW);
}

const seg =
  "px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors whitespace-nowrap";
const segOn = "bg-primary/15 text-gold-ink";
const segOff = "bg-foreground/5 text-muted-foreground hover:text-foreground";

/** Segmented activity-range control. Preserves the current edition param. */
export function WindowFilter({
  current,
  edition,
}: {
  current: WindowKey;
  edition?: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Activity range">
      {TIME_WINDOWS.map((w) => (
        <Link
          key={w.key}
          href={`/portal/admin/analytics${listQuery({ window: w.key, edition })}`}
          aria-current={w.key === current ? "true" : undefined}
          className={`${seg} ${w.key === current ? segOn : segOff}`}
        >
          {w.label}
        </Link>
      ))}
    </div>
  );
}

/** Segmented edition control (scopes the Registrations & Competition section). */
export function EditionFilter({
  years,
  current,
  window,
}: {
  years: number[];
  current: number;
  window: string;
}) {
  if (years.length <= 1) return null;
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Competition edition">
      {years.map((y) => (
        <Link
          key={y}
          href={`/portal/admin/analytics${listQuery({ window, edition: String(y) })}#registrations`}
          aria-current={y === current ? "true" : undefined}
          className={`${seg} ${y === current ? segOn : segOff}`}
        >
          {y}
        </Link>
      ))}
    </div>
  );
}

/** Sticky in-page anchor navigation between the dashboard sections. */
export function JumpNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav
      aria-label="Dashboard sections"
      className="sticky top-0 z-20 -mx-5 md:-mx-10 px-5 md:px-10 py-2 bg-background/90 backdrop-blur border-b border-border overflow-x-auto"
    >
      <div className="flex items-center gap-1 max-w-6xl mx-auto">
        {items.map((it) => (
          <a
            key={it.id}
            href={`#${it.id}`}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground whitespace-nowrap"
          >
            {it.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

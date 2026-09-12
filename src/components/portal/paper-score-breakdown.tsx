import type { SubjectBreakdown } from "@/supabase/types";
import { percent } from "@/lib/paper-exam";

// `compact` is the inline strip on a stage chip; the full form is a labelled bar
// per subject. Subject keys are the exam's own vocabulary, rendered verbatim.

function orderedEntries(breakdown: SubjectBreakdown, order?: string[] | null) {
  const entries = Object.entries(breakdown);
  if (!order?.length) return entries;
  const rank = new Map(order.map((s, i) => [s, i]));
  return entries.sort(
    (a, b) => (rank.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b[0]) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function PaperScoreBreakdown({
  breakdown,
  order,
  compact = false,
  className,
}: {
  breakdown: SubjectBreakdown;
  /** The exam's subject order, so the strip reads the same everywhere. */
  order?: string[] | null;
  compact?: boolean;
  className?: string;
}) {
  const entries = orderedEntries(breakdown, order);
  if (entries.length === 0) return null;

  if (compact) {
    return (
      <span className={`flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground ${className ?? ""}`}>
        {entries.map(([subject, s]) => (
          <span key={subject} className="whitespace-nowrap">
            {subject}{" "}
            <span className="tabular-nums text-foreground">
              {s.correct}/{s.out_of}
            </span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <ul className={`space-y-2 ${className ?? ""}`}>
      {entries.map(([subject, s]) => {
        const pct = percent(s.correct, s.out_of);
        return (
          <li key={subject}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-foreground">{subject}</span>
              <span className="tabular-nums text-muted-foreground">
                {s.correct}/{s.out_of} · {pct}%
              </span>
            </div>
            <div
              className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
              role="img"
              aria-label={`${subject}: ${s.correct} of ${s.out_of}`}
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

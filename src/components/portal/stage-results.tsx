import type { StageOutcome, StageResult } from "@/supabase/types";

// Per-school stage verdicts. Unlike EditionStages (which shows where the whole
// edition is), this shows how THIS school fared at each stage — advanced,
// eliminated, still pending, or not yet marked. A school can be green at the
// Zonal Stage and red at the Grand Finale.
const OUTCOME_STYLE: Record<StageOutcome, { badge: string; label: string }> = {
  advanced: {
    badge: "bg-green-100 text-green-800 border-green-600/30",
    label: "Advanced",
  },
  eliminated: {
    badge: "bg-red-100 text-red-800 border-red-600/30",
    label: "Not advanced",
  },
  pending: {
    badge: "bg-primary/15 text-gold-ink border-primary/30",
    label: "Pending",
  },
};

const NOT_MARKED = "border-foreground/15 text-muted-foreground";

export function StageResults({
  stages,
  results,
  className,
}: {
  stages: string[];
  results: StageResult[];
  className?: string;
}) {
  const byStage = new Map(results.map((r) => [r.stage, r]));
  // Only the stages that are actually contested — skip the bookend markers that
  // are never a pass/fail (Registration, Completed) unless they carry a result.
  const contested = stages.filter(
    (s) => byStage.has(s) || !["Registration", "Completed"].includes(s),
  );
  if (contested.length === 0) return null;

  return (
    <ol className={`flex flex-wrap items-center gap-x-2 gap-y-2 ${className ?? ""}`}>
      {contested.map((stage) => {
        const result = byStage.get(stage);
        const style = result ? OUTCOME_STYLE[result.outcome] : null;
        return (
          <li
            key={stage}
            className="flex items-center gap-2 border border-foreground/10 bg-card px-3 py-1.5"
            title={result?.note ?? undefined}
          >
            <span className="text-xs font-bold uppercase tracking-wide text-foreground">
              {stage}
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                style ? style.badge : NOT_MARKED
              }`}
            >
              {style ? style.label : "Not marked"}
            </span>
            {result?.score != null ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {result.score}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

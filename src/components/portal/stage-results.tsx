import Link from "next/link";
import type { StageOutcome, StageResult, SubjectBreakdown } from "@/supabase/types";
import { PaperScoreBreakdown } from "@/components/portal/paper-score-breakdown";

// Per-school stage verdicts. Unlike EditionStages (which shows where the whole
// edition is), this shows how THIS school fared at each stage — advanced,
// eliminated, still pending, or not yet marked. A school can be green at the
// Zonal Stage and red at the Grand Finale.
//
// This is the only place a competition score reaches a non-admin, so it is also
// where a paper exam's total and subject breakdown surface.
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

/** A row that may additionally carry a paper-exam breakdown and a link to the
 *  per-item review. */
export type StageResultRow = StageResult & {
  /** Which sitting this verdict belongs to, so a backfilled year can be told
   *  apart from the current one. */
  edition_year?: number | null;
  breakdown?: SubjectBreakdown | null;
  /** Where the full paper review lives, when there is one. */
  detailHref?: string | null;
  /** The exam's subject order, so the strip reads consistently. */
  subjectOrder?: string[] | null;
};

export function StageResults({
  stages,
  results,
  edition,
  className,
}: {
  stages: string[];
  results: StageResultRow[];
  /** The edition these stages belong to. A result from any OTHER year is
   *  labelled with its own year — a backfilled sitting must never read as this
   *  year's verdict just because it shares a stage name. */
  edition?: number | null;
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
    <ol className={`flex flex-wrap items-start gap-x-2 gap-y-2 ${className ?? ""}`}>
      {contested.map((stage) => {
        const result = byStage.get(stage);
        const style = result ? OUTCOME_STYLE[result.outcome] : null;
        const breakdown = result?.breakdown ?? null;
        const hasBreakdown = breakdown && Object.keys(breakdown).length > 0;

        return (
          <li
            key={stage}
            className="border border-foreground/10 bg-card px-3 py-1.5"
            title={result?.note ?? undefined}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                {stage}
              </span>
              {result?.edition_year != null &&
              edition != null &&
              Number(result.edition_year) !== Number(edition) ? (
                <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {result.edition_year}
                </span>
              ) : null}
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                  style ? style.badge : NOT_MARKED
                }`}
              >
                {style ? style.label : "Not marked"}
              </span>
              {result?.score != null ? (
                <span className="text-xs tabular-nums text-foreground">
                  {result.score}
                  {/* score_max makes the figure legible — a bare "84" never said
                      out of what. */}
                  {result.score_max != null ? (
                    <span className="text-muted-foreground">/{result.score_max}</span>
                  ) : null}
                </span>
              ) : null}
            </div>

            {hasBreakdown ? (
              <PaperScoreBreakdown
                breakdown={breakdown}
                order={result?.subjectOrder}
                compact
                className="mt-1.5"
              />
            ) : null}

            {result?.detailHref ? (
              <Link
                href={result.detailHref}
                className="mt-1 inline-block text-xs text-primary hover:underline"
              >
                See the full paper →
              </Link>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

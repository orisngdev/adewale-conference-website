import Link from "next/link";
import { Card, EmptyState } from "@/components/portal/ui";
import { PaperScoreBreakdown } from "@/components/portal/paper-score-breakdown";
import type { StageResultRow } from "@/components/portal/stage-results";
import type { Edition, StageOutcome } from "@/supabase/types";

// A student's own competition record — the paper qualifier's score, subject
// breakdown and per-item review.
//
// Only the stages they actually reached. A ladder of "Not marked" chips for
// every round after the one they went out at reads as pending rather than over,
// and buries the one row carrying a score.

const OUTCOME_STYLE: Record<StageOutcome, { badge: string; label: string }> = {
  advanced: { badge: "bg-green-100 text-green-800 border-green-600/30", label: "Advanced" },
  eliminated: { badge: "bg-red-100 text-red-800 border-red-600/30", label: "Not advanced" },
  pending: { badge: "bg-primary/15 text-gold-ink border-primary/30", label: "Pending" },
};

export function StudentCompetitionResults({
  editions,
  fallbackYear,
  results,
}: {
  /** Newest first. The component picks the edition it shows, so it takes the
   *  whole list rather than one edition's ladder — passing the wrong year's
   *  stage order is otherwise silent. */
  editions: Edition[];
  /** Used only when there are no results at all: the student's own edition. */
  fallbackYear: number | null;
  results: StageResultRow[];
}) {
  // A student row is retagged into the next edition rather than duplicated, so
  // it can carry several years. The newest is the one they came to see.
  const latestYear = results.reduce<number | null>((newest, r) => {
    const year = r.edition_year == null ? null : Number(r.edition_year);
    return year != null && (newest == null || year > newest) ? year : newest;
  }, null);
  const shownYear = latestYear ?? fallbackYear;
  const shown = latestYear == null
    ? results
    : results.filter((r) => Number(r.edition_year) === latestYear);

  const currentYear = editions[0]?.year ?? null;
  const isPast = shownYear != null && currentYear != null && shownYear !== currentYear;

  if (shown.length === 0) {
    return (
      <EmptyState title="No competition result yet">
        <span className="text-sm text-muted-foreground">
          {isPast
            ? `Nothing was recorded for you in the ${shownYear} edition.`
            : "Your score appears here once your school has sat the qualifying paper and the results are published."}
        </span>
      </EmptyState>
    );
  }

  const stages = editions.find((e) => e.year === shownYear)?.stages ?? [];
  const order = new Map(stages.map((s, i) => [s, i]));
  const ordered = [...shown].sort(
    (a, b) =>
      (order.get(a.stage) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.stage) ?? Number.MAX_SAFE_INTEGER),
  );

  return (
    <Card className="p-5 md:p-6 space-y-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {shownYear ? `${shownYear} edition` : "Competition"}
      </p>

      {ordered.map((result) => {
        const style = OUTCOME_STYLE[result.outcome];
        const breakdown = result.breakdown ?? null;
        const hasBreakdown = breakdown && Object.keys(breakdown).length > 0;

        return (
          <div
            key={`${result.stage}-${result.edition_year ?? ""}`}
            className="space-y-3 border-t border-foreground/5 pt-4 first-of-type:border-t-0 first-of-type:pt-0"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                {result.stage}
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${style.badge}`}
              >
                {style.label}
              </span>
              {result.score != null ? (
                <span className="font-bebas text-2xl leading-none text-foreground">
                  {result.score}
                  {result.score_max != null ? (
                    <span className="text-muted-foreground">/{result.score_max}</span>
                  ) : null}
                </span>
              ) : null}
            </div>

            {hasBreakdown ? (
              <PaperScoreBreakdown breakdown={breakdown} order={result.subjectOrder} />
            ) : null}

            {result.note ? (
              <p className="text-sm text-muted-foreground">{result.note}</p>
            ) : null}

            {result.detailHref ? (
              <Link
                href={result.detailHref}
                className="inline-flex items-center rounded-md border border-foreground/15 px-3 py-2 text-sm text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                See the full paper →
              </Link>
            ) : null}
          </div>
        );
      })}
    </Card>
  );
}

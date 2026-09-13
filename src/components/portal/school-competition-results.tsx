import Link from "next/link";
import { Card, EmptyState } from "@/components/portal/ui";
import { percent } from "@/lib/paper-exam";
import type { StageOutcome } from "@/supabase/types";

// A school's competition record, as returned by get_my_school_results().
export interface SchoolCompetitionRow {
  registration_id: string;
  edition_year: number;
  school_name: string | null;
  centre: string | null;
  results: {
    stage: string;
    outcome: StageOutcome;
    score: number | null;
    score_max: number | null;
    lga_rank: number | null;
    state_rank: number | null;
    reason: string | null;
    note: string | null;
  }[];
}

const OUTCOME_STYLE: Record<StageOutcome, { badge: string; label: string }> = {
  advanced: { badge: "bg-green-100 text-green-800 border-green-600/30", label: "Advanced" },
  eliminated: { badge: "bg-red-100 text-red-800 border-red-600/30", label: "Not advanced" },
  pending: { badge: "bg-primary/15 text-gold-ink border-primary/30", label: "Pending" },
};

export function SchoolCompetitionResults({
  rows,
  stageOrder,
  detailBase,
}: {
  rows: SchoolCompetitionRow[];
  /** The edition's ladder, so stages read in the order they were contested. */
  stageOrder?: string[];
  /** Where a stage's breakdown lives for this reader — each role keeps its own
   *  sidebar, so the detail page sits under their own section. */
  detailBase: string;
}) {
  const withResults = rows.filter((r) => r.results.length > 0);
  if (withResults.length === 0) {
    return (
      <EmptyState title="No competition results yet">
        <span className="text-sm text-muted-foreground">
          A school&apos;s score, rank and outcome appear here once the stage has been decided.
        </span>
      </EmptyState>
    );
  }

  const rank = new Map((stageOrder ?? []).map((s, i) => [s, i]));
  const ordered = [...withResults].sort((a, b) => b.edition_year - a.edition_year);

  return (
    <div className="space-y-4">
      {ordered.map((reg) => {
        const stages = [...reg.results].sort(
          (a, b) =>
            (rank.get(a.stage) ?? Number.MAX_SAFE_INTEGER) -
            (rank.get(b.stage) ?? Number.MAX_SAFE_INTEGER),
        );
        return (
          <Card key={reg.registration_id} className="p-5 md:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-bebas text-2xl text-foreground">{reg.edition_year}</span>
              <span className="text-sm text-muted-foreground">
                {reg.school_name}
                {reg.centre ? ` · ${reg.centre}` : ""}
              </span>
            </div>

            <ul className="mt-3 divide-y divide-foreground/5 border-t border-foreground/5">
              {stages.map((s) => {
                const style = OUTCOME_STYLE[s.outcome];
                return (
                  <li
                    key={s.stage}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                  >
                    <span className="min-w-40 flex-1 text-sm font-medium text-foreground">
                      {s.stage}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${style.badge}`}
                    >
                      {style.label}
                    </span>
                    {s.score != null ? (
                      <span className="text-sm tabular-nums text-foreground">
                        {s.score}
                        {s.score_max != null ? (
                          <span className="text-muted-foreground">/{s.score_max}</span>
                        ) : null}
                        {s.score_max ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {percent(Number(s.score), Number(s.score_max))}%
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    {s.lga_rank != null ? (
                      <span className="text-xs text-muted-foreground">
                        LGA rank <span className="tabular-nums text-foreground">{s.lga_rank}</span>
                      </span>
                    ) : null}
                    {s.state_rank != null ? (
                      <span className="text-xs text-muted-foreground">
                        State rank{" "}
                        <span className="tabular-nums text-foreground">{s.state_rank}</span>
                      </span>
                    ) : null}
                    {s.reason ? (
                      <span className="text-xs text-muted-foreground">{s.reason}</span>
                    ) : null}
                    <Link
                      href={`${detailBase}/${reg.registration_id}?stage=${encodeURIComponent(s.stage)}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View details →
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

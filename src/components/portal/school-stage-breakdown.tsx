import Link from "next/link";
import { Card, SectionHeading } from "@/components/portal/ui";
import { PaperScoreBreakdown } from "@/components/portal/paper-score-breakdown";
import { percent } from "@/lib/paper-exam";
import type { StageOutcome, SubjectBreakdown } from "@/supabase/types";

// One school, one stage, broken down into the reps who produced the number.
// Rendered inside each role's own section so it keeps that role's sidebar; the
// access rule and how much of the team is returned both live in
// get_school_stage_breakdown.

export interface StageBreakdownRep {
  student_id: string;
  name: string;
  level: string | null;
  exam_no: string | null;
  outcome: StageOutcome | null;
  score: number | null;
  score_max: number | null;
  breakdown: SubjectBreakdown | null;
  paper_id: string | null;
}

export interface StageBreakdown {
  registration_id: string;
  school_name: string | null;
  edition_year: number;
  centre: string | null;
  stage: string;
  /** "school" for a coordinator — the whole team; "self" for a rep. */
  scope: "school" | "self";
  result: {
    stage: string;
    outcome: StageOutcome;
    score: number | null;
    score_max: number | null;
    lga_rank: number | null;
    state_rank: number | null;
    reason: string | null;
    note: string | null;
  } | null;
  subjects: string[] | null;
  reps: StageBreakdownRep[];
}

const OUTCOME_LABEL: Record<StageOutcome, string> = {
  advanced: "Advanced",
  eliminated: "Not advanced",
  pending: "Pending",
};

export function SchoolStageBreakdown({
  detail,
  backHref,
  paperBase,
}: {
  detail: StageBreakdown;
  backHref: string;
  /** Where a paper is read for this reader — see PAPER_BASE. */
  paperBase: string;
}) {
  const result = detail.result;
  const isSelf = detail.scope === "self";
  const scored = detail.reps.filter((r) => r.score != null);
  const repTotal = scored.reduce((sum, r) => sum + Number(r.score), 0);
  const repOutOf = scored.reduce((sum, r) => sum + Number(r.score_max ?? 0), 0);

  return (
    <>
      <Link href={backHref} className="text-xs text-primary hover:underline">
        ← Back to results
      </Link>

      <Card className="p-5 md:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {detail.edition_year} · {detail.stage}
          {detail.centre ? ` · ${detail.centre}` : ""}
        </p>
        <p className="font-bebas text-3xl leading-tight text-foreground">
          {detail.school_name}
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3 border-t border-foreground/5 pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Team score
            </p>
            <p className="font-bebas text-5xl leading-none text-foreground">
              {result?.score ?? "—"}
              {result?.score_max != null ? (
                <span className="text-muted-foreground">/{result.score_max}</span>
              ) : null}
            </p>
            {result?.score != null && result.score_max ? (
              <p className="text-sm text-muted-foreground">
                {percent(Number(result.score), Number(result.score_max))}%
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Outcome
            </p>
            <p className="text-lg text-foreground">
              {result ? OUTCOME_LABEL[result.outcome] : "Not marked"}
            </p>
            {result?.reason ? (
              <p className="text-sm text-muted-foreground">{result.reason}</p>
            ) : null}
          </div>
          {result?.lga_rank != null ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                LGA rank
              </p>
              <p className="text-lg tabular-nums text-foreground">{result.lga_rank}</p>
            </div>
          ) : null}
          {result?.state_rank != null ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                State rank
              </p>
              <p className="text-lg tabular-nums text-foreground">{result.state_rank}</p>
            </div>
          ) : null}
        </div>

        {result?.note ? (
          <p className="mt-3 border-t border-foreground/5 pt-3 text-sm text-muted-foreground">
            {result.note}
          </p>
        ) : null}
      </Card>

      <div>
        <SectionHeading>{isSelf ? "Your paper" : "The reps behind it"}</SectionHeading>
        {detail.reps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isSelf
              ? `You were not a representative in ${detail.edition_year}.`
              : "No reps on the roster for this edition."}
          </p>
        ) : (
          <Card className="divide-y divide-foreground/5">
            {detail.reps.map((rep) => (
              <div key={rep.student_id} className="p-4 space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-medium text-foreground">{rep.name}</span>
                  {rep.level ? (
                    <span className="text-xs text-muted-foreground">{rep.level}</span>
                  ) : null}
                  {rep.exam_no ? (
                    <span className="text-xs text-muted-foreground">
                      Candidate <span className="tabular-nums text-foreground">{rep.exam_no}</span>
                    </span>
                  ) : null}
                  <span className="flex-1" />
                  {rep.score != null ? (
                    <span className="font-bebas text-2xl leading-none text-foreground">
                      {rep.score}
                      {rep.score_max != null ? (
                        <span className="text-muted-foreground">/{rep.score_max}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not scored</span>
                  )}
                </div>

                {rep.breakdown && Object.keys(rep.breakdown).length > 0 ? (
                  <PaperScoreBreakdown breakdown={rep.breakdown} order={detail.subjects} />
                ) : null}

                {rep.paper_id ? (
                  <Link
                    href={`${paperBase}/${rep.paper_id}`}
                    className="inline-block text-xs text-primary hover:underline"
                  >
                    See the full paper →
                  </Link>
                ) : null}
              </div>
            ))}
          </Card>
        )}

        {isSelf ? (
          <p className="mt-3 text-xs text-muted-foreground">
            The team score above is the whole school&apos;s. You can see your own paper here — your
            coordinator sees every rep&apos;s.
          </p>
        ) : scored.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            The reps scored {repTotal}
            {repOutOf ? `/${repOutOf}` : ""} between them.
            {result?.score != null && repTotal !== Number(result.score)
              ? ` The school was marked with ${result.score} — a stage can also be decided by a face-off or a manual selection, so the two need not agree.`
              : ""}
          </p>
        ) : null}
      </div>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, SectionHeading } from "@/components/portal/ui";
import {
  SchoolStageBreakdown,
  type StageBreakdown,
} from "@/components/portal/school-stage-breakdown";
import {
  SchoolCompetitionResults,
  type SchoolCompetitionRow,
} from "@/components/portal/school-competition-results";
import { type StageResultRow } from "@/components/portal/stage-results";
import { PAPER_BASE } from "@/lib/paper-results";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import type { Edition } from "@/supabase/types";

export const metadata = pageMetadata("Results", "Your results.");
export const dynamic = "force-dynamic";

export default async function StudentResults() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const [
    { data: studentRecord },
    { data: attemptData },
    { data: editionData },
    { data: schoolResultData },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id, edition_year, schools(name)")
      .eq("auth_user_id", user.id)
      .maybeSingle(),
    supabase
      .from("assessment_attempts")
      .select("id, score, total, mode, created_at, assessments(title)")
      .eq("student_user_id", user.id)
      .eq("status", "submitted")
      .order("created_at", { ascending: false }),
    supabase
      .from("editions")
      .select("year, title, registration_open, stages, current_stage")
      .order("year", { ascending: false }),
    // The school's own competition record. An RPC because a code-login student
    // is not a school member, so the registration tables are closed to them.
    supabase.rpc("get_my_school_results"),
  ]);

  const student = studentRecord as unknown as { id: string; edition_year: number | null } | null;
  const editions = (editionData ?? []) as Edition[];
  const schoolResults = (schoolResultData ?? []) as unknown as SchoolCompetitionRow[];

  let stageResults: StageResultRow[] = [];
  if (student) {
    const { data: ssr, error } = await supabase
      .from("student_stage_results")
      .select("id, student_id, stage, edition_year, outcome, score, score_max, note, breakdown")
      .eq("student_id", student.id);
    if (error) throw new Error(`Could not read your results: ${error.message}`);
    stageResults = (ssr ?? []) as unknown as StageResultRow[];
  }

  // A student row is retagged into the next edition rather than duplicated, so
  // it can carry several years. The newest is the one they came to see, and it
  // opens here rather than behind a click.
  const latestYear = stageResults.reduce<number | null>((newest, r) => {
    const year = r.edition_year == null ? null : Number(r.edition_year);
    return year != null && (newest == null || year > newest) ? year : newest;
  }, null);
  const shownYear = latestYear ?? student?.edition_year ?? null;
  const registration = schoolResults.find((r) => r.edition_year === shownYear);

  const ladder = new Map((editions.find((e) => e.year === shownYear)?.stages ?? []).map((s, i) => [s, i]));
  const shownStages = stageResults
    .filter((r) => Number(r.edition_year) === shownYear)
    .map((r) => r.stage)
    .sort(
      (a, b) =>
        (ladder.get(a) ?? Number.MAX_SAFE_INTEGER) - (ladder.get(b) ?? Number.MAX_SAFE_INTEGER),
    );

  const breakdowns: StageBreakdown[] = [];
  if (registration) {
    const loaded = await Promise.all(
      shownStages.map((stage) =>
        supabase.rpc("get_school_stage_breakdown", {
          p_registration_id: registration.registration_id,
          p_stage: stage,
        }),
      ),
    );
    for (const { data, error } of loaded) {
      // A missing function is a deployment problem, not a missing result.
      if (error) throw new Error(`Could not read this result: ${error.message}`);
      if (data) breakdowns.push(data as unknown as StageBreakdown);
    }
  }

  // Whatever is not already open above: earlier editions, and any stage the
  // school was marked for that this student has no paper in.
  const open = new Set(breakdowns.map((b) => `${b.registration_id}|${b.stage}`));
  const history = schoolResults
    .map((reg) => ({
      ...reg,
      results: reg.results.filter((s) => !open.has(`${reg.registration_id}|${s.stage}`)),
    }))
    .filter((reg) => reg.results.length > 0);

  const attempts = (attemptData ?? []) as unknown as {
    id: string;
    score: number;
    total: number;
    mode: string;
    created_at: string;
    assessments: { title: string | null } | null;
  }[];

  return (
    <div className="space-y-8">
      {breakdowns.length > 0 ? (
        breakdowns.map((detail) => (
          <div key={`${detail.registration_id}-${detail.stage}`} className="space-y-4">
            <SchoolStageBreakdown detail={detail} paperBase={PAPER_BASE.student} />
          </div>
        ))
      ) : (
        <EmptyState title="No competition result yet">
          <span className="text-sm text-muted-foreground">
            Your score appears here once your school has sat the qualifying paper and the results
            are published.
          </span>
        </EmptyState>
      )}

      {history.length > 0 ? (
        <div>
          <SectionHeading>Earlier results</SectionHeading>
          <SchoolCompetitionResults
            rows={history}
            stageOrder={editions.find((e) => e.year === shownYear)?.stages ?? []}
            detailBase="/portal/student/results"
          />
        </div>
      ) : null}

      <div>
        <SectionHeading>Your practice &amp; exam scores</SectionHeading>
        {attempts.length === 0 ? (
          <EmptyState title="No scores yet — take a practice drill and they'll show up here.">
            <a
              href="/portal/student/practice"
              className="text-xs uppercase tracking-[0.2em] text-primary hover:underline"
            >
              Start a practice drill →
            </a>
          </EmptyState>
        ) : (
          <Card className="divide-y divide-foreground/5">
            {attempts.map((a) => {
              const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
              return (
                <Link
                  key={a.id}
                  href={`/portal/results/${a.id}`}
                  className="flex items-center justify-between gap-3 p-3 hover:bg-primary/5 transition-colors"
                >
                  <span className="text-foreground min-w-0 truncate">
                    {a.assessments?.title ?? "Assessment"}
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">{a.mode}</span>
                  </span>
                  <span className="font-bebas text-lg text-foreground shrink-0">
                    {a.score}/{a.total} · {pct}% <span className="text-muted-foreground">→</span>
                  </span>
                </Link>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

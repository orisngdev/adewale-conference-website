import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, SectionHeading } from "@/components/portal/ui";
import { StudentCompetitionResults } from "@/components/portal/student-competition-results";
import {
  SchoolCompetitionResults,
  type SchoolCompetitionRow,
} from "@/components/portal/school-competition-results";
import { type StageResultRow } from "@/components/portal/stage-results";
import { PAPER_BASE, paperLinksForStudents, withPaperLinks } from "@/lib/paper-results";
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

  // The competition record: the qualifying paper's score, its subject breakdown
  // and the link to the item-by-item review.
  const student = studentRecord as unknown as { id: string; edition_year: number | null } | null;
  const editions = (editionData ?? []) as Edition[];
  const studentEdition = editions.find((e) => e.year === student?.edition_year) ?? editions[0];
  let stageResults: StageResultRow[] = [];
  if (student) {
    const [{ data: ssr }, links] = await Promise.all([
      supabase
        .from("student_stage_results")
        .select("id, student_id, stage, edition_year, outcome, score, score_max, note, breakdown")
        .eq("student_id", student.id),
      paperLinksForStudents(supabase, [student.id], PAPER_BASE.student),
    ]);
    stageResults = withPaperLinks(
      (ssr ?? []) as unknown as StageResultRow[],
      links.get(student.id),
    );
  }
  const schoolResults = (schoolResultData ?? []) as unknown as SchoolCompetitionRow[];

  const attempts = (attemptData ?? []) as unknown as {
    id: string;
    score: number;
    total: number;
    mode: string;
    created_at: string;
    assessments: { title: string | null } | null;
  }[];

  return (
    <div className="space-y-6">
      {student ? (
        <div>
          <SectionHeading>Your competition result</SectionHeading>
          <StudentCompetitionResults
            editions={editions}
            fallbackYear={student.edition_year}
            results={stageResults}
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

      <div>
        <SectionHeading>How your school did</SectionHeading>
        <SchoolCompetitionResults
          rows={schoolResults}
          stageOrder={studentEdition?.stages ?? []}
          detailBase="/portal/student/results"
        />
      </div>
    </div>
  );
}

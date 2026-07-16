import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, SectionHeading } from "@/components/portal/ui";
import { PortalResults } from "@/components/portal/portal-results";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { sanityFetch } from "@/sanity/lib/live";
import { resultsBySchoolsQuery } from "@/sanity/lib/queries";
import type { ResultRow } from "@/sanity/types";

export const metadata = pageMetadata("Results", "Your school's results and quiz scores.");
export const dynamic = "force-dynamic";

export default async function SchoolResults() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  // Independent Supabase reads run together; the Sanity results query below needs
  // the derived school names, so it stays sequential after them.
  const [{ data: regData }, { data: studentData }, { data: attemptData }] = await Promise.all([
    supabase.from("registrations").select("schools(name)"),
    supabase
      .from("students")
      .select("name, auth_user_id")
      .is("deactivated_at", null),
    supabase
      .from("assessment_attempts")
      .select("id, student_user_id, score, total, violations, mode, assessments(title)")
      .eq("status", "submitted")
      .order("created_at", { ascending: false }),
  ]);
  const schoolNames = [
    ...new Set(
      (
        (regData ?? []) as unknown as { schools: { name: string | null } | null }[]
      )
        .map((r) => r.schools?.name)
        .filter(Boolean) as string[],
    ),
  ];

  const { data: resultData } = schoolNames.length
    ? await sanityFetch({
        query: resultsBySchoolsQuery,
        params: { schools: schoolNames },
      })
    : { data: [] };
  const results = (resultData ?? []) as ResultRow[];

  const students = (studentData ?? []) as {
    name: string;
    auth_user_id: string | null;
  }[];
  const attempts = (attemptData ?? []) as unknown as {
    id: string;
    student_user_id: string;
    score: number;
    total: number;
    violations: number;
    mode: string;
    assessments: { title: string | null } | null;
  }[];

  const studentsWithAttempts = students
    .map((s) => {
      // Best attempt per assessment, keeping the id so it links to the review.
      const best = new Map<
        string,
        { id: string; title: string; score: number; total: number; violations: number; mode: string }
      >();
      for (const a of attempts) {
        if (a.student_user_id !== s.auth_user_id) continue;
        const title = a.assessments?.title ?? "Assessment";
        const cur = best.get(title);
        if (!cur || a.score > cur.score)
          best.set(title, {
            id: a.id,
            title,
            score: a.score,
            total: a.total,
            violations: a.violations ?? 0,
            mode: a.mode,
          });
      }
      return { name: s.name, best: [...best.values()] };
    })
    .filter((s) => s.best.length > 0);

  return (
    <>
      <div>
        <SectionHeading>School results</SectionHeading>
        <PortalResults results={results} />
      </div>

      <div>
        <SectionHeading>Assessment scores</SectionHeading>
        {studentsWithAttempts.length === 0 ? (
          <p className="serif-display italic text-muted-foreground">
            Your students&apos; scores will appear here once they take a practice drill or exam.
          </p>
        ) : (
          <Card className="divide-y divide-foreground/5">
            {studentsWithAttempts.map((s) => (
              <div key={s.name} className="p-4">
                <p className="font-medium text-foreground">{s.name}</p>
                <ul className="text-sm text-muted-foreground mt-1 space-y-0.5">
                  {s.best.map((b) => (
                    <li key={b.id}>
                      <Link href={`/portal/results/${b.id}`} className="hover:underline">
                        {b.title} —{" "}
                        <span className="text-foreground font-medium">
                          {b.score}/{b.total}
                        </span>
                        <span className="ml-1 text-[10px] uppercase tracking-wide text-primary">{b.mode}</span>
                        <span className="text-muted-foreground"> →</span>
                      </Link>
                      {b.violations > 0 ? (
                        <span className="ml-2 text-red-600">
                          ⚠ {b.violations} tab-switch
                          {b.violations === 1 ? "" : "es"}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}

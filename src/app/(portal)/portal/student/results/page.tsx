import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, SectionHeading } from "@/components/portal/ui";
import { PortalResults } from "@/components/portal/portal-results";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { sanityFetch } from "@/sanity/lib/live";
import { resultsBySchoolsQuery } from "@/sanity/lib/queries";
import type { ResultRow } from "@/sanity/types";

export const metadata = pageMetadata("Results", "Your results.");
export const dynamic = "force-dynamic";

export default async function StudentResults() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  // Independent — fetch concurrently. Only the Sanity results query below depends
  // on the derived school names, so it stays sequential after these.
  const [{ data: profile }, { data: studentRecord }, { data: regData }, { data: attemptData }] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase.from("students").select("schools(name)").eq("auth_user_id", user.id).maybeSingle(),
      supabase.from("registrations").select("schools(name)").eq("owner_id", user.id),
      supabase
        .from("assessment_attempts")
        .select("id, score, total, mode, created_at, assessments(title)")
        .eq("student_user_id", user.id)
        .eq("status", "submitted")
        .order("created_at", { ascending: false }),
    ]);
  const studentSchool = (
    studentRecord?.schools as unknown as { name: string | null } | null
  )?.name;
  const schoolNames = [
    ...new Set(
      [
        ...((regData ?? []) as unknown as {
          schools: { name: string | null } | null;
        }[]).map((r) => r.schools?.name),
        studentSchool,
      ].filter(Boolean) as string[],
    ),
  ];

  const { data: resultData } = schoolNames.length
    ? await sanityFetch({
        query: resultsBySchoolsQuery,
        params: { schools: schoolNames },
      })
    : { data: [] };
  const results = (resultData ?? []) as ResultRow[];

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
        <SectionHeading>Conference results</SectionHeading>
        <PortalResults results={results} highlightName={profile?.full_name} />
      </div>
    </div>
  );
}

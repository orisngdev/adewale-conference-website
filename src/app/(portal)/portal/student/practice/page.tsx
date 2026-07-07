import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, SectionHeading } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { SUBJECTS } from "@/lib/assessments";

export const metadata = pageMetadata("Practice", "Offline speed-drill practice.");
export const dynamic = "force-dynamic";

export default async function StudentPractice() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const [{ data: drillData }, { data: attemptData }] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, title, subject, level")
      .eq("published", true)
      .eq("mode", "practice")
      .order("subject", { ascending: true }),
    supabase.from("assessment_attempts").select("assessment_id, score, total").eq("mode", "practice"),
  ]);
  const drills = (drillData ?? []) as {
    id: string;
    title: string;
    subject: string | null;
    level: string | null;
  }[];
  const best = new Map<string, { score: number; total: number }>();
  for (const a of (attemptData ?? []) as { assessment_id: string; score: number; total: number }[]) {
    const cur = best.get(a.assessment_id);
    if (!cur || a.score > cur.score) best.set(a.assessment_id, { score: a.score, total: a.total });
  }

  const bySubject = (subject: string) => drills.filter((d) => d.subject === subject);
  const other = drills.filter((d) => !d.subject || !SUBJECTS.includes(d.subject as (typeof SUBJECTS)[number]));

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>Practice drills</SectionHeading>
        <p className="serif-display italic text-muted-foreground">
          Rehearse the real CBT — same format, instant marking, works offline. Practice never affects selection.
        </p>
      </div>

      {drills.length === 0 ? (
        <EmptyState title="No drills published yet — check back soon." />
      ) : (
        SUBJECTS.map((subject) => {
          const items = bySubject(subject);
          if (items.length === 0) return null;
          return (
            <div key={subject}>
              <h3 className="font-bebas text-xl text-foreground mb-2">{subject}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((d) => (
                  <DrillCard key={d.id} drill={d} best={best.get(d.id)} />
                ))}
              </div>
            </div>
          );
        })
      )}
      {other.length > 0 ? (
        <div>
          <h3 className="font-bebas text-xl text-foreground mb-2">More</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {other.map((d) => (
              <DrillCard key={d.id} drill={d} best={best.get(d.id)} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DrillCard({
  drill,
  best,
}: {
  drill: { id: string; title: string; subject: string | null; level: string | null };
  best?: { score: number; total: number };
}) {
  return (
    <Link href={`/portal/student/practice/${drill.id}`} className="block group">
      <Card interactive className="p-5 h-full">
        <h4 className="font-bebas text-lg text-foreground">{drill.title}</h4>
        <p className="text-sm text-muted-foreground mt-1">{drill.level || "All levels"}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-primary">
          {best ? `Best ${best.score}/${best.total} · Drill again →` : "Start drill →"}
        </p>
      </Card>
    </Link>
  );
}

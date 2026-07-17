import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, SectionHeading } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { labState, passedAssessmentIds, type LabStepKind } from "@/lib/labs";

export const metadata = pageMetadata("Labs", "Guided, hands-on learning paths.");
export const dynamic = "force-dynamic";

type LabRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  track: string | null;
  lab_steps: { key: string; kind: LabStepKind; assessment_id: string | null }[];
};

const STATE_CHIP: Record<string, string> = {
  not_started: "bg-foreground/5 text-muted-foreground",
  in_progress: "bg-primary/[0.14] text-gold-ink",
  complete: "bg-green-50 text-green-700",
};
const STATE_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};

export default async function StudentLabs() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  const supabase = await createClient();

  const [{ data: labData }, { data: progressData }, { data: attemptData }] = await Promise.all([
    supabase
      .from("labs")
      .select("id, slug, title, summary, track, lab_steps(key, kind, assessment_id)")
      .eq("published", true)
      .order("sort")
      .order("created_at"),
    supabase.from("lab_progress").select("lab_id, step_key").eq("student_user_id", user.id),
    supabase
      .from("assessment_attempts")
      .select("assessment_id, score, total")
      .eq("student_user_id", user.id)
      .eq("status", "submitted"),
  ]);

  const labs = (labData ?? []) as unknown as LabRow[];
  const progress = (progressData ?? []) as { lab_id: string; step_key: string }[];
  const passed = passedAssessmentIds((attemptData ?? []) as never);

  // Per-lab set of completed step keys (ticks ∪ passed-quiz auto-ticks).
  const doneByLab = new Map<string, Set<string>>();
  for (const p of progress) {
    if (!doneByLab.has(p.lab_id)) doneByLab.set(p.lab_id, new Set());
    doneByLab.get(p.lab_id)!.add(p.step_key);
  }
  for (const lab of labs) {
    const set = doneByLab.get(lab.id) ?? new Set<string>();
    for (const s of lab.lab_steps) {
      if (s.kind === "quiz" && s.assessment_id && passed.has(s.assessment_id)) set.add(s.key);
    }
    doneByLab.set(lab.id, set);
  }

  return (
    <div className="space-y-8">
      <div>
        <SectionHeading>Labs</SectionHeading>
        <p className="serif-display italic text-muted-foreground">
          Guided, hands-on paths — work through the lessons, tick them off, and earn your certificate.
        </p>
      </div>

      {labs.length === 0 ? (
        <EmptyState title="No labs are open yet — check back soon." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {labs.map((lab) => {
            const total = lab.lab_steps.length;
            const done = lab.lab_steps.filter((s) => doneByLab.get(lab.id)!.has(s.key)).length;
            const state = labState(done, total);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const cta = state === "not_started" ? "Start" : state === "complete" ? "Review" : "Continue";
            return (
              <Link key={lab.id} href={`/portal/student/labs/${lab.slug}`} className="block group">
                <Card interactive className="p-5 h-full flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    {lab.track ? (
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                        {lab.track}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span
                      className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATE_CHIP[state]}`}
                    >
                      {STATE_LABEL[state]}
                    </span>
                  </div>
                  <h3 className="font-bebas text-2xl text-foreground leading-tight mt-1">{lab.title}</h3>
                  {lab.summary ? (
                    <p className="text-sm text-muted-foreground mt-1 flex-1">{lab.summary}</p>
                  ) : (
                    <div className="flex-1" />
                  )}
                  <div className="mt-4">
                    <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {done} / {total} lesson{total === 1 ? "" : "s"}
                      </span>
                      <span className="text-xs uppercase tracking-[0.2em] text-primary font-bold">
                        {cta} →
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Data Challenge Arena — deliberately set apart from the guided labs. */}
      <Link href="/portal/student/challenges" className="block group">
        <div className="bg-[#10182E] border border-primary/70 p-6 md:p-7 flex items-center justify-between gap-4 transition-shadow hover:shadow-[0_14px_40px_-16px_rgba(232,160,32,0.5)]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
              Data Challenge Arena
            </p>
            <p className="font-bebas text-2xl md:text-3xl text-white leading-tight mt-1">
              Compete on real datasets
            </p>
            <p className="text-sm text-white/70 mt-1 max-w-xl">
              Like Zindi &amp; Kaggle — download the data, make your predictions, and climb a live
              leaderboard.
            </p>
          </div>
          <span className="shrink-0 text-primary font-bold uppercase tracking-[0.2em] text-sm">
            Enter →
          </span>
        </div>
      </Link>
    </div>
  );
}

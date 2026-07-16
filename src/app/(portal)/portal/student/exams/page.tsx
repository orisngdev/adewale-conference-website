import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, SectionHeading } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { examGate } from "@/lib/assessment-session";

export const metadata = pageMetadata("Exams", "Take graded exams and see your scores.");
export const dynamic = "force-dynamic";

export default async function StudentExams() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const [{ data: examData }, { data: attemptData }, { data: schoolData }] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, title, subject, level")
      .eq("published", true)
      .eq("mode", "exam")
      .order("created_at", { ascending: false }),
    supabase.from("assessment_attempts").select("assessment_id, score, total").eq("mode", "exam"),
    supabase.rpc("get_my_school"),
  ]);

  // Competition gate (UI half — start_exam_attempt enforces the same rule
  // server-side): graded exams open once the school's entry is accepted.
  const entryStatus =
    ((schoolData as { registration?: { status?: string } | null } | null)?.registration
      ?.status as string | undefined) ?? null;
  const gate = examGate(entryStatus);
  if (!gate.open) {
    const underReview = gate.reason === "under_review";
    return (
      <div>
        <SectionHeading>Exams</SectionHeading>
        <Card className="p-6 border-l-4 border-l-primary">
          <p className="font-bebas text-2xl text-foreground leading-tight">
            {underReview
              ? "Your school's entry is under review"
              : "Exams are closed for your school this edition"}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {underReview
              ? "Graded exams unlock once your school is confirmed for the competition — you'll be notified. Until then, every practice drill is open."
              : "Your school wasn't selected this edition, but the whole prep portal stays open — practice drills, Tech Lab, and study packs."}
          </p>
          <Link
            href="/portal/student/practice"
            className="inline-block mt-4 text-xs uppercase tracking-[0.2em] text-primary hover:underline"
          >
            Go to practice drills →
          </Link>
        </Card>
      </div>
    );
  }
  const exams = (examData ?? []) as {
    id: string;
    title: string;
    subject: string | null;
    level: string | null;
  }[];

  const best = new Map<string, { score: number; total: number }>();
  for (const a of (attemptData ?? []) as {
    assessment_id: string;
    score: number;
    total: number;
  }[]) {
    const cur = best.get(a.assessment_id);
    if (!cur || a.score > cur.score) best.set(a.assessment_id, { score: a.score, total: a.total });
  }

  return (
    <div>
      <SectionHeading>Exams</SectionHeading>
      {exams.length === 0 ? (
        <EmptyState title="No exams are available yet — check back soon.">
          <Link
            href="/portal/student/practice"
            className="text-xs uppercase tracking-[0.2em] text-primary hover:underline"
          >
            Warm up with practice drills →
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {exams.map((e) => {
            const b = best.get(e.id);
            return (
              <Link key={e.id} href={`/portal/cbt/${e.id}`} className="block group">
                <Card interactive className="p-5 h-full">
                  <h4 className="font-bebas text-xl text-foreground">{e.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {[e.subject, e.level].filter(Boolean).join(" · ") || "Exam"}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-primary">
                    {b ? `Best ${b.score}/${b.total} · Retake →` : "Start exam →"}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

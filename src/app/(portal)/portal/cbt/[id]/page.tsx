import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalBody, PortalHeader } from "@/components/portal/ui";
import ExamRunner from "@/components/portal/exam-runner";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const dynamic = "force-dynamic";

interface AssessmentData {
  id: string;
  title: string;
  mode: "practice" | "exam";
  subject: string | null;
  level: string | null;
  max_attempts: number;
  time_limit_minutes: number | null;
  questions: { id: string; prompt: string; options: string[] }[];
}

export default async function ExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const { id } = await params;

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const { data } = await supabase.rpc("get_assessment", { p_id: id });
  const a = data as AssessmentData | null;
  if (!a || a.questions.length === 0) notFound();
  // Practice runs client-side with answers — send those to the practice route.
  if (a.mode === "practice") redirect(`/portal/student/practice/${id}`);

  return (
    <>
      <PortalHeader
        title={a.title}
        subtitle={[a.subject, a.level].filter(Boolean).join(" · ") || "Answer every question, then submit"}
      />
      <PortalBody>
        <Link
          href="/portal/student/exams"
          className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline"
        >
          ← Back to exams
        </Link>
        <ExamRunner
          assessmentId={a.id}
          questions={a.questions}
          maxAttempts={a.max_attempts}
          timeLimitMinutes={a.time_limit_minutes}
        />
      </PortalBody>
    </>
  );
}

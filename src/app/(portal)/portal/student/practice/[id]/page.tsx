import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PracticeRunner, { type PracticeQuestion } from "@/components/portal/practice-runner";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const dynamic = "force-dynamic";

interface PracticeBank {
  id: string;
  title: string;
  subject: string | null;
  level: string | null;
  time_limit_minutes: number | null;
  content_version: number;
  questions: PracticeQuestion[];
}

export default async function PracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const { id } = await params;

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  // Practice bank ships correct answers (safe, ungraded). Cached client-side for offline replay.
  const { data } = await supabase.rpc("get_practice_bank", { p_id: id });
  const bank = data as PracticeBank | null;
  if (!bank || bank.questions.length === 0) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/portal/student/practice"
        className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline"
      >
        ← Back to practice
      </Link>
      <div>
        <h2 className="font-bebas text-2xl md:text-3xl text-foreground">{bank.title}</h2>
        <p className="text-sm text-muted-foreground">
          {[bank.subject, bank.level].filter(Boolean).join(" · ") || "Practice drill"}
        </p>
      </div>
      <PracticeRunner
        assessmentId={bank.id}
        questions={bank.questions}
        timeLimitMinutes={bank.time_limit_minutes}
      />
    </div>
  );
}

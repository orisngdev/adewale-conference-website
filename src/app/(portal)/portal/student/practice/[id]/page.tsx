import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PracticeRunner from "@/components/portal/practice-runner";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { loadPracticeBank } from "@/lib/assessment-session";

export const dynamic = "force-dynamic";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const bank = await loadPracticeBank(id);
  if (!bank) notFound();

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
        proctor
      />
    </div>
  );
}

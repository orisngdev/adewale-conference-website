import { notFound, redirect } from "next/navigation";
import PracticeRunner from "@/components/portal/practice-runner";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { loadPracticeBank } from "@/lib/assessment-session";

export const dynamic = "force-dynamic";

// Smart-TV / classroom display: a practice drill at large scale, no proctoring.
export default async function DisplayPage({
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10 text-lg sm:text-2xl leading-relaxed">
        <h1 className="font-bebas text-4xl sm:text-7xl mb-6">{bank.title}</h1>
        <PracticeRunner
          assessmentId={bank.id}
          questions={bank.questions}
          timeLimitMinutes={bank.time_limit_minutes}
        />
      </div>
    </div>
  );
}

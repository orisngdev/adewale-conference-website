import { notFound, redirect } from "next/navigation";
import PracticeRunner, { type PracticeQuestion } from "@/components/portal/practice-runner";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const dynamic = "force-dynamic";

interface Bank {
  id: string;
  title: string;
  time_limit_minutes: number | null;
  questions: PracticeQuestion[];
}

// Smart-TV / classroom display: a practice drill at large scale, no proctoring.
export default async function DisplayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const { data } = await supabase.rpc("get_practice_bank", { p_id: id });
  const bank = data as Bank | null;
  if (!bank || bank.questions.length === 0) notFound();

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

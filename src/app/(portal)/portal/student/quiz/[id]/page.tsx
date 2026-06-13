import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalBody, PortalHeader } from "@/components/portal/ui";
import QuizRunner from "@/components/portal/quiz-runner";
import { createClient } from "@/supabase/server";
import { isSupabaseConfigured } from "@/supabase/env";

export const dynamic = "force-dynamic";

interface QuizData {
  id: string;
  title: string;
  subject: string | null;
  level: string | null;
  max_attempts: number;
  time_limit_minutes: number | null;
  questions: { id: string; prompt: string; options: string[] }[];
}

export default async function StudentQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data } = await supabase.rpc("get_quiz", { p_quiz_id: id });
  const quiz = data as QuizData | null;
  if (!quiz || quiz.questions.length === 0) notFound();

  return (
    <>
      <PortalHeader
        title={quiz.title}
        subtitle={
          [quiz.subject, quiz.level].filter(Boolean).join(" · ") ||
          "Answer every question, then submit"
        }
      />
      <PortalBody>
        <Link
          href="/portal/student"
          className="inline-block text-xs uppercase tracking-[0.2em] text-[#E8A020] hover:underline"
        >
          ← Back to dashboard
        </Link>
        <QuizRunner
          quizId={quiz.id}
          questions={quiz.questions}
          maxAttempts={quiz.max_attempts}
          timeLimitMinutes={quiz.time_limit_minutes}
        />
      </PortalBody>
    </>
  );
}

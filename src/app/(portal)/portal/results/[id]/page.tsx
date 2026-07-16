import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, PortalBody, PortalHeader } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const metadata = pageMetadata("Result", "Attempt review.");
export const dynamic = "force-dynamic";

interface ReviewQuestion {
  prompt: string;
  options: string[];
  choice: number | null;
  is_correct: boolean;
  correct_index?: number; // practice only
  explanation?: string | null; // practice only
}

interface Review {
  id: string;
  title: string | null;
  subject: string | null;
  level: string | null;
  mode: "practice" | "exam";
  score: number;
  total: number;
  violations: number;
  submitted_at: string | null;
  student_name: string | null;
  questions: ReviewQuestion[];
}

export default async function AttemptReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const supabase = await createClient();
  // The RPC gates access (own attempt / admin / coordinator of the student's
  // school) and, for exams, never returns the correct answer.
  const { data } = await supabase.rpc("get_attempt_review", { p_attempt_id: id });
  const review = data as Review | null;
  if (!review) notFound();

  const pct = review.total ? Math.round((review.score / review.total) * 100) : 0;
  const isPractice = review.mode === "practice";

  return (
    <>
      <PortalHeader
        title={review.title ?? "Attempt"}
        subtitle={[review.subject, review.level, review.student_name].filter(Boolean).join(" · ") || undefined}
      />
      <PortalBody>
        <Card className="p-6 flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-primary">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{review.mode}</span>
            <p className="font-bebas text-5xl text-foreground leading-none">
              {review.score}/{review.total}
            </p>
            <p className="serif-display italic text-muted-foreground">{pct}%</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {review.submitted_at ? (
              <p>{new Date(review.submitted_at).toLocaleString()}</p>
            ) : null}
            {review.violations > 0 ? (
              <p className="text-red-600">⚠ Left the screen {review.violations}×</p>
            ) : null}
          </div>
        </Card>

        <div className="space-y-3">
          {review.questions.map((q, i) => {
            const chosen = q.choice;
            return (
              <Card key={i} className="p-4 space-y-2">
                <p className="font-medium text-foreground">
                  {q.is_correct ? "✅" : "❌"} {i + 1}. {q.prompt}
                </p>
                <ul className="text-sm space-y-1">
                  {q.options.map((opt, oi) => {
                    // Practice reveals the correct option; exams mark only the
                    // student's choice (the correct answer stays server-side).
                    const isCorrectOpt = isPractice && oi === q.correct_index;
                    const isChoice = oi === chosen;
                    const cls = isCorrectOpt
                      ? "text-green-700 font-medium"
                      : isChoice
                        ? q.is_correct
                          ? "text-green-700 font-medium"
                          : "text-red-600"
                        : "text-muted-foreground";
                    const marker = isCorrectOpt ? "✓ " : isChoice ? (q.is_correct ? "✓ " : "✗ ") : "• ";
                    return (
                      <li key={oi} className={cls}>
                        {marker}
                        {String.fromCharCode(65 + oi)}. {opt}
                        {isChoice ? <span className="ml-1 text-[10px] uppercase tracking-wide">(your answer)</span> : null}
                      </li>
                    );
                  })}
                  {chosen == null ? (
                    <li className="text-muted-foreground italic">No answer</li>
                  ) : null}
                </ul>
                {isPractice && q.explanation ? (
                  <p className="text-xs text-muted-foreground italic">Why: {q.explanation}</p>
                ) : null}
              </Card>
            );
          })}
        </div>

        {!isPractice ? (
          <p className="text-xs text-muted-foreground">
            Exam review shows which questions you got right, not the correct answers —
            those stay on the server.
          </p>
        ) : null}

        <Link href="/portal" className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline">
          ← Back to portal
        </Link>
      </PortalBody>
    </>
  );
}

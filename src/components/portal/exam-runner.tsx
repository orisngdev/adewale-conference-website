"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/portal/ui";
import { AssessmentNavigator, type NavQuestion } from "./assessment-navigator";

type Phase = "intro" | "running" | "done" | "noattempts" | "error";

// Exam adapter: server-authoritative attempt lifecycle + proctoring. Answers are
// never shipped here (get_assessment strips them); grading happens in the RPC.
export default function ExamRunner({
  assessmentId,
  questions,
  maxAttempts,
  timeLimitMinutes,
}: {
  assessmentId: string;
  questions: NavQuestion[];
  maxAttempts: number;
  timeLimitMinutes: number | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState<Phase>("intro");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  async function start() {
    const { data, error } = await supabase.rpc("start_exam_attempt", {
      p_assessment_id: assessmentId,
    });
    if (error) return setPhase("error");
    const d = data as {
      error?: string;
      attempt_id?: string;
      started_at?: string;
      time_limit_minutes?: number | null;
    };
    if (d.error === "no_attempts") return setPhase("noattempts");
    if (d.error || !d.attempt_id) return setPhase("error");
    setAttemptId(d.attempt_id);
    if (d.time_limit_minutes && d.started_at) {
      setDeadlineAt(new Date(d.started_at).getTime() + d.time_limit_minutes * 60_000);
    }
    setPhase("running");
  }

  const doSubmit = useCallback(
    async (answers: Record<string, number>, violations: number) => {
      if (!attemptId || submitting) return;
      setSubmitting(true);
      const { data, error } = await supabase.rpc("submit_exam_attempt", {
        p_attempt_id: attemptId,
        p_answers: answers,
        p_violations: violations,
      });
      if (error) {
        setSubmitting(false);
        return;
      }
      setResult(data as { score: number; total: number });
      setPhase("done");
    },
    [attemptId, submitting, supabase],
  );

  if (phase === "noattempts") {
    return (
      <ResultCard title="No attempts left" body="You've used all your attempts for this exam." />
    );
  }
  if (phase === "error") {
    return <ResultCard body="Couldn't start the exam. Please go back and try again." />;
  }
  if (phase === "done" && result) {
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    return (
      <Card className="p-8 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Exam complete</p>
        <p className="font-bebas text-6xl text-foreground mt-2 leading-none">
          {result.score}/{result.total}
        </p>
        <p className="serif-display italic text-muted-foreground mt-1">{pct}%</p>
        <div className="mt-6">
          <Button asChild><Link href="/portal/student/exams">Back to exams</Link></Button>
        </div>
      </Card>
    );
  }
  if (phase === "intro") {
    return (
      <Card className="p-6 md:p-8 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Before you begin</p>
        <ul className="space-y-2 text-foreground">
          <li>
            ⏱{" "}
            {timeLimitMinutes
              ? `Timed: ${timeLimitMinutes} minute${timeLimitMinutes === 1 ? "" : "s"} for the whole paper — it auto-submits at zero.`
              : "Untimed."}
          </li>
          <li>🔁 Attempts allowed: {maxAttempts}.</li>
          <li>🧭 Move with Prev/Next or the number grid; mark questions to revisit.</li>
          <li>🚫 Don&apos;t leave the screen — it&apos;s recorded, and auto-submits after 3 switches.</li>
        </ul>
        <Button onClick={start} size="lg">Start exam</Button>
      </Card>
    );
  }

  return (
    <AssessmentNavigator
      questions={questions}
      timeLimitMinutes={timeLimitMinutes}
      deadlineAt={deadlineAt}
      proctor
      submitting={submitting}
      onSubmit={doSubmit}
    />
  );
}

function ResultCard({ title, body }: { title?: string; body: string }) {
  return (
    <Card className="p-8 text-center">
      {title ? <p className="font-bebas text-3xl text-foreground">{title}</p> : null}
      <p className="serif-display italic text-muted-foreground mt-1">{body}</p>
      <div className="mt-6">
        <Button asChild><Link href="/portal/student">Back to dashboard</Link></Button>
      </div>
    </Card>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/portal/ui";
import { AssessmentNavigator } from "./assessment-navigator";
import { enqueuePractice, flushPractice } from "@/lib/offline/practice-queue";

export interface PracticeQuestion {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation?: string | null;
}

function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.round(performance.now())}`;
  }
}

// Practice adapter: marks locally against the shipped answers (works offline),
// then records the summary (buffered if offline). Ungraded — no proctoring.
export default function PracticeRunner({
  assessmentId,
  questions,
  timeLimitMinutes,
}: {
  assessmentId: string;
  questions: PracticeQuestion[];
  timeLimitMinutes: number | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState<"intro" | "running" | "done">("intro");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [offline, setOffline] = useState(false);

  const correctById = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.id, q.correct_index])),
    [questions],
  );
  const score = questions.reduce(
    (n, q) => n + (answers[q.id] === q.correct_index ? 1 : 0),
    0,
  );

  const doSubmit = useCallback(
    async (ans: Record<string, number>) => {
      setAnswers(ans);
      setPhase("done");
      const meta = { client_attempt_id: uuid(), submitted_offline: !navigator.onLine };
      const { error } = await supabase.rpc("submit_practice_attempt", {
        p_assessment_id: assessmentId,
        p_answers: ans,
        p_meta: meta,
      });
      if (error) {
        enqueuePractice({ assessmentId, answers: ans, meta });
        setOffline(true);
      } else {
        void flushPractice(supabase);
      }
    },
    [assessmentId, supabase],
  );

  if (phase === "intro") {
    return (
      <Card className="p-6 md:p-8 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Practice drill</p>
        <ul className="space-y-2 text-foreground">
          <li>
            ⏱{" "}
            {timeLimitMinutes
              ? `Timed like the real exam: ${timeLimitMinutes} minute${timeLimitMinutes === 1 ? "" : "s"}.`
              : "Untimed — go at your own pace."}
          </li>
          <li>📶 Works offline once loaded — you get your score and explanations instantly.</li>
          <li>🔁 Unlimited attempts. This is practice — it never affects selection.</li>
        </ul>
        <Button onClick={() => setPhase("running")} size="lg">Start drill</Button>
      </Card>
    );
  }

  if (phase === "done") {
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    return (
      <div className="space-y-5">
        <Card className="p-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Drill complete</p>
          <p className="font-bebas text-6xl text-foreground mt-2 leading-none">
            {score}/{questions.length}
          </p>
          <p className="serif-display italic text-muted-foreground mt-1">{pct}%</p>
          {offline ? (
            <p className="mt-2 text-xs text-muted-foreground">Saved offline — your score syncs when you reconnect.</p>
          ) : null}
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild variant="outline"><Link href="/portal/student/practice">More practice</Link></Button>
            <Button onClick={() => { setAnswers({}); setPhase("running"); }}>Try again</Button>
          </div>
        </Card>

        <div className="space-y-3">
          {questions.map((q, i) => {
            const chosen = answers[q.id];
            const right = chosen === q.correct_index;
            return (
              <Card key={q.id} className="p-4 space-y-2">
                <p className="font-medium text-foreground">
                  {right ? "✅" : "❌"} {i + 1}. {q.prompt}
                </p>
                <ul className="text-sm space-y-1">
                  {q.options.map((opt, oi) => (
                    <li
                      key={oi}
                      className={
                        oi === q.correct_index
                          ? "text-green-700 font-medium"
                          : oi === chosen
                            ? "text-red-600"
                            : "text-muted-foreground"
                      }
                    >
                      {oi === q.correct_index ? "✓ " : oi === chosen ? "✗ " : "• "}
                      {String.fromCharCode(65 + oi)}. {opt}
                    </li>
                  ))}
                </ul>
                {q.explanation ? (
                  <p className="text-xs text-muted-foreground italic">Why: {q.explanation}</p>
                ) : null}
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <AssessmentNavigator
      questions={questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options }))}
      timeLimitMinutes={timeLimitMinutes}
      onSubmit={doSubmit}
    />
  );
}

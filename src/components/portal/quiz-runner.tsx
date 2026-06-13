"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/portal/ui";

interface Question {
  id: string;
  prompt: string;
  options: string[];
}

const MAX_VIOLATIONS = 3;

type Phase = "intro" | "ready" | "done" | "noattempts" | "error";

function mmss(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function QuizRunner({
  quizId,
  questions,
  maxAttempts,
  timeLimitMinutes,
}: {
  quizId: string;
  questions: Question[];
  maxAttempts: number;
  timeLimitMinutes: number | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState<Phase>("intro");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [violations, setViolations] = useState(0);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const submittingRef = useRef(false);
  const violationsRef = useRef(0);

  const doSubmit = useCallback(async () => {
    if (submittingRef.current || !attemptId) return;
    submittingRef.current = true;
    const { data, error } = await supabase.rpc("submit_quiz_attempt", {
      p_attempt_id: attemptId,
      p_answers: answers,
      p_violations: violationsRef.current,
    });
    if (error) {
      submittingRef.current = false;
      return;
    }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setResult(data as { score: number; total: number });
    setPhase("done");
  }, [attemptId, answers, supabase]);

  async function start() {
    document.documentElement.requestFullscreen?.().catch(() => {});
    const { data, error } = await supabase.rpc("start_quiz_attempt", {
      p_quiz_id: quizId,
    });
    if (error) {
      setPhase("error");
      return;
    }
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
      setDeadline(
        new Date(d.started_at).getTime() + d.time_limit_minutes * 60_000,
      );
    }
    setPhase("ready");
  }

  // Countdown → auto-submit when time runs out.
  useEffect(() => {
    if (phase !== "ready" || !deadline) return;
    const tick = () => {
      const rem = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) doSubmit();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, deadline, doSubmit]);

  // Tab/window switch detection → record violations, auto-submit after the limit.
  useEffect(() => {
    if (phase !== "ready") return;
    const onHidden = () => {
      if (document.visibilityState !== "hidden") return;
      violationsRef.current += 1;
      setViolations(violationsRef.current);
      if (violationsRef.current >= MAX_VIOLATIONS) doSubmit();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [phase, doSubmit]);

  if (phase === "noattempts") {
    return (
      <Card className="p-8 text-center">
        <p className="font-bebas text-3xl text-[#0A0F1E]">No attempts left</p>
        <p className="serif-display italic text-[#4A4E5C] mt-1">
          You&apos;ve used all your attempts for this quiz.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/portal/student">Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card className="p-8 text-center">
        <p className="serif-display italic text-[#4A4E5C]">
          Couldn&apos;t start the quiz. Please go back and try again.
        </p>
      </Card>
    );
  }

  if (phase === "done" && result) {
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    return (
      <Card className="p-8 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8A020]">
          Quiz complete
        </p>
        <p className="font-bebas text-6xl text-[#0A0F1E] mt-2 leading-none">
          {result.score}/{result.total}
        </p>
        <p className="serif-display italic text-[#4A4E5C] mt-1">{pct}%</p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/portal/student">Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (phase === "intro") {
    return (
      <Card className="p-6 md:p-8 space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8A020]">
          Before you begin
        </p>
        <ul className="space-y-2 text-[#0A0F1E]">
          <li>
            ⏱{" "}
            {timeLimitMinutes
              ? `Timed: ${timeLimitMinutes} minute${timeLimitMinutes === 1 ? "" : "s"} — it auto-submits when time runs out.`
              : "Untimed."}
          </li>
          <li>🔁 Attempts allowed: {maxAttempts}.</li>
          <li>
            🚫 Don&apos;t switch tabs or leave the window — it&apos;s recorded,
            and the quiz auto-submits after {MAX_VIOLATIONS} switches.
          </li>
          <li>✅ Answer every question, then submit.</li>
        </ul>
        <Button onClick={start} size="lg">
          Start quiz
        </Button>
      </Card>
    );
  }

  // ready
  const allAnswered = questions.every((q) => q.id in answers);
  return (
    <div className="space-y-5" onContextMenu={(e) => e.preventDefault()}>
      <div className="sticky top-18 z-20 flex items-center justify-between gap-4 bg-[#0A0F1E] text-white px-4 py-3">
        <span className="text-sm">
          {Object.keys(answers).length}/{questions.length} answered
        </span>
        {remaining !== null ? (
          <span
            className={`font-bebas text-2xl ${remaining <= 60 ? "text-red-400" : "text-[#E8A020]"}`}
          >
            {mmss(remaining)}
          </span>
        ) : null}
      </div>

      {violations > 0 ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2">
          ⚠ Leaving the quiz is recorded ({violations}/{MAX_VIOLATIONS}). It will
          auto-submit after {MAX_VIOLATIONS}.
        </p>
      ) : null}

      {questions.map((q, i) => (
        <Card key={q.id} className="p-5">
          <p className="font-medium text-[#0A0F1E]">
            {i + 1}. {q.prompt}
          </p>
          <div className="mt-3 space-y-2">
            {q.options.map((opt, oi) => (
              <label
                key={oi}
                className="flex items-center gap-3 cursor-pointer text-[#0A0F1E]"
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === oi}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                  className="accent-[#E8A020]"
                />
                {opt}
              </label>
            ))}
          </div>
        </Card>
      ))}

      <Button onClick={doSubmit} size="lg" disabled={!allAnswered}>
        Submit answers
      </Button>
    </div>
  );
}

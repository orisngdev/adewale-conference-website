"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/portal/ui";

export interface NavQuestion {
  id: string;
  prompt: string;
  options: string[];
}

const MAX_VIOLATIONS = 3;

function mmss(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// Standard JAMB/CBT navigator (ADR 0003): one question per screen, Prev/Next,
// a numbered navigator grid, mark-for-review, a review screen, and a single
// full-duration timer. Shared by the practice and exam runners; the parent owns
// what happens on submit.
export function AssessmentNavigator({
  questions,
  timeLimitMinutes,
  deadlineAt,
  proctor = false,
  submitting = false,
  onSubmit,
}: {
  questions: NavQuestion[];
  timeLimitMinutes: number | null;
  deadlineAt?: number | null;
  proctor?: boolean;
  submitting?: boolean;
  onSubmit: (answers: Record<string, number>, violations: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [review, setReview] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [violations, setViolations] = useState(0);
  const violationsRef = useRef(0);
  const submittedRef = useRef(false);

  // Deadline: explicit (exam resume) or derived once from the time limit.
  const deadlineRef = useRef<number | null>(
    deadlineAt ?? (timeLimitMinutes ? Date.now() + timeLimitMinutes * 60_000 : null),
  );

  const submit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (typeof document !== "undefined" && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    onSubmit(answers, violationsRef.current);
  }, [answers, onSubmit]);

  // Countdown → auto-submit.
  useEffect(() => {
    if (!deadlineRef.current) return;
    const tick = () => {
      const rem = Math.max(0, Math.round((deadlineRef.current! - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) submit();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [submit]);

  // Exam proctoring: fullscreen + tab-switch detection.
  useEffect(() => {
    if (!proctor) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
    const onHidden = () => {
      if (document.visibilityState !== "hidden") return;
      violationsRef.current += 1;
      setViolations(violationsRef.current);
      if (violationsRef.current >= MAX_VIOLATIONS) submit();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [proctor, submit]);

  const q = questions[idx];
  const answeredCount = Object.keys(answers).length;

  function pick(oi: number) {
    setAnswers((a) => ({ ...a, [q.id]: oi }));
  }
  function toggleMark() {
    setMarked((m) => {
      const n = new Set(m);
      n.has(q.id) ? n.delete(q.id) : n.add(q.id);
      return n;
    });
  }

  if (review) {
    return (
      <div className="space-y-5">
        <Card className="p-6">
          <p className="font-bebas text-3xl text-foreground">Review before you submit</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-bebas text-3xl text-foreground">{answeredCount}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Answered</p>
            </div>
            <div>
              <p className="font-bebas text-3xl text-foreground">{questions.length - answeredCount}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Unanswered</p>
            </div>
            <div>
              <p className="font-bebas text-3xl text-foreground">{marked.size}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Marked</p>
            </div>
          </div>
          <Grid
            questions={questions}
            answers={answers}
            marked={marked}
            current={-1}
            onJump={(i) => { setReview(false); setIdx(i); }}
          />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={submit} size="lg" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
            <Button variant="outline" onClick={() => setReview(false)} disabled={submitting}>
              Back to questions
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4" onContextMenu={proctor ? (e) => e.preventDefault() : undefined}>
      <div className="sticky top-16 z-20 flex items-center justify-between gap-4 bg-foreground text-white px-4 py-3 rounded-md">
        <span className="text-sm">{answeredCount}/{questions.length} answered</span>
        {remaining !== null ? (
          <span className={`font-bebas text-2xl ${remaining <= 60 ? "text-red-400" : "text-primary"}`}>
            {mmss(remaining)}
          </span>
        ) : null}
      </div>

      {proctor && violations > 0 ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded">
          ⚠ Leaving the screen is recorded ({violations}/{MAX_VIOLATIONS}). Auto-submits after {MAX_VIOLATIONS}.
        </p>
      ) : null}

      <Card className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="font-medium text-foreground">
            <span className="text-primary">Q{idx + 1}.</span> {q.prompt}
          </p>
          <button
            type="button"
            onClick={toggleMark}
            className={`shrink-0 text-xs uppercase tracking-wide px-2 py-1 rounded border ${
              marked.has(q.id)
                ? "border-primary text-primary"
                : "border-foreground/20 text-muted-foreground"
            }`}
          >
            {marked.has(q.id) ? "★ Marked" : "☆ Mark"}
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {q.options.map((opt, oi) => {
            const active = answers[q.id] === oi;
            return (
              <button
                key={oi}
                type="button"
                onClick={() => pick(oi)}
                className={`flex w-full items-center gap-3 text-left rounded-md border px-3 py-2.5 transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-foreground/15 text-foreground hover:border-primary/60"
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    active ? "bg-primary text-white" : "bg-foreground/5 text-muted-foreground"
                  }`}
                >
                  {String.fromCharCode(65 + oi)}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
          ← Prev
        </Button>
        {idx < questions.length - 1 ? (
          <Button onClick={() => setIdx((i) => Math.min(questions.length - 1, i + 1))}>Next →</Button>
        ) : (
          <Button onClick={() => setReview(true)}>Review & submit</Button>
        )}
      </div>

      <Card className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Questions</p>
        <Grid questions={questions} answers={answers} marked={marked} current={idx} onJump={setIdx} />
        <Button variant="outline" className="mt-4" onClick={() => setReview(true)}>
          Review & submit
        </Button>
      </Card>
    </div>
  );
}

function Grid({
  questions,
  answers,
  marked,
  current,
  onJump,
}: {
  questions: NavQuestion[];
  answers: Record<string, number>;
  marked: Set<string>;
  current: number;
  onJump: (i: number) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-6 sm:grid-cols-10 gap-2">
      {questions.map((qq, i) => {
        const answered = qq.id in answers;
        const isMarked = marked.has(qq.id);
        const isCurrent = i === current;
        return (
          <button
            key={qq.id}
            type="button"
            onClick={() => onJump(i)}
            className={`h-9 rounded text-sm font-medium transition-colors ${
              isCurrent ? "ring-2 ring-foreground " : ""
            }${
              isMarked
                ? "bg-blue-100 text-blue-700"
                : answered
                  ? "bg-primary text-white"
                  : "bg-foreground/5 text-muted-foreground"
            }`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

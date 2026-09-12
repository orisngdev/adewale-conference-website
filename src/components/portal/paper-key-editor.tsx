"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/portal/ui";
import type { KeyField } from "@/lib/paper-exam";
import {
  saveKeyItems,
  type KeySaveState,
} from "@/app/(portal)/portal/admin/paper-exams/actions";
import { Select } from "@/components/ui/select";

// Two fields, so the common cases are one paste each rather than 100 typed rows.
// Both are controlled: React resets an uncontrolled form after a form action
// completes, which wiped 100 pasted letters every time a key was rejected.

const initial: KeySaveState = { stage: "idle" };

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";
const areaBase =
  "w-full rounded-md border bg-card px-3 py-2 font-mono text-xs outline-none transition-colors";
const areaOk = "border-foreground/15 focus:border-primary";
const areaBad = "border-destructive ring-1 ring-destructive/40 focus:border-destructive";

export default function PaperKeyEditor({
  examId,
  itemCount,
  optionCount,
  subjects,
  existingVersions,
  saved,
}: {
  examId: string;
  itemCount: number;
  optionCount: number;
  subjects: string[];
  existingVersions: string[];
  /** What is already stored, per copy, so the form says so before you type. */
  saved: { version: string; count: number }[];
}) {
  const [state, action, pending] = useActionState(
    saveKeyItems.bind(null, examId),
    initial,
  );
  const [answers, setAnswers] = useState("");
  const [subjectMap, setSubjectMap] = useState("");
  // Saved with the key, so the answers are always validated against the number
  // that is about to be stored.
  const [options, setOptions] = useState(String(optionCount));
  const last = "ABCDE"[Number(options) - 1] ?? "D";

  const errorsFor = (field: KeyField) =>
    (state.stage === "error" ? state.errors ?? [] : []).filter((e) => e.field === field);
  const answerErrors = errorsFor("answers");
  const subjectErrors = errorsFor("subjects");

  // Live, so a short paste is obvious before submitting rather than after.
  const letterCount = answers.replace(/[^A-Ea-e]/g, "").length;
  const perLine = /^\s*\d{1,3}\s*[,:;.)\s]\s*[A-Ea-e]\s*$/m.test(answers);
  const beyond = [
    ...new Set(answers.toUpperCase().replace(/[^A-E]/g, "").split("").filter((l) => l > last)),
  ];

  const example = subjects.length
    ? subjects
        .map((s, i) => {
          const per = Math.floor(itemCount / subjects.length) || 1;
          const from = i * per + 1;
          const to = i === subjects.length - 1 ? itemCount : (i + 1) * per;
          return `${from}-${to} ${s}`;
        })
        .join("\n")
    : "1-25 Mathematics\n26-50 Physics";

  // Whether a key already exists belongs at the TOP of the form that writes it.
  // It was only visible further down the page, so the honest question "have I
  // done this already?" needed a scroll to answer.
  const savedTotal = saved.reduce((n, v) => n + v.count, 0);
  const complete = saved.filter((v) => v.count === itemCount);
  const partial = saved.filter((v) => v.count > 0 && v.count !== itemCount);

  return (
    <Card className="p-5 md:p-6 space-y-4">
      {savedTotal === 0 ? (
        <div className="rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2">
          <p className="text-sm text-muted-foreground">
            No answers saved yet. Results cannot be imported until this exam has a key.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-primary/25 bg-primary/[0.06] px-3 py-2">
          <p className="text-sm text-foreground">
            {complete.length > 0 ? "✓ " : ""}
            {complete.length > 0
              ? `${itemCount} of ${itemCount} answers saved${
                  complete.length === 1 && complete[0].version === "A"
                    ? ""
                    : ` on ${complete.map((v) => `copy ${v.version}`).join(", ")}`
                }.`
              : "A key is partly saved."}
            {partial.length > 0
              ? ` ${partial
                  .map((v) => `Copy ${v.version} has only ${v.count} of ${itemCount}`)
                  .join("; ")}.`
              : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Saving below replaces the key for whichever copy you choose. The full list is under
            “Answers on file”.
          </p>
        </div>
      )}

      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="answers" className="block text-sm text-foreground">
            1. The right answer to each of the {itemCount} questions
          </label>
          <p className="mb-1 text-xs text-muted-foreground">
            The same answers you set up in the capture tool. Paste the {itemCount} letters in
            order — <code>ABDCA…</code> — or one line per question, <code>12,B</code>. This
            paper&apos;s questions have {options} options, A to {last}.
          </p>
          <textarea
            id="answers"
            name="answers"
            rows={4}
            value={answers}
            onChange={(e) => setAnswers(e.target.value)}
            aria-invalid={answerErrors.length > 0}
            placeholder={"ABDCABDCAB…"}
            className={`${areaBase} ${answerErrors.length ? areaBad : areaOk}`}
          />
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {answers.trim() === "" ? (
                <>Nothing pasted yet.</>
              ) : perLine ? (
                <>Reading one answer per line.</>
              ) : (
                <span className={letterCount === itemCount ? "text-foreground" : undefined}>
                  {letterCount} of {itemCount} letters
                  {letterCount === itemCount ? " ✓" : ""}
                </span>
              )}
            </p>
          </div>
          {beyond.length && !answerErrors.length ? (
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-500">
              {beyond.join(", ")} {beyond.length === 1 ? "is" : "are"} past {last}. Either that is
              a typo, or this paper has more options than {options} — set it below.
            </p>
          ) : null}
          {answerErrors.map((e) => (
            <p key={e.message} className="mt-1 text-sm text-destructive">
              {e.message}
            </p>
          ))}
        </div>

        <div>
          <label htmlFor="subject_map" className="block text-sm text-foreground">
            2. Which questions belong to which subject
          </label>
          <p className="mb-1 text-xs text-muted-foreground">
            {subjects.length <= 1
              ? "This exam has one subject, so leave this blank."
              : "This is what makes a per-subject score possible — without it we can only give a total. One line per block; or type cycle if the subjects rotate question by question."}
          </p>
          <textarea
            id="subject_map"
            name="subject_map"
            rows={Math.min(6, Math.max(3, subjects.length))}
            value={subjectMap}
            onChange={(e) => setSubjectMap(e.target.value)}
            aria-invalid={subjectErrors.length > 0}
            placeholder={example}
            className={`${areaBase} ${subjectErrors.length ? areaBad : areaOk}`}
          />
          {subjects.length ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Subjects on this exam: {subjects.join(" · ")}
            </p>
          ) : (
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-500">
              Set the exam&apos;s subjects above before authoring the key.
            </p>
          )}
          {subjectErrors.map((e) => (
            <p key={e.message} className="mt-1 text-sm text-destructive">
              {e.message}
            </p>
          ))}
          {subjects.length > 1 && subjectMap.trim() === "" ? (
            <button
              type="button"
              onClick={() => setSubjectMap(example)}
              className="mt-2 cursor-pointer text-xs text-primary hover:underline"
            >
              Fill in an even split across the {subjects.length} subjects
            </button>
          ) : null}
        </div>

        <div className="border-t border-foreground/10 pt-3">
          <label className="block text-sm text-muted-foreground">
            Each question has
            <Select
              name="option_count"
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              className="mx-2"
            >
              <option value="4">4 options — A to D</option>
              <option value="5">5 options — A to E</option>
            </Select>
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Match the printed sheet. On a 4-option paper an E read off a sheet is treated as an
            unreadable mark and flagged for review, rather than scored.
          </p>
        </div>

        {/* Deliberately last and quiet. Almost every exam is printed in one
            version, and leading with this control made the whole form read as
            being about something it isn't. */}
        <details className="border-t border-foreground/10 pt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Printing shuffled variants of this paper? (almost never)
          </summary>
          <div className="mt-2 space-y-1">
            <p className="text-xs text-muted-foreground">
              Some exams print 2–4 shuffled copies so neighbours can&apos;t copy, and each copy
              needs its own answers. If you print one paper — the normal case — leave this alone.
            </p>
            <label className="block text-sm text-muted-foreground">
              These answers are for
              <Select name="version" defaultValue="A" className="ml-2">
                {["A", "B", "C", "D"].map((v) => (
                  <option key={v} value={v}>
                    Copy {v}
                    {existingVersions.includes(v) ? " — already set" : ""}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </details>

        <Button type="submit" disabled={pending || subjects.length === 0}>
          {pending ? "Saving…" : "Save answer key"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Saving replaces the key completely. Papers already imported keep their captured marks
          and are re-marked against the new key when the import is committed.
        </p>
      </form>

      {state.stage === "error" && state.errors?.length ? (
        <p className="text-sm text-muted-foreground">
          Nothing was saved and nothing you typed was lost — fix the fields marked in red and
          save again. A key has to be complete, or the missing questions would be scored wrong
          for every student.
        </p>
      ) : null}

      {state.stage === "saved" ? (
        <p className="text-sm text-foreground">
          Saved — {state.saved} questions
          {state.version && state.version !== "A" ? ` on copy ${state.version}` : ""}.
        </p>
      ) : null}
    </Card>
  );
}

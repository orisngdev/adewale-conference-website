"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  createPaperExam,
  type ActionResult,
} from "@/app/(portal)/portal/admin/paper-exams/actions";
import { Select } from "@/components/ui/select";

// Controlled, so a rejected create keeps the title and the subject list. React
// resets an uncontrolled form once a form action completes, which is what made
// a failed create look like nothing had happened at all.

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

export default function PaperExamCreateForm({ currentYear }: { currentYear: number }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createPaperExam,
    null,
  );
  const [title, setTitle] = useState("");
  const [subjects, setSubjects] = useState("");
  const [quizName, setQuizName] = useState("");

  return (
    <>
      <form action={action} className="grid gap-2 sm:grid-cols-2">
        <input
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. ASC 2026 Qualifier)"
          className={`sm:col-span-2 ${inputCls}`}
        />
        <input
          name="subjects"
          required
          value={subjects}
          onChange={(e) => setSubjects(e.target.value)}
          placeholder="Subjects, comma-separated (e.g. Mathematics, Physics, Chemistry, Biology)"
          className={`sm:col-span-2 ${inputCls}`}
        />
        <input
          name="source_quiz_name"
          value={quizName}
          onChange={(e) => setQuizName(e.target.value)}
          placeholder="Capture-tool quiz name (optional, guards against the wrong export)"
          className={`sm:col-span-2 ${inputCls}`}
        />
        <label className="text-sm text-muted-foreground">
          Edition
          <input
            name="edition_year"
            type="number"
            defaultValue={currentYear}
            className={`ml-2 w-24 ${inputCls}`}
          />
        </label>
        <label className="text-sm text-muted-foreground">
          Items
          <input
            name="item_count"
            type="number"
            min={1}
            max={100}
            defaultValue={100}
            className={`ml-2 w-20 ${inputCls}`}
          />
        </label>
        <label className="text-sm text-muted-foreground">
          Options per question
          <Select name="option_count" defaultValue={4} className="ml-2">
            <option value={4}>4 — A to D</option>
            <option value={5}>5 — A to E</option>
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
          <input type="checkbox" name="is_backfill" value="1" className="size-4" />
          This is a past sitting being imported for the record
        </label>
        <p className="-mt-1 text-xs text-muted-foreground sm:col-span-2">
          Past editions are otherwise locked, so old results cannot be changed by accident. Tick
          this only when the edition above is a year that has already been run.
        </p>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>

      {state && !state.ok ? (
        <p className="mt-3 text-sm text-destructive">{state.error}</p>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        Subjects are this exam&apos;s own vocabulary — they become the labels students see in their
        breakdown, so spell them the way they should be published. Each item then gets its own
        subject tag, so an interleaved paper works.
      </p>
    </>
  );
}

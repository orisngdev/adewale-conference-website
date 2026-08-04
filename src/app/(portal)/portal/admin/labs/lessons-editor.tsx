"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/portal/submit-button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  LAB_KINDS,
  LAB_KIND_GLYPH,
  LAB_KIND_LABEL,
  type LabStep,
  type LabStepKind,
  type QuizAssessmentOption,
} from "@/lib/labs";
import { addStep, updateStep, deleteStep, moveStep } from "./actions";

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary w-full";

type FormInitial = {
  title?: string;
  kind?: LabStepKind;
  body_md?: string | null;
  media_url?: string | null;
  link_label?: string | null;
  duration_label?: string | null;
  assessment_id?: string | null;
  file_name?: string | null;
};

// The type-specific fields, swapped by the lesson-type picker.
function LessonFields({
  initial,
  assessments,
}: {
  initial: FormInitial;
  assessments: QuizAssessmentOption[];
}) {
  const [kind, setKind] = useState<LabStepKind>(initial.kind ?? "lesson");

  return (
    <div className="space-y-3">
      <input type="hidden" name="kind" value={kind} />

      {/* Lesson-type picker */}
      <div>
        <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
          Lesson type
        </span>
        <div className="flex flex-wrap gap-1.5">
          {LAB_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                kind === k
                  ? "border-primary bg-primary/15 text-gold-ink font-semibold"
                  : "border-foreground/15 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span aria-hidden>{LAB_KIND_GLYPH[k]}</span>
              {LAB_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-muted-foreground">Title</span>
          <input name="title" required defaultValue={initial.title ?? ""} className={inputCls} />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">Duration label (optional)</span>
          <input
            name="duration_label"
            defaultValue={initial.duration_label ?? ""}
            placeholder="e.g. 6 min"
            className={inputCls}
          />
        </label>
      </div>

      {/* Video / External-tool URL */}
      {(kind === "video" || kind === "link") && (
        <label className="text-sm block">
          <span className="text-muted-foreground">
            {kind === "video" ? "Video URL (YouTube / Vimeo)" : "Tool URL"}
          </span>
          <input
            name="media_url"
            defaultValue={initial.media_url ?? ""}
            placeholder="https://…"
            className={inputCls}
          />
        </label>
      )}

      {/* PDF upload — shown inline in a preview-only reader (never downloadable) */}
      {kind === "pdf" && (
        <label className="text-sm block">
          <span className="text-muted-foreground">
            PDF file{initial.file_name ? ` (current: ${initial.file_name})` : ""}
          </span>
          <input
            type="file"
            name="file"
            accept="application/pdf,.pdf"
            className={`${inputCls} file:mr-3 file:rounded file:border-0 file:bg-foreground/10 file:px-3 file:py-1 file:text-sm`}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            {initial.file_name
              ? "Leave empty to keep the current file. Students see it in a preview-only reader — no download."
              : "PDF only, up to 50 MB. Students see it in a preview-only reader — no download."}
          </span>
        </label>
      )}

      {/* External-tool button label */}
      {kind === "link" && (
        <label className="text-sm block">
          <span className="text-muted-foreground">Button label (optional)</span>
          <input
            name="link_label"
            defaultValue={initial.link_label ?? ""}
            placeholder="e.g. Open Scratch"
            className={inputCls}
          />
        </label>
      )}

      {/* Quiz → assessment select */}
      {kind === "quiz" && (
        <label className="text-sm block">
          <span className="text-muted-foreground">Linked assessment</span>
          <select name="assessment_id" defaultValue={initial.assessment_id ?? ""} className={inputCls}>
            <option value="">Select a published assessment…</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
                {a.mode ? ` · ${a.mode}` : ""}
                {[a.subject, a.level].filter(Boolean).length ? ` · ${[a.subject, a.level].filter(Boolean).join(" ")}` : ""}
              </option>
            ))}
          </select>
          {assessments.length === 0 ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              No published assessments yet — create one under Assessments first.
            </span>
          ) : null}
        </label>
      )}

      {/* Notes (all kinds) */}
      <label className="text-sm block">
        <span className="text-muted-foreground">
          {kind === "lesson" ? "Lesson content (markdown)" : "Notes (markdown, optional)"}
        </span>
        <textarea
          name="body_md"
          rows={kind === "lesson" ? 8 : 4}
          defaultValue={initial.body_md ?? ""}
          placeholder={"**Bold**, *italic*, `code`, [links](https://…), - bullets, 1. numbered, ```code blocks```…"}
          className={`${inputCls} font-mono text-xs`}
        />
      </label>
    </div>
  );
}

function LessonRow({
  labId,
  slug,
  step,
  assessments,
  index,
  count,
  canManage,
}: {
  labId: string;
  slug: string;
  step: LabStep;
  assessments: QuizAssessmentOption[];
  index: number;
  count: number;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Reorder */}
        {canManage ? (
          <div className="flex flex-col">
            <form action={moveStep.bind(null, step.id, labId, slug, "up")}>
              <button
                type="submit"
                disabled={index === 0}
                aria-label="Move up"
                className="block text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none text-xs"
              >
                ▲
              </button>
            </form>
            <form action={moveStep.bind(null, step.id, labId, slug, "down")}>
              <button
                type="submit"
                disabled={index === count - 1}
                aria-label="Move down"
                className="block text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none text-xs"
              >
                ▼
              </button>
            </form>
          </div>
        ) : null}

        <span className="grid size-6 shrink-0 place-items-center rounded bg-foreground/5 text-sm" aria-hidden>
          {LAB_KIND_GLYPH[step.kind]}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{step.title}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {LAB_KIND_LABEL[step.kind]}
            {step.duration_label ? ` · ${step.duration_label}` : ""}
          </p>
        </div>

        {canManage ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
              {open ? "Close" : "Edit"}
            </Button>
            <form action={deleteStep.bind(null, step.id, labId, slug)}>
              <ConfirmSubmitButton
                size="sm"
                variant="outline"
                destructive
                title="Delete this lesson?"
                description="It's removed for all students. Their progress on other lessons is unaffected."
                confirmLabel="Yes, delete"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          </>
        ) : null}
      </div>

      {canManage && open ? (
        <div className="border-t border-foreground/5 px-4 py-4">
          <form action={updateStep.bind(null, step.id, labId, slug)} className="space-y-3">
            <LessonFields initial={step} assessments={assessments} />
            <div className="flex items-center gap-2">
              <SubmitButton size="sm" pendingText="Saving…">
                Save lesson
              </SubmitButton>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function LabLessonsEditor({
  labId,
  slug,
  steps,
  assessments,
  canManage,
}: {
  labId: string;
  slug: string;
  steps: LabStep[];
  assessments: QuizAssessmentOption[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      {steps.length === 0 ? (
        <p className="serif-display italic text-muted-foreground">
          {canManage ? "No lessons yet — add the first one below." : "No lessons yet."}
        </p>
      ) : (
        <div className="divide-y divide-foreground/5 border border-foreground/10">
          {steps.map((s, i) => (
            <LessonRow
              key={s.id}
              labId={labId}
              slug={slug}
              step={s}
              assessments={assessments}
              index={i}
              count={steps.length}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      {!canManage ? null : adding ? (
        <div className="bg-card border border-primary/40 p-4">
          <p className="font-bebas text-lg text-foreground mb-3">New lesson</p>
          <form action={addStep.bind(null, labId, slug)} className="space-y-3">
            <LessonFields initial={{ kind: "lesson" }} assessments={assessments} />
            <div className="flex items-center gap-2">
              <SubmitButton size="sm" pendingText="Adding…">
                Add lesson
              </SubmitButton>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
          + Add lesson
        </Button>
      )}
    </div>
  );
}

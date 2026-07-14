import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import BulkImport from "@/components/portal/bulk-import";
import { createClient } from "@/supabase/server";
import type { Assessment, Question } from "@/supabase/types";
import {
  addQuestion,
  deleteQuestion,
  deleteAssessment,
  toggleAssessmentPublished,
  updateAssessmentSettings,
} from "../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

export default async function AssessmentEditor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: assessment }, { data: aqData }] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, title, subject, level, mode, published, max_attempts, time_limit_minutes")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("assessment_questions")
      .select("position, question_bank(id, prompt, options, correct_index, explanation)")
      .eq("assessment_id", id)
      .order("position", { ascending: true }),
  ]);
  if (!assessment) notFound();
  const a = assessment as Assessment;
  const isPractice = a.mode === "practice";
  const questions = ((aqData ?? []) as unknown as {
    position: number;
    question_bank: Question | null;
  }[])
    .map((r) => r.question_bank)
    .filter(Boolean) as Question[];

  return (
    <>
      <PortalHeader
        title={a.title}
        subtitle={`${isPractice ? "Practice drill" : "Exam"} · ${[a.subject, a.level].filter(Boolean).join(" · ") || "—"}`}
      />
      <PortalBody>
        <Link
          href="/portal/admin/assessments"
          className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline"
        >
          ← All assessments
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <form action={toggleAssessmentPublished.bind(null, a.id, !a.published)}>
            <ConfirmSubmitButton
              size="sm"
              variant={a.published ? "outline" : "default"}
              title={a.published ? "Unpublish this assessment?" : "Publish this assessment?"}
              description={
                a.published
                  ? "Students lose access to it immediately."
                  : "It becomes visible to students right away."
              }
              confirmLabel={a.published ? "Yes, unpublish" : "Yes, publish"}
            >
              {a.published ? "Published — unpublish" : "Publish"}
            </ConfirmSubmitButton>
          </form>
          <form action={deleteAssessment.bind(null, a.id)}>
            <ConfirmSubmitButton
              size="sm"
              variant="outline"
              destructive
              title="Delete this assessment?"
              description="The assessment and its question list are removed permanently."
              confirmLabel="Yes, delete"
            >
              Delete
            </ConfirmSubmitButton>
          </form>
        </div>

        <div>
          <SectionHeading>{isPractice ? "Timing (optional)" : "Exam settings"}</SectionHeading>
          <Card className="p-5 md:p-6">
            <form
              action={updateAssessmentSettings.bind(null, a.id)}
              className="flex flex-col sm:flex-row sm:items-end gap-3"
            >
              {!isPractice ? (
                <label className="text-sm text-muted-foreground">
                  Attempts allowed
                  <input
                    name="max_attempts"
                    type="number"
                    min={1}
                    defaultValue={a.max_attempts ?? 1}
                    className={`mt-1 block ${inputCls} sm:w-32`}
                  />
                </label>
              ) : (
                <input type="hidden" name="max_attempts" value={a.max_attempts ?? 1} />
              )}
              <label className="text-sm text-muted-foreground">
                Time limit (minutes for the whole paper, blank = untimed)
                <input
                  name="time_limit_minutes"
                  type="number"
                  min={1}
                  defaultValue={a.time_limit_minutes ?? ""}
                  className={`mt-1 block ${inputCls} sm:w-64`}
                />
              </label>
              <ConfirmSubmitButton
                size="sm"
                variant="outline"
                title={isPractice ? "Save timing?" : "Save exam settings?"}
                description="The change applies to students immediately."
                confirmLabel="Yes, save"
              >
                Save
              </ConfirmSubmitButton>
            </form>
          </Card>
        </div>

        <div>
          <SectionHeading>
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </SectionHeading>
          {questions.length === 0 ? (
            <p className="serif-display italic text-muted-foreground">
              No questions yet — add one below, or bulk-import into the{" "}
              <Link href="/portal/admin/question-bank" className="text-primary hover:underline">
                question bank
              </Link>
              . Needs questions before publishing.
            </p>
          ) : (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <Card key={q.id} className="p-4 space-y-2">
                  <div className="flex justify-between gap-4">
                    <p className="font-medium text-foreground">{i + 1}. {q.prompt}</p>
                    <form action={deleteQuestion.bind(null, q.id, a.id)}>
                      <ConfirmSubmitButton
                        size="sm"
                        variant="ghost"
                        className="h-auto p-0 text-xs uppercase tracking-wide text-red-600 hover:text-red-600 hover:underline hover:bg-transparent shrink-0"
                        destructive
                        title="Delete this question?"
                        description="It's removed from this assessment permanently."
                        confirmLabel="Yes, delete"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                  <ul className="text-sm space-y-1">
                    {q.options.map((opt, oi) => (
                      <li
                        key={oi}
                        className={oi === q.correct_index ? "text-foreground font-medium" : "text-muted-foreground"}
                      >
                        {oi === q.correct_index ? "✓ " : "• "}
                        {String.fromCharCode(65 + oi)}. {opt}
                      </li>
                    ))}
                  </ul>
                  {q.explanation ? (
                    <p className="text-xs text-muted-foreground italic">Explanation: {q.explanation}</p>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeading>Bulk import into this assessment</SectionHeading>
          <BulkImport assessmentId={a.id} />
        </div>

        <div>
          <SectionHeading>Add a question</SectionHeading>
          <Card className="p-5 md:p-6">
            <form action={addQuestion.bind(null, a.id)} className="space-y-3">
              <textarea name="prompt" required rows={2} placeholder="Question prompt" className={inputCls} />
              {[1, 2, 3, 4].map((i) => (
                <input
                  key={i}
                  name={`opt${i}`}
                  placeholder={`Option ${String.fromCharCode(64 + i)}${i <= 2 ? " (required)" : " (optional)"}`}
                  className={inputCls}
                />
              ))}
              {isPractice ? (
                <textarea
                  name="explanation"
                  rows={2}
                  placeholder="Explanation (shown after a practice drill)"
                  className={inputCls}
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-muted-foreground">
                  Correct option
                  <select
                    name="correct"
                    defaultValue="1"
                    className="ml-2 rounded-md border border-foreground/15 bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="1">A</option>
                    <option value="2">B</option>
                    <option value="3">C</option>
                    <option value="4">D</option>
                  </select>
                </label>
                <Button type="submit" size="sm">Add question</Button>
              </div>
            </form>
          </Card>
        </div>
      </PortalBody>
    </>
  );
}

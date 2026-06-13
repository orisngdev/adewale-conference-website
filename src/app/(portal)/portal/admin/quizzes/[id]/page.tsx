import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import { createClient } from "@/supabase/server";
import type { Quiz, QuizQuestion } from "@/supabase/types";
import {
  addQuestion,
  deleteQuestion,
  deleteQuiz,
  toggleQuizPublished,
  updateQuizSettings,
} from "../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-[#0A0F1E]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]";

export default async function QuizEditor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select(
      "id, title, subject, level, edition_year, published, max_attempts, time_limit_minutes",
    )
    .eq("id", id)
    .maybeSingle();
  if (!quiz) notFound();
  const q = quiz as Quiz;

  const { data: qData } = await supabase
    .from("quiz_questions")
    .select("id, prompt, options, correct_index, position")
    .eq("quiz_id", id)
    .order("position", { ascending: true });
  const questions = (qData ?? []) as QuizQuestion[];

  return (
    <>
      <PortalHeader
        title={q.title}
        subtitle={[q.subject, q.level].filter(Boolean).join(" · ") || "Quiz"}
      />
      <PortalBody>
        <Link
          href="/portal/admin/quizzes"
          className="inline-block text-xs uppercase tracking-[0.2em] text-[#E8A020] hover:underline"
        >
          ← All quizzes
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <form action={toggleQuizPublished.bind(null, q.id, !q.published)}>
            <Button
              type="submit"
              size="sm"
              variant={q.published ? "outline" : "default"}
            >
              {q.published ? "Published — unpublish" : "Publish quiz"}
            </Button>
          </form>
          <form action={deleteQuiz.bind(null, q.id)}>
            <Button type="submit" size="sm" variant="outline">
              Delete quiz
            </Button>
          </form>
        </div>

        <div>
          <SectionHeading>Exam settings</SectionHeading>
          <Card className="p-5 md:p-6">
            <form
              action={updateQuizSettings.bind(null, q.id)}
              className="flex flex-col sm:flex-row sm:items-end gap-3"
            >
              <label className="text-sm text-[#4A4E5C]">
                Attempts allowed
                <input
                  name="max_attempts"
                  type="number"
                  min={1}
                  defaultValue={q.max_attempts ?? 1}
                  className={`mt-1 block ${inputCls} sm:w-32`}
                />
              </label>
              <label className="text-sm text-[#4A4E5C]">
                Time limit (minutes, blank = untimed)
                <input
                  name="time_limit_minutes"
                  type="number"
                  min={1}
                  defaultValue={q.time_limit_minutes ?? ""}
                  className={`mt-1 block ${inputCls} sm:w-56`}
                />
              </label>
              <Button type="submit" size="sm" variant="outline">
                Save settings
              </Button>
            </form>
          </Card>
        </div>

        <div>
          <SectionHeading>
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </SectionHeading>
          {questions.length === 0 ? (
            <p className="serif-display italic text-[#4A4E5C]">
              No questions yet — add one below. The quiz needs questions before
              you publish it.
            </p>
          ) : (
            <div className="space-y-3">
              {questions.map((qq, i) => (
                <Card key={qq.id} className="p-4 space-y-2">
                  <div className="flex justify-between gap-4">
                    <p className="font-medium text-[#0A0F1E]">
                      {i + 1}. {qq.prompt}
                    </p>
                    <form action={deleteQuestion.bind(null, qq.id, q.id)}>
                      <button
                        type="submit"
                        className="text-xs uppercase tracking-wide text-red-600 hover:underline shrink-0"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                  <ul className="text-sm space-y-1">
                    {qq.options.map((opt, oi) => (
                      <li
                        key={oi}
                        className={
                          oi === qq.correct_index
                            ? "text-[#0A0F1E] font-medium"
                            : "text-[#4A4E5C]"
                        }
                      >
                        {oi === qq.correct_index ? "✓ " : "• "}
                        {opt}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeading>Add a question</SectionHeading>
          <Card className="p-5 md:p-6">
            <form action={addQuestion.bind(null, q.id)} className="space-y-3">
              <textarea
                name="prompt"
                required
                rows={2}
                placeholder="Question prompt"
                className={inputCls}
              />
              {[1, 2, 3, 4].map((i) => (
                <input
                  key={i}
                  name={`opt${i}`}
                  placeholder={`Option ${i}${i <= 2 ? " (required)" : " (optional)"}`}
                  className={inputCls}
                />
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-[#4A4E5C]">
                  Correct option
                  <select
                    name="correct"
                    defaultValue="1"
                    className="ml-2 rounded-md border border-[#0A0F1E]/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#E8A020]"
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </select>
                </label>
                <Button type="submit" size="sm">
                  Add question
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </PortalBody>
    </>
  );
}

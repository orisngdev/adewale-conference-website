import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import type { Quiz } from "@/supabase/types";
import { createQuiz, toggleQuizPublished } from "./actions";

export const metadata = pageMetadata("Quizzes", "Author quizzes for students.");
export const dynamic = "force-dynamic";

const inputCls =
  "rounded-md border border-[#0A0F1E]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]";

type QuizRow = Quiz & { quiz_questions: { count: number }[] };

export default async function AdminQuizzes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quizzes")
    .select("id, title, subject, level, edition_year, published, quiz_questions(count)")
    .order("created_at", { ascending: false });
  const quizzes = (data ?? []) as unknown as QuizRow[];

  return (
    <>
      <PortalHeader title="Quizzes" subtitle="Author quizzes and publish them to students" />
      <PortalBody>
        <div>
          <SectionHeading>New quiz</SectionHeading>
          <Card className="p-5 md:p-6">
            <form action={createQuiz} className="flex flex-col sm:flex-row gap-2">
              <input name="title" required placeholder="Quiz title" className={`flex-1 ${inputCls}`} />
              <input name="subject" placeholder="Subject" className={`sm:w-40 ${inputCls}`} />
              <input name="level" placeholder="Level (e.g. SS2)" className={`sm:w-40 ${inputCls}`} />
              <Button type="submit" size="sm">Create</Button>
            </form>
          </Card>
        </div>

        <div>
          <SectionHeading>{quizzes.length} quiz{quizzes.length === 1 ? "" : "zes"}</SectionHeading>
          {quizzes.length === 0 ? (
            <p className="serif-display italic text-[#4A4E5C]">
              No quizzes yet — create one above.
            </p>
          ) : (
            <div className="space-y-3">
              {quizzes.map((q) => (
                <Card
                  key={q.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
                >
                  <div>
                    <Link
                      href={`/portal/admin/quizzes/${q.id}`}
                      className="font-bebas text-xl text-[#0A0F1E] hover:text-[#E8A020]"
                    >
                      {q.title}
                    </Link>
                    <p className="text-sm text-[#4A4E5C]">
                      {[q.subject, q.level].filter(Boolean).join(" · ") || "—"} ·{" "}
                      {q.quiz_questions?.[0]?.count ?? 0} question
                      {(q.quiz_questions?.[0]?.count ?? 0) === 1 ? "" : "s"} ·{" "}
                      {q.published ? "Published" : "Draft"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={toggleQuizPublished.bind(null, q.id, !q.published)}>
                      <Button
                        type="submit"
                        size="sm"
                        variant={q.published ? "outline" : "default"}
                      >
                        {q.published ? "Unpublish" : "Publish"}
                      </Button>
                    </form>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/portal/admin/quizzes/${q.id}`}>Edit</Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PortalBody>
    </>
  );
}

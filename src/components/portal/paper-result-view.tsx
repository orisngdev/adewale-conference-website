import Link from "next/link";
import { Card, SectionHeading } from "@/components/portal/ui";
import { PaperScoreBreakdown } from "@/components/portal/paper-score-breakdown";
import { percent } from "@/lib/paper-exam";
import type { SubjectBreakdown } from "@/supabase/types";

// One captured paper, item by item, as returned by get_paper_result. No page
// header of its own: it renders inside whichever section the reader came from,
// so it keeps that role's sidebar.
//
// The CORRECT ANSWER per item appears only once the exam's review has been
// released — the key is reused across centres and sittings.

export interface PaperItemResult {
  position: number;
  subject: string;
  choice: string | null;
  is_correct: boolean | null;
  correct: string | null;
}

export interface PaperResult {
  id: string;
  title: string;
  edition_year: number;
  stage: string;
  total: number | null;
  out_of: number;
  attempted: number | null;
  invalid_marks: number;
  subscores: SubjectBreakdown;
  subjects: string[] | null;
  review_released: boolean;
  exam_no: string | null;
  student_name: string | null;
  school_name: string | null;
  items: PaperItemResult[];
}

export function PaperResultView({
  result,
  backHref,
}: {
  result: PaperResult;
  /** Where the reader came from. Omitted for a page that has its own header. */
  backHref?: string;
}) {
  const total = result.total ?? 0;
  const pct = percent(total, result.out_of);
  const unanswered = result.out_of - (result.attempted ?? 0);

  return (
    <>
      {backHref ? (
        <Link href={backHref} className="text-xs text-primary hover:underline">
          ← Back to results
        </Link>
      ) : null}

      <Card className="p-6 md:p-8">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {result.title} · {result.stage} · {result.edition_year}
        </p>
        {result.student_name ? (
          <p className="text-sm text-muted-foreground">
            {[
              result.student_name,
              result.school_name,
              result.exam_no ? `candidate ${result.exam_no}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        <p className="mt-2 text-5xl tabular-nums text-foreground">
          {total}
          <span className="text-2xl text-muted-foreground">/{result.out_of}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {pct}%
          {unanswered > 0 ? ` · ${unanswered} left blank` : ""}
          {result.invalid_marks > 0
            ? ` · ${result.invalid_marks} mark${result.invalid_marks === 1 ? "" : "s"} could not be read`
            : ""}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Marked from the answer sheet against the official key.
        </p>
      </Card>

      <div>
        <SectionHeading>By subject</SectionHeading>
        <Card className="p-5 md:p-6">
          <PaperScoreBreakdown breakdown={result.subscores} order={result.subjects} />
        </Card>
      </div>

      <div>
        <SectionHeading>Item by item</SectionHeading>
        {!result.review_released ? (
          <p className="mb-3 text-sm text-muted-foreground">
            The answer given and whether it was right are shown below. The correct answers are
            published after every centre has sat the paper.
          </p>
        ) : null}
        <Card className="divide-y divide-foreground/5">
          {result.items.map((item) => (
            <div
              key={item.position}
              className="flex flex-wrap items-center justify-between gap-2 p-3"
            >
              <span className="flex items-center gap-3">
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                  {item.position}
                </span>
                <span className="text-sm text-foreground">{item.subject}</span>
              </span>
              <span className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  {item.choice === null ? (
                    <em className="not-italic">blank</em>
                  ) : item.choice === "?" ? (
                    <em className="not-italic">unreadable</em>
                  ) : (
                    <>
                      chose: <span className="font-mono text-foreground">{item.choice}</span>
                    </>
                  )}
                </span>
                {result.review_released && item.correct ? (
                  <span className="text-muted-foreground">
                    answer: <span className="font-mono text-foreground">{item.correct}</span>
                  </span>
                ) : null}
                <span
                  aria-label={item.is_correct ? "correct" : "incorrect"}
                  className={item.is_correct ? "text-green-700" : "text-red-700"}
                >
                  {item.is_correct ? "✓" : "✗"}
                </span>
              </span>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

import Link from "next/link";
import { Card, SectionHeading } from "@/components/portal/ui";
import { PaperScoreBreakdown } from "@/components/portal/paper-score-breakdown";
import {
  formatCandidateNumber,
  groupItemsBySubject,
  paperItemState,
  percent,
  type PaperItemState,
} from "@/lib/paper-exam";
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

// Colour carries the border and fill only. The letter and number stay on the
// theme's own foreground tokens — a coloured text shade light enough to sit on
// the tint is too light to read on it.
const TONE: Record<PaperItemState, string> = {
  correct: "border-green-600/50 bg-green-500/15",
  wrong: "border-red-600/50 bg-red-500/15",
  blank: "border-dashed border-foreground/30",
  unreadable: "border-amber-600/50 bg-amber-500/15",
  ungraded: "border-foreground/15",
};

const MARK: Partial<Record<PaperItemState, { glyph: string; className: string }>> = {
  correct: { glyph: "✓", className: "text-green-700" },
  wrong: { glyph: "✗", className: "text-red-700" },
  unreadable: { glyph: "!", className: "text-amber-700" },
};

/** The chip shows the letter bubbled; these states have none to show. */
const GLYPH: Partial<Record<PaperItemState, string>> = {
  blank: "–",
  unreadable: "?",
};

const LEGEND: [PaperItemState, string][] = [
  ["correct", "Correct"],
  ["wrong", "Wrong"],
  ["blank", "Left blank"],
  ["unreadable", "Mark unreadable"],
];

function describeItem(
  item: PaperItemResult,
  state: PaperItemState,
  released: boolean,
): string {
  if (state === "blank") return "left blank";
  if (state === "unreadable") return "the mark could not be read";
  if (state === "ungraded") return `chose ${item.choice}, not yet marked`;
  if (state === "correct") return `chose ${item.choice}, correct`;
  return released && item.correct
    ? `chose ${item.choice}, wrong — the answer is ${item.correct}`
    : `chose ${item.choice}, wrong`;
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
  const groups = groupItemsBySubject(result.items, result.subjects);

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
              result.exam_no ? `candidate ${formatCandidateNumber(result.exam_no)}` : null,
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

        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {LEGEND.map(([state, label]) => (
            <span key={state} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`size-3 rounded border ${TONE[state]}`} />
              {label}
            </span>
          ))}
        </div>

        <Card className="divide-y divide-foreground/5">
          {groups.map((group) => (
            <section key={group.subject} className="p-4 md:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">{group.subject}</h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {group.correct}/{group.outOf} · {percent(group.correct, group.outOf)}%
                </span>
              </div>
              <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5">
                {group.items.map((item) => {
                  const state = paperItemState(item);
                  const mark = MARK[state];
                  const showCorrect = result.review_released && state === "wrong" && item.correct;
                  return (
                    <li
                      key={item.position}
                      aria-label={`Question ${item.position}: ${describeItem(item, state, result.review_released)}`}
                      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${TONE[state]}`}
                    >
                      <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {item.position}
                      </span>
                      <span className="font-mono text-sm font-bold text-foreground">
                        {GLYPH[state] ?? item.choice}
                      </span>
                      {showCorrect ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          &rarr;{item.correct}
                        </span>
                      ) : null}
                      {mark ? (
                        <span className={`ml-auto text-xs font-bold ${mark.className}`}>
                          {mark.glyph}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </Card>
      </div>
    </>
  );
}

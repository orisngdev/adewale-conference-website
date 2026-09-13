import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, PortalBody, PortalHeader, SectionHeading } from "@/components/portal/ui";
import { EmptyState } from "@/components/portal/ui";
import { ReadOnlyBadge } from "@/components/portal/read-only-badge";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { canManageModule, requireModuleView } from "@/supabase/auth";
import { COMPETITION_STAGES, type PaperExam } from "@/supabase/types";
import { KEY_VERSIONS, paperExamPhase } from "@/lib/paper-exam";
import { PaperExamPhaseBadge } from "@/components/portal/paper-exam-phase-badge";
import { Trash2 } from "lucide-react";
import ActionForm from "@/components/portal/action-form";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import PaperExamCreateForm from "@/components/portal/paper-exam-create-form";
import { deletePaperExam } from "./actions";

export const metadata = pageMetadata(
  "Paper exams",
  "Author the key, print sheets, import captured results.",
);
export const dynamic = "force-dynamic";

type Row = PaperExam & {
  paper_exam_papers: { count: number }[];
  published_papers: { count: number }[];
  paper_exam_items: { count: number }[];
  paper_exam_candidates: { count: number }[];
  paper_exam_imports: { status: string }[];
};

export default async function AdminPaperExams() {
  await requireModuleView("participants");
  const canManage = await canManageModule("participants");
  const supabase = await createClient();

  const [{ data: exams, error: examsError }, { data: editions }] = await Promise.all([
    supabase
      .from("paper_exams")
      // The embedded counts are what paperExamPhase derives the badge from.
      .select(
        "id, title, edition_year, stage, item_count, option_count, is_backfill, subjects, status, review_released," +
          " paper_exam_papers(count), paper_exam_items(count), paper_exam_candidates(count), paper_exam_imports(status)," +
          " published_papers:paper_exam_papers(count)",
      )
      // Copy A only, so "the key is complete" means the same here as on the
      // exam page — a count across every copy would call an exam ready on the
      // strength of a second version.
      .eq("paper_exam_items.version", KEY_VERSIONS[0])
      .not("published_papers.published_at", "is", null)
      .order("edition_year", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("editions").select("year").order("year", { ascending: false }).limit(1),
  ]);

  const rows = (exams ?? []) as unknown as Row[];
  const currentYear = Number(editions?.[0]?.year) || new Date().getFullYear();

  return (
    <>
      <PortalHeader
        title="Paper exams"
        subtitle="The bubble-sheet qualifier: our key, our grading, per-subject scores"
      />
      <PortalBody>
        {!canManage ? (
          <div>
            <ReadOnlyBadge />
          </div>
        ) : null}

        {canManage ? (
          <div>
            <SectionHeading>New paper exam</SectionHeading>
            <Card className="p-5 md:p-6">
              <PaperExamCreateForm currentYear={currentYear} />
            </Card>
          </div>
        ) : null}

        <div>
          <SectionHeading>All paper exams ({rows.length})</SectionHeading>
          {examsError ? (
            <Card className="border-destructive/30 bg-destructive/5 p-5">
              <p className="text-sm text-foreground">
                The list could not be read: {examsError.message}
              </p>
            </Card>
          ) : rows.length === 0 ? (
            <EmptyState title="No paper exams yet">
              <span className="text-sm text-muted-foreground">
                {canManage
                  ? "Create one above, then author its key and print the answer sheets."
                  : "Nothing has been set up yet."}
              </span>
            </EmptyState>
          ) : (
            <Card className="divide-y divide-foreground/5">
              {rows.map((e) => {
                const imports = e.paper_exam_imports ?? [];
                const phase = paperExamPhase({
                  keyComplete: (e.paper_exam_items?.[0]?.count ?? 0) === e.item_count,
                  sheetsReady:
                    e.is_backfill || (e.paper_exam_candidates?.[0]?.count ?? 0) > 0,
                  hasStagedImport: imports.some((i) => i.status === "staged"),
                  hasPublishedPapers: (e.published_papers?.[0]?.count ?? 0) > 0,
                  published: e.status === "published",
                  isBackfill: e.is_backfill,
                });
                return (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-primary/5"
                >
                  <Link
                    href={`/portal/admin/paper-exams/${e.id}`}
                    className="min-w-0 flex-1"
                  >
                    <span className="block truncate text-foreground">{e.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[
                        e.edition_year,
                        e.stage,
                        `${e.item_count} items`,
                        `A-${String.fromCharCode(64 + Number(e.option_count ?? 4))}`,
                        `${(e.subjects ?? []).length} subjects`,
                        `${e.paper_exam_papers?.[0]?.count ?? 0} papers`,
                      ].join(" · ")}
                    </span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    {e.review_released ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                        Review released
                      </span>
                    ) : null}
                    <PaperExamPhaseBadge phase={phase} />
                    {/* Matches what deletePaperExam allows, so the button is
                        never one that only explains why it did nothing. */}
                    {canManage && phase.key !== "published" && !imports.some((i) => i.status === "committed") ? (
                      <ActionForm action={deletePaperExam.bind(null, e.id)}>
                        <ConfirmSubmitButton
                          size="sm"
                          variant="ghost"
                          destructive
                          title="Delete this exam?"
                          description={`“${e.title}” and everything staged under it will be removed, including its answer key and any allocated candidate numbers. Published scores are never touched.`}
                          confirmLabel="Delete"
                          aria-label={`Delete ${e.title}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          <span className="sr-only sm:not-sr-only sm:ml-1">Delete</span>
                        </ConfirmSubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                </div>
                );
              })}
            </Card>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          An exam moves Draft → Key set → Ready → Grading → Scored → Published on its own, from
          what has actually been done to it — there is nothing to switch on. “Published” means a
          cutoff has been committed. Releasing the answers is separate, and shown separately.
        </p>
        <p className="text-xs text-muted-foreground">
          Stages available on an edition: {COMPETITION_STAGES.join(" · ")}
        </p>
      </PortalBody>
    </>
  );
}

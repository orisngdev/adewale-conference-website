import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, PortalBody, PortalHeader, SectionHeading } from "@/components/portal/ui";
import { EmptyState } from "@/components/portal/ui";
import { ReadOnlyBadge } from "@/components/portal/read-only-badge";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { canManageModule, requireModuleView } from "@/supabase/auth";
import { COMPETITION_STAGES, type PaperExam } from "@/supabase/types";
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

type Row = PaperExam & { paper_exam_papers: { count: number }[] };

export default async function AdminPaperExams() {
  await requireModuleView("participants");
  const canManage = await canManageModule("participants");
  const supabase = await createClient();

  const [{ data: exams }, { data: editions }] = await Promise.all([
    supabase
      .from("paper_exams")
      .select(
        "id, title, edition_year, stage, item_count, option_count, subjects, status, review_released, paper_exam_papers(count)",
      )
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
          {rows.length === 0 ? (
            <EmptyState title="No paper exams yet">
              <span className="text-sm text-muted-foreground">
                {canManage
                  ? "Create one above, then author its key and print the answer sheets."
                  : "Nothing has been set up yet."}
              </span>
            </EmptyState>
          ) : (
            <Card className="divide-y divide-foreground/5">
              {rows.map((e) => (
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
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        e.status === "draft"
                          ? "bg-foreground/5 text-muted-foreground"
                          : e.status === "published"
                            ? "bg-primary/10 text-primary"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-500"
                      }`}
                    >
                      {e.status}
                    </span>
                    {/* Only a draft, matching what deletePaperExam will allow —
                        offering it on anything else would be a button that only
                        ever explains why it did nothing. */}
                    {canManage && e.status === "draft" ? (
                      <ActionForm action={deletePaperExam.bind(null, e.id)}>
                        <ConfirmSubmitButton
                          size="sm"
                          variant="ghost"
                          destructive
                          title="Delete this draft?"
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
              ))}
            </Card>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Stages available on an edition: {COMPETITION_STAGES.join(" · ")}
        </p>
      </PortalBody>
    </>
  );
}

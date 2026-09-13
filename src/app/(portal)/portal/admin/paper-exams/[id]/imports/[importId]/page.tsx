import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Card, PortalBody, PortalHeader, SectionHeading } from "@/components/portal/ui";
import { ReadOnlyBadge } from "@/components/portal/read-only-badge";
import PaperRowResolver from "@/components/portal/paper-row-resolver";
import { pageMetadata } from "@/lib/seo";
import ActionForm from "@/components/portal/action-form";
import { createClient } from "@/supabase/server";
import { canManageModule, requireModuleView } from "@/supabase/auth";
import { percent } from "@/lib/paper-exam";
import type { PaperExamPaper, SubjectBreakdown } from "@/supabase/types";
import { commitImport } from "../../../actions";

export const metadata = pageMetadata("Import review", "Resolve every captured paper.");
export const dynamic = "force-dynamic";

const UNDECIDED = ["unmatched", "ambiguous", "duplicate"];

export default async function ImportReview({
  params,
}: {
  params: Promise<{ id: string; importId: string }>;
}) {
  await requireModuleView("participants");
  const canManage = await canManageModule("participants");
  const { id, importId } = await params;
  const supabase = await createClient();

  const [{ data: imp }, { data: exam }, { data: papers }] = await Promise.all([
    supabase
      .from("paper_exam_imports")
      .select("id, exam_id, filename, header_map, row_count, status, created_at, committed_at")
      .eq("id", importId)
      .maybeSingle(),
    supabase
      .from("paper_exams")
      .select("id, title, item_count, edition_year")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("paper_exam_papers")
      .select(
        "id, external_id, exam_no, first_name, last_name, class_name, version, version_assumed, total, attempted, invalid_marks, subscores, capture_num_correct, key_mismatches, name_mismatch, student_id, match_method, status, resolution_note, published_at",
      )
      .eq("import_id", importId)
      .order("exam_no"),
  ]);
  if (!imp || !exam) notFound();

  const rows = (papers ?? []) as unknown as PaperExamPaper[];
  const undecided = rows.filter((r) => UNDECIDED.includes(r.status));
  const matched = rows.filter((r) => r.status === "matched");
  const discarded = rows.filter((r) => r.status === "discarded");
  const published = rows.filter((r) => r.published_at != null);
  const flagged = matched.filter(
    (r) =>
      r.name_mismatch ||
      r.invalid_marks > 0 ||
      (r.key_mismatches ?? 0) > 0 ||
      r.version_assumed,
  );

  // Names for the matched list, and the roster the resolver offers.
  const { data: students } = await supabase
    .from("students")
    .select("id, name, schools(name)")
    .eq("edition_year", exam.edition_year)
    .is("deactivated_at", null)
    .order("name");
  type StudentRow = { id: string; name: string; schools: { name: string | null } | null };
  const roster = ((students ?? []) as unknown as StudentRow[]).map((s) => ({
    id: s.id,
    name: s.name,
    school: s.schools?.name ?? null,
  }));
  const nameById = new Map(roster.map((s) => [s.id, s.name]));

  const committed = imp.status === "committed";

  return (
    <>
      <PortalHeader
        title={imp.filename ?? "Capture import"}
        subtitle={`${exam.title} · ${rows.length} papers · ${imp.status}`}
      />
      <PortalBody>
        {!canManage ? (
          <div>
            <ReadOnlyBadge />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/portal/admin/paper-exams/${id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to the exam
          </Link>
        </div>

        {/* Undecided rows no longer hold this up; the cut carries that rule. */}
        <div>
          <SectionHeading>Publish</SectionHeading>
          <Card className="p-5 md:p-6 space-y-3">
            <p className="text-sm text-foreground">
              {matched.length} matched · {undecided.length} still need a decision ·{" "}
              {discarded.length} discarded
              {published.length ? ` · ${published.length} already published` : ""}
            </p>
            {committed ? (
              <p className="text-sm text-foreground">
                Finished {imp.committed_at ? new Date(imp.committed_at).toLocaleString() : ""} —
                every paper in this file is decided and published.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Publishing re-grades every matched paper from its captured marks — not from the
                  numbers staged earlier — so a key correction made since the import is picked up.
                  Outcomes are left at pending: a score is a fact, advancement is a separate
                  decision.
                </p>
                {undecided.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    The {undecided.length} undecided stay outstanding and publish nothing. Settle
                    them whenever you can and publish again — it fills in the rest without
                    disturbing anyone already published. Ranking is what needs them all: the cut
                    refuses while any are left.
                  </p>
                ) : null}
                {canManage ? (
                  <ActionForm action={commitImport.bind(null, importId)}>
                    <ConfirmSubmitButton
                      disabled={matched.length === 0}
                      title="Publish these scores?"
                      description={`${matched.length} reps will see their total and subject breakdown.${
                        undecided.length > 0
                          ? ` The ${undecided.length} still needing a decision publish nothing and stay on this page.`
                          : ""
                      } Publishing again later updates a score without un-deciding anyone.`}
                      confirmLabel="Publish"
                    >
                      {undecided.length > 0
                        ? `Publish ${matched.length} now — ${undecided.length} still need a decision`
                        : `Publish ${matched.length} papers`}
                    </ConfirmSubmitButton>
                  </ActionForm>
                ) : null}
              </>
            )}
          </Card>
        </div>

        {undecided.length > 0 ? (
          <div>
            <SectionHeading>Needs a decision ({undecided.length})</SectionHeading>
            <Card className="divide-y divide-foreground/5">
              {undecided.map((row) => (
                <div key={row.id} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-foreground">
                      {[row.first_name, row.last_name].filter(Boolean).join(" ") || "No name on sheet"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[
                        row.exam_no ? `candidate ${row.exam_no}` : "no candidate number",
                        row.class_name,
                        row.external_id ? "has an External ID" : "no External ID",
                        `scored ${row.total ?? 0}/${exam.item_count}`,
                        row.status,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  {canManage && !committed ? (
                    <PaperRowResolver paperId={row.id} roster={roster} />
                  ) : null}
                </div>
              ))}
            </Card>
          </div>
        ) : null}

        {flagged.length > 0 ? (
          <div>
            <SectionHeading>Matched, but worth a look ({flagged.length})</SectionHeading>
            <Card className="divide-y divide-foreground/5">
              {flagged.map((row) => (
                <div key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                  <span className="text-sm text-foreground">
                    {nameById.get(row.student_id ?? "") ?? "Student"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[
                      row.name_mismatch
                        ? `the sheet is named ${[row.first_name, row.last_name].filter(Boolean).join(" ") || "someone else"} — only the number matched`
                        : null,
                      row.invalid_marks > 0
                        ? `${row.invalid_marks} unreadable mark${row.invalid_marks === 1 ? "" : "s"}`
                        : null,
                      (row.key_mismatches ?? 0) > 0
                        ? `${row.key_mismatches} items disagree with the file's own key`
                        : null,
                      row.version_assumed ? `key version assumed to be ${row.version}` : null,
                      row.capture_num_correct !== null && row.capture_num_correct !== row.total
                        ? `the tool said ${row.capture_num_correct}, we scored ${row.total}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        ) : null}

        <div>
          <SectionHeading>Matched ({matched.length})</SectionHeading>
          {matched.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing matched yet.</p>
          ) : (
            <Card className="divide-y divide-foreground/5">
              {matched.slice(0, 200).map((row) => {
                const subs = (row.subscores ?? {}) as SubjectBreakdown;
                return (
                  <div key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                    <span className="text-sm text-foreground">
                      {nameById.get(row.student_id ?? "") ?? "Student"}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {row.match_method === "external_id"
                          ? "by External ID"
                          : row.match_method === "exam_no"
                            ? "by candidate number"
                            : row.match_method === "manual"
                              ? "resolved by hand"
                              : "by name"}
                      </span>
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {row.total ?? 0}/{exam.item_count} · {percent(row.total ?? 0, Number(exam.item_count))}% ·{" "}
                      {Object.entries(subs)
                        .map(([s, v]) => `${s} ${v.correct}/${v.out_of}`)
                        .join(" · ")}
                    </span>
                  </div>
                );
              })}
              {matched.length > 200 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  Showing the first 200 of {matched.length}.
                </p>
              ) : null}
            </Card>
          )}
        </div>

        {discarded.length > 0 ? (
          <div>
            <SectionHeading>Discarded ({discarded.length})</SectionHeading>
            <Card className="divide-y divide-foreground/5">
              {discarded.map((row) => (
                <div key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                  <span className="text-sm text-foreground">
                    {[row.first_name, row.last_name].filter(Boolean).join(" ") || "No name on sheet"}
                    {row.exam_no ? ` · candidate ${row.exam_no}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{row.resolution_note}</span>
                </div>
              ))}
            </Card>
          </div>
        ) : null}
      </PortalBody>
    </>
  );
}

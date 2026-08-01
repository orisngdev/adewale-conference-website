import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Card, PortalBody, PortalHeader, SectionHeading } from "@/components/portal/ui";
import BulkImport from "@/components/portal/bulk-import";
import {
  FilterBar,
  Pagination,
  clampPage,
  filterSelectCls,
  pageBounds,
  parsePage,
} from "@/components/portal/list-controls";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { canManageModule, requireModuleView } from "@/supabase/auth";
import { ReadOnlyBadge } from "@/components/portal/read-only-badge";
import { SUBJECTS, LEVELS } from "@/lib/assessments";
import type { Question } from "@/supabase/types";
import { deleteBankQuestion } from "./actions";

export const metadata = pageMetadata("Question bank", "Import and manage questions.");
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function QuestionBank({
  searchParams,
}: {
  searchParams: Promise<{
    subject?: string;
    level?: string;
    mode?: string;
    q?: string;
    page?: string;
  }>;
}) {
  await requireModuleView("content");
  const canManage = await canManageModule("content");
  const sp = await searchParams;
  const requestedPage = parsePage(sp.page);
  const { from, to } = pageBounds(requestedPage, PAGE_SIZE);
  const supabase = await createClient();

  const buildQuery = () => {
    let query = supabase
      .from("question_bank")
      .select("id, prompt, options, correct_index, mode, subject, level, topic, difficulty", {
        count: "exact",
      })
      .order("created_at", { ascending: false });
    if (sp.subject) query = query.eq("subject", sp.subject);
    if (sp.level) query = query.eq("level", sp.level);
    if (sp.mode) query = query.eq("mode", sp.mode);
    if (sp.q?.trim()) {
      const escaped = sp.q.trim().replace(/[%_\\]/g, (m) => `\\${m}`);
      query = query.or(`prompt.ilike.%${escaped}%,topic.ilike.%${escaped}%`);
    }
    return query;
  };

  const { data, count } = await buildQuery().range(from, to);
  let questions = (data ?? []) as Question[];
  const total = count ?? questions.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = clampPage(requestedPage, pageCount);
  if (page !== requestedPage) {
    const clamped = pageBounds(page, PAGE_SIZE);
    const { data: pageData } = await buildQuery().range(clamped.from, clamped.to);
    questions = (pageData ?? []) as Question[];
  }

  return (
    <>
      <PortalHeader title="Question bank" subtitle="The shared pool. Practice answers may reach devices; exam answers never do." />
      <PortalBody>
        {!canManage ? (
          <div>
            <ReadOnlyBadge />
          </div>
        ) : null}

        {canManage ? (
          <div>
            <SectionHeading>Bulk import (CSV or JSON)</SectionHeading>
            <BulkImport />
          </div>
        ) : null}

        <div>
          <SectionHeading>{total} question{total === 1 ? "" : "s"}</SectionHeading>
          <FilterBar q={sp.q} placeholder="Search prompt or topic…">
            <select name="mode" defaultValue={sp.mode ?? ""} className={filterSelectCls}>
              <option value="">Any pool</option>
              <option value="practice">Practice</option>
              <option value="exam">Exam</option>
            </select>
            <select name="subject" defaultValue={sp.subject ?? ""} className={filterSelectCls}>
              <option value="">Any subject</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select name="level" defaultValue={sp.level ?? ""} className={filterSelectCls}>
              <option value="">Any level</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </FilterBar>
          {questions.length === 0 ? (
            <p className="serif-display italic text-muted-foreground">No questions match — import some above.</p>
          ) : (
            <div className="space-y-2">
              {questions.map((q) => (
                <Card key={q.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{q.prompt}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="uppercase text-primary">{q.mode}</span>
                      {[q.subject, q.level, q.topic, q.difficulty].filter(Boolean).map((t) => ` · ${t}`)}
                      {" · "}✓ {String.fromCharCode(65 + q.correct_index)}
                    </p>
                  </div>
                  {canManage ? (
                    <form action={deleteBankQuestion.bind(null, q.id)}>
                      <ConfirmSubmitButton
                        size="sm"
                        variant="ghost"
                        className="h-auto p-0 text-xs uppercase tracking-wide text-red-600 hover:text-red-600 hover:underline hover:bg-transparent shrink-0"
                        destructive
                        title="Delete this question?"
                        description="It's removed from the question bank permanently."
                        confirmLabel="Yes, delete"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
          <Pagination
            page={page}
            pageCount={pageCount}
            path="/portal/admin/question-bank"
            params={{ q: sp.q, mode: sp.mode, subject: sp.subject, level: sp.level }}
          />
        </div>
      </PortalBody>
    </>
  );
}

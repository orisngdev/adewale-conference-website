import { Button } from "@/components/ui/button";
import { Card, PortalBody, PortalHeader, SectionHeading } from "@/components/portal/ui";
import BulkImport from "@/components/portal/bulk-import";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { SUBJECTS, LEVELS } from "@/lib/assessments";
import type { Question } from "@/supabase/types";
import { deleteBankQuestion } from "./actions";

export const metadata = pageMetadata("Question bank", "Import and manage questions.");
export const dynamic = "force-dynamic";

const selCls =
  "rounded-md border border-foreground/15 bg-card px-2 py-1.5 text-sm outline-none focus:border-primary";

export default async function QuestionBank({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; level?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from("question_bank")
    .select("id, prompt, options, correct_index, mode, subject, level, topic, difficulty")
    .order("created_at", { ascending: false })
    .limit(300);
  if (sp.subject) query = query.eq("subject", sp.subject);
  if (sp.level) query = query.eq("level", sp.level);
  if (sp.mode) query = query.eq("mode", sp.mode);
  const { data } = await query;
  const questions = (data ?? []) as Question[];

  return (
    <>
      <PortalHeader title="Question bank" subtitle="The shared pool. Practice answers may reach devices; exam answers never do." />
      <PortalBody>
        <div>
          <SectionHeading>Bulk import (CSV or JSON)</SectionHeading>
          <BulkImport />
        </div>

        <div>
          <SectionHeading>Filter</SectionHeading>
          <Card className="p-4">
            <form method="get" className="flex flex-wrap items-center gap-2">
              <select name="mode" defaultValue={sp.mode ?? ""} className={selCls}>
                <option value="">Any pool</option>
                <option value="practice">Practice</option>
                <option value="exam">Exam</option>
              </select>
              <select name="subject" defaultValue={sp.subject ?? ""} className={selCls}>
                <option value="">Any subject</option>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select name="level" defaultValue={sp.level ?? ""} className={selCls}>
                <option value="">Any level</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <Button type="submit" size="sm" variant="outline">Apply</Button>
            </form>
          </Card>
        </div>

        <div>
          <SectionHeading>{questions.length} question{questions.length === 1 ? "" : "s"}{questions.length === 300 ? " (showing first 300)" : ""}</SectionHeading>
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
                  <form action={deleteBankQuestion.bind(null, q.id)}>
                    <button type="submit" className="text-xs uppercase tracking-wide text-red-600 hover:underline shrink-0">Delete</button>
                  </form>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PortalBody>
    </>
  );
}

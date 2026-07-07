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
import { SUBJECTS, LEVELS } from "@/lib/assessments";
import type { Assessment } from "@/supabase/types";
import { createAssessment, toggleAssessmentPublished } from "./actions";

export const metadata = pageMetadata("Assessments", "Author practice drills and exams.");
export const dynamic = "force-dynamic";

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

type Row = Assessment & { assessment_questions: { count: number }[] };

export default async function AdminAssessments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .select("id, title, subject, level, edition_year, published, mode, assessment_questions(count)")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PortalHeader
        title="Assessments"
        subtitle="Practice drills (offline, ungraded) and exams (online, graded)"
      />
      <PortalBody>
        <div>
          <SectionHeading action={{ href: "/portal/admin/question-bank", label: "Question bank →" }}>
            New assessment
          </SectionHeading>
          <Card className="p-5 md:p-6">
            <form action={createAssessment} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <input name="title" required placeholder="Title" className={`sm:col-span-2 ${inputCls}`} />
              <select name="mode" defaultValue="practice" className={inputCls}>
                <option value="practice">Practice drill</option>
                <option value="exam">Exam (graded)</option>
              </select>
              <select name="subject" defaultValue="" className={inputCls}>
                <option value="">Subject…</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select name="level" defaultValue="" className={inputCls}>
                <option value="">Level…</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <Button type="submit" size="sm" className="sm:col-span-2 lg:col-span-5 lg:w-40">
                Create
              </Button>
            </form>
          </Card>
        </div>

        <div>
          <SectionHeading>
            {rows.length} assessment{rows.length === 1 ? "" : "s"}
          </SectionHeading>
          {rows.length === 0 ? (
            <p className="serif-display italic text-muted-foreground">
              No assessments yet — create one above.
            </p>
          ) : (
            <div className="space-y-3">
              {rows.map((a) => (
                <Card
                  key={a.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
                >
                  <div>
                    <Link
                      href={`/portal/admin/assessments/${a.id}`}
                      className="font-bebas text-xl text-foreground hover:text-primary"
                    >
                      {a.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      <span className="uppercase tracking-wide text-primary">
                        {a.mode === "practice" ? "Practice" : "Exam"}
                      </span>{" "}
                      · {[a.subject, a.level].filter(Boolean).join(" · ") || "—"} ·{" "}
                      {a.assessment_questions?.[0]?.count ?? 0} question
                      {(a.assessment_questions?.[0]?.count ?? 0) === 1 ? "" : "s"} ·{" "}
                      {a.published ? "Published" : "Draft"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={toggleAssessmentPublished.bind(null, a.id, !a.published)}>
                      <Button
                        type="submit"
                        size="sm"
                        variant={a.published ? "outline" : "default"}
                      >
                        {a.published ? "Unpublish" : "Publish"}
                      </Button>
                    </form>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/portal/admin/assessments/${a.id}`}>Edit</Link>
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

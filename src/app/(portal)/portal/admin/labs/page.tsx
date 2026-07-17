import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/portal/submit-button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Card, PortalBody, PortalHeader, SectionHeading } from "@/components/portal/ui";
import LabLessonsEditor from "./lessons-editor";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { LAB_WORKBENCHES, type Lab, type LabStep, type QuizAssessmentOption } from "@/lib/labs";
import { createLab, updateLab, toggleLabPublished, deleteLab } from "./actions";

export const metadata = pageMetadata("Labs", "Author guided learning paths.");
export const dynamic = "force-dynamic";

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary w-full";

type LabWithSteps = Lab & { lab_steps: LabStep[] };

export default async function AdminLabs({
  searchParams,
}: {
  searchParams: Promise<{ lab?: string }>;
}) {
  const { lab: labParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: labData }, { data: assessmentData }] = await Promise.all([
    supabase
      .from("labs")
      .select(
        "id, slug, title, summary, track, sort, published, workbench_url, lab_steps(id, lab_id, sort, key, title, kind, body_md, media_url, link_label, duration_label, assessment_id)",
      )
      .order("sort")
      .order("created_at"),
    supabase
      .from("assessments")
      .select("id, title, mode, subject, level")
      .eq("published", true)
      .order("title"),
  ]);

  const labs = ((labData ?? []) as unknown as LabWithSteps[]).map((l) => ({
    ...l,
    lab_steps: [...(l.lab_steps ?? [])].sort((a, b) => a.sort - b.sort),
  }));
  const assessments = (assessmentData ?? []) as QuizAssessmentOption[];

  const creating = labParam === "new" || labs.length === 0;
  const active = creating ? null : labs.find((l) => l.slug === labParam) ?? labs[0];
  // Is the active lab's saved editor one of the dropdown options? (Preserve a
  // custom/legacy URL as an extra option rather than silently resetting it.)
  const activeWorkbenchKnown =
    !active?.workbench_url || LAB_WORKBENCHES.some((w) => w.url === active.workbench_url);

  return (
    <>
      <PortalHeader title="Labs" subtitle="Author guided, hands-on learning paths for students" />
      <PortalBody>
        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          {labs.map((l) => {
            const isActive = !creating && active?.id === l.id;
            return (
              <Link
                key={l.id}
                href={`/portal/admin/labs?lab=${l.slug}`}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
                  isActive ? "bg-primary/15 text-gold-ink" : "bg-foreground/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${l.published ? "bg-green-600" : "bg-foreground/25"}`}
                  aria-label={l.published ? "Published" : "Draft"}
                />
                {l.title}
              </Link>
            );
          })}
          <Link
            href="/portal/admin/labs?lab=new"
            className={`inline-flex items-center px-3 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
              creating ? "bg-primary/15 text-gold-ink" : "bg-foreground/5 text-muted-foreground hover:text-foreground"
            }`}
          >
            + New lab
          </Link>
        </div>

        {creating ? (
          <div>
            <SectionHeading>New lab</SectionHeading>
            <Card className="p-5 md:p-6">
              <form action={createLab} className="grid gap-3 max-w-2xl">
                <label className="text-sm">
                  <span className="text-muted-foreground">Title</span>
                  <input name="title" required placeholder="e.g. Future Tech Skills Lab" className={inputCls} />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Track (optional)</span>
                  <input name="track" placeholder="e.g. Future Tech" className={inputCls} />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Summary (optional)</span>
                  <textarea name="summary" rows={2} placeholder="One line shown on the labs grid." className={inputCls} />
                </label>
                <label className="text-sm">
                  <span className="text-muted-foreground">Code editor</span>
                  <select name="workbench_url" defaultValue="" className={inputCls}>
                    <option value="">None — reading-only lab</option>
                    {LAB_WORKBENCHES.map((w) => (
                      <option key={w.url} value={w.url}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Pick an editor to give this lab a pop-up where students build alongside the
                    lessons, or choose None for a reading-only lab.
                  </span>
                </label>
                <SubmitButton size="sm" pendingText="Creating…" className="w-40">
                  Create draft
                </SubmitButton>
              </form>
            </Card>
          </div>
        ) : active ? (
          <div className="space-y-8">
            {/* ── Lab meta ──────────────────────────────────────────────── */}
            <div>
              <SectionHeading
                action={{ href: `/portal/student/labs/${active.slug}`, label: "Preview as student →" }}
              >
                Lab settings
              </SectionHeading>
              <Card className="p-5 md:p-6 space-y-4">
                <form action={updateLab.bind(null, active.id, active.slug)} className="grid gap-3 max-w-2xl">
                  <p className="text-xs text-muted-foreground">
                    Slug: <code className="px-1 py-0.5 rounded bg-foreground/6">{active.slug}</code> · fixed once
                    created so student links and progress stay stable.
                  </p>
                  <label className="text-sm">
                    <span className="text-muted-foreground">Title</span>
                    <input name="title" required defaultValue={active.title} className={inputCls} />
                  </label>
                  <label className="text-sm">
                    <span className="text-muted-foreground">Track</span>
                    <input name="track" defaultValue={active.track ?? ""} className={inputCls} />
                  </label>
                  <label className="text-sm">
                    <span className="text-muted-foreground">Summary</span>
                    <textarea name="summary" rows={2} defaultValue={active.summary ?? ""} className={inputCls} />
                  </label>
                  <label className="text-sm">
                    <span className="text-muted-foreground">Code editor</span>
                    <select name="workbench_url" defaultValue={active.workbench_url ?? ""} className={inputCls}>
                      <option value="">None — reading-only lab</option>
                      {LAB_WORKBENCHES.map((w) => (
                        <option key={w.url} value={w.url}>
                          {w.label}
                        </option>
                      ))}
                      {!activeWorkbenchKnown ? (
                        <option value={active.workbench_url ?? ""}>Custom — {active.workbench_url}</option>
                      ) : null}
                    </select>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Pick an editor so students build alongside the lessons, or None for a
                      reading-only lab.
                    </span>
                  </label>
                  <SubmitButton size="sm" pendingText="Saving…" className="w-40">
                    Save settings
                  </SubmitButton>
                </form>

                <div className="flex flex-wrap items-center gap-2 border-t border-foreground/5 pt-4">
                  <form action={toggleLabPublished.bind(null, active.id, active.slug, !active.published)}>
                    <ConfirmSubmitButton
                      size="sm"
                      variant={active.published ? "outline" : "default"}
                      title={active.published ? "Unpublish this lab?" : "Publish this lab?"}
                      description={
                        active.published
                          ? "Students lose access to it immediately."
                          : "It becomes visible to students right away."
                      }
                      confirmLabel={active.published ? "Yes, unpublish" : "Yes, publish"}
                    >
                      {active.published ? "Unpublish" : "Publish"}
                    </ConfirmSubmitButton>
                  </form>
                  <span className="text-xs text-muted-foreground">
                    {active.published ? "Live for students." : "Draft — hidden from students."}
                  </span>
                  <div className="flex-1" />
                  <form action={deleteLab.bind(null, active.id)}>
                    <ConfirmSubmitButton
                      size="sm"
                      variant="outline"
                      destructive
                      title="Delete this lab?"
                      description="The lab, all its lessons, and every student's progress on it are permanently removed."
                      confirmLabel="Yes, delete lab"
                    >
                      Delete lab
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </Card>
            </div>

            {/* ── Lessons ───────────────────────────────────────────────── */}
            <div>
              <SectionHeading>
                {active.lab_steps.length} lesson{active.lab_steps.length === 1 ? "" : "s"}
              </SectionHeading>
              <LabLessonsEditor
                labId={active.id}
                slug={active.slug}
                steps={active.lab_steps}
                assessments={assessments}
              />
            </div>
          </div>
        ) : null}
      </PortalBody>
    </>
  );
}

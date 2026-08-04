import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/portal/submit-button";
import { Markdown } from "@/components/portal/markdown";
import CodeDrawer from "@/components/portal/code-drawer";
import PdfReader from "@/components/portal/pdf-reader";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import {
  FUTURE_TECH_SLUG,
  LAB_KIND_GLYPH,
  LAB_KIND_LABEL,
  assessmentTakeHref,
  passedAssessmentIds,
  toEmbedUrl,
  type Lab,
  type LabStep,
} from "@/lib/labs";
import { markLessonDone } from "../actions";

export const metadata = pageMetadata("Lab", "Guided learning path.");
export const dynamic = "force-dynamic";

type QuizAssessment = { id: string; mode: string | null; title: string; published: boolean };

export default async function LabPlayer({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const { slug } = await params;
  const { lesson } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  const supabase = await createClient();

  const { data: labData } = await supabase
    .from("labs")
    .select("id, slug, title, summary, track, sort, published, workbench_url")
    .eq("slug", slug)
    .maybeSingle();
  if (!labData) notFound();
  const lab = labData as Lab;

  const [{ data: stepData }, { data: progressData }] = await Promise.all([
    supabase.from("lab_steps").select("*").eq("lab_id", lab.id).order("sort"),
    supabase.from("lab_progress").select("step_key").eq("student_user_id", user.id).eq("lab_id", lab.id),
  ]);
  const steps = (stepData ?? []) as LabStep[];
  const ticked = new Set(((progressData ?? []) as { step_key: string }[]).map((r) => r.step_key));

  // Quiz lessons auto-tick from a passing assessment attempt.
  const quizAssessmentIds = steps
    .filter((s) => s.kind === "quiz" && s.assessment_id)
    .map((s) => s.assessment_id as string);
  const assessmentById = new Map<string, QuizAssessment>();
  let passed = new Set<string>();
  if (quizAssessmentIds.length) {
    const [{ data: aData }, { data: attemptData }] = await Promise.all([
      supabase.from("assessments").select("id, mode, title, published").in("id", quizAssessmentIds),
      supabase
        .from("assessment_attempts")
        .select("assessment_id, score, total")
        .eq("student_user_id", user.id)
        .eq("status", "submitted")
        .in("assessment_id", quizAssessmentIds),
    ]);
    for (const a of (aData ?? []) as QuizAssessment[]) assessmentById.set(a.id, a);
    passed = passedAssessmentIds((attemptData ?? []) as never);
  }

  const isDone = (s: LabStep) =>
    ticked.has(s.key) || (s.kind === "quiz" && !!s.assessment_id && passed.has(s.assessment_id));
  const doneCount = steps.filter(isDone).length;
  const total = steps.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allDone = total > 0 && doneCount === total;

  // Current lesson: the `?lesson=` step, else the first un-ticked, else the first.
  const current =
    (lesson ? steps.find((s) => s.key === lesson) : undefined) ??
    steps.find((s) => !isDone(s)) ??
    steps[0];

  const backLink = (
    <Link
      href="/portal/student/labs"
      className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline"
    >
      ← All labs
    </Link>
  );

  if (!current) {
    return (
      <div className="space-y-6">
        {backLink}
        <Card className="p-8 text-center">
          <p className="font-bebas text-2xl text-foreground">{lab.title}</p>
          <p className="serif-display italic text-muted-foreground mt-1">
            This lab has no lessons yet — check back soon.
          </p>
        </Card>
      </div>
    );
  }

  const currentIndex = steps.findIndex((s) => s.key === current.key);
  const currentDone = isDone(current);
  const nextKey = currentIndex + 1 < steps.length ? steps[currentIndex + 1].key : null;
  const nextHref = nextKey ? `/portal/student/labs/${lab.slug}?lesson=${encodeURIComponent(nextKey)}` : null;
  const embed = current.kind === "video" && current.media_url ? toEmbedUrl(current.media_url) : null;
  const quizAssessment =
    current.kind === "quiz" && current.assessment_id ? assessmentById.get(current.assessment_id) : undefined;

  return (
    <div className="space-y-6">
      {backLink}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] items-start">
        {/* ── Syllabus rail ─────────────────────────────────────────────── */}
        <Card className="overflow-hidden lg:sticky lg:top-6">
          <div className="p-5">
            {lab.track ? (
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{lab.track}</p>
            ) : null}
            <h2 className="font-bebas text-2xl text-foreground leading-tight mt-0.5">{lab.title}</h2>
            <div className="mt-3 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {doneCount} / {total} lesson{total === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="divide-y divide-foreground/5 border-t border-foreground/5">
            {steps.map((s, i) => {
              const active = s.key === current.key;
              const done = isDone(s);
              return (
                <li key={s.key}>
                  <Link
                    href={`/portal/student/labs/${lab.slug}?lesson=${encodeURIComponent(s.key)}`}
                    aria-current={active ? "true" : undefined}
                    className={`flex items-start gap-3 px-5 py-3 transition-colors ${
                      active
                        ? "border-l-2 border-l-primary bg-primary/6"
                        : "border-l-2 border-l-transparent hover:bg-foreground/3"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                        done
                          ? "bg-green-600 text-white"
                          : active
                            ? "border border-primary text-primary"
                            : "border border-foreground/25 text-transparent"
                      }`}
                      aria-hidden
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-sm leading-snug ${
                          active ? "text-foreground font-semibold" : "text-foreground/80"
                        }`}
                      >
                        {s.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-muted-foreground">
                        <span aria-hidden>{LAB_KIND_GLYPH[s.kind]}</span> {LAB_KIND_LABEL[s.kind]}
                        {s.duration_label ? ` · ${s.duration_label}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* ── Lesson pane ───────────────────────────────────────────────── */}
        <Card className="p-6 md:p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            Lesson {currentIndex + 1} of {total} · {LAB_KIND_LABEL[current.kind]}
          </p>
          <h1 className="font-bebas text-3xl md:text-4xl text-foreground leading-tight mt-1">
            {current.title}
          </h1>

          {embed ? (
            <div className="mt-5 aspect-video w-full overflow-hidden rounded bg-foreground/5">
              <iframe
                key={current.key}
                src={embed}
                title={current.title}
                className="h-full w-full"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : current.kind === "video" && current.media_url ? (
            <p className="mt-5 text-sm text-muted-foreground">
              <a
                href={current.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Watch the video ↗
              </a>
            </p>
          ) : null}

          {current.kind === "pdf" ? (
            current.storage_key ? (
              <PdfReader
                key={current.key}
                src={`/api/labs/steps/${current.id}/pdf`}
                className="mt-5 max-h-[80vh]"
              />
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">
                This document isn&apos;t available yet.
              </p>
            )
          ) : null}

          {current.body_md ? <div className="mt-5"><Markdown source={current.body_md} /></div> : null}

          {current.kind === "link" && current.media_url ? (
            <div className="mt-5">
              <Button asChild variant="outline">
                <a href={current.media_url} target="_blank" rel="noopener noreferrer">
                  {current.link_label || "Open tool"} ↗
                </a>
              </Button>
            </div>
          ) : null}

          {current.kind === "quiz" ? (
            <div className="mt-5">
              {quizAssessment && quizAssessment.published ? (
                currentDone ? (
                  <p className="text-sm text-green-700 font-semibold">✓ Quiz passed</p>
                ) : (
                  <>
                    <Button asChild variant="outline">
                      <Link href={assessmentTakeHref(quizAssessment.id, quizAssessment.mode)}>
                        Take the quiz →
                      </Link>
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      This lesson completes automatically once you pass the quiz (50%+).
                    </p>
                  </>
                )
              ) : (
                <p className="text-sm text-muted-foreground">This quiz isn&apos;t available yet.</p>
              )}
            </div>
          ) : null}

          {/* Footer — mark done & continue (auto for quizzes). */}
          <div className="mt-8 border-t border-foreground/5 pt-5 flex items-center justify-between gap-3">
            {currentDone ? (
              <span className="text-sm text-green-700 font-semibold">✓ Completed</span>
            ) : (
              <span className="text-sm text-muted-foreground">Not completed yet</span>
            )}
            {current.kind === "quiz" ? (
              nextHref ? (
                <Button asChild variant={currentDone ? "default" : "outline"}>
                  <Link href={nextHref}>Next lesson →</Link>
                </Button>
              ) : null
            ) : currentDone ? (
              nextHref ? (
                <Button asChild>
                  <Link href={nextHref}>Next lesson →</Link>
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">You&apos;ve reached the end.</span>
              )
            ) : (
              <form action={markLessonDone.bind(null, lab.id, lab.slug, current.key)}>
                <SubmitButton pendingText="Saving…">Mark as done &amp; continue →</SubmitButton>
              </form>
            )}
          </div>
        </Card>
      </div>

      {/* ── Certificate banner (future-tech only — the sole lab with a cert) ── */}
      {lab.slug === FUTURE_TECH_SLUG ? (
        allDone ? (
          <Card className="p-5 md:p-6 border-l-4 border-l-green-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-bebas text-2xl text-foreground">Path complete! 🎓</p>
              <p className="text-sm text-muted-foreground">
                You&apos;ve finished every lesson — your certificate is ready.
              </p>
            </div>
            <Button asChild className="shrink-0">
              <Link href="/portal/student/tech-lab/certificate">Get your certificate →</Link>
            </Button>
          </Card>
        ) : (
          <Card className="p-5 md:p-6 flex items-center gap-4 opacity-80">
            <span className="text-2xl" aria-hidden>🔒</span>
            <div>
              <p className="font-bebas text-xl text-foreground">Certificate locked</p>
              <p className="text-sm text-muted-foreground">
                Complete all {total} lessons to unlock your Future Tech Skills Lab certificate.
              </p>
            </div>
          </Card>
        )
      ) : null}

      {/* ── Sticky code editor — shown for any lab with a workbench URL ── */}
      {lab.workbench_url ? <CodeDrawer key={lab.slug} src={lab.workbench_url} title="Code editor" /> : null}
    </div>
  );
}

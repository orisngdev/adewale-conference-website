import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, SectionHeading, StatTile, StatusBadge } from "@/components/portal/ui";
import { EditionStages, nextStage } from "@/components/portal/edition-stages";
import LinkAccountForm from "@/components/portal/link-account-form";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import type { Edition, RegistrationWithRelations } from "@/supabase/types";

export const metadata = pageMetadata("Student dashboard", "Your conference overview.");
export const dynamic = "force-dynamic";

export default async function StudentOverview() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  // These four don't depend on each other — fetch them concurrently.
  const [
    { data: regData },
    { data: editionData },
    { data: linkedStudent },
    { data: attemptData },
  ] = await Promise.all([
    supabase
      .from("registrations")
      .select("id, edition_year, status, schools(name), certificates(id, type, asset_url)")
      .eq("owner_id", user.id)
      .order("edition_year", { ascending: false }),
    supabase
      .from("editions")
      .select("year, title, registration_open, stages, current_stage")
      .order("year", { ascending: false }),
    // Is this account already a provisioned student? If so, no need to link.
    supabase.from("students").select("id").eq("auth_user_id", user.id).maybeSingle(),
    // Recent practice + exam results for this student.
    supabase
      .from("assessment_attempts")
      .select("id, score, total, mode, created_at, assessments(title)")
      .eq("student_user_id", user.id)
      .eq("status", "submitted")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  const registrations = (regData ?? []) as unknown as RegistrationWithRelations[];
  const certificates = registrations
    .flatMap((r) => r.certificates ?? [])
    .filter((c) => c.asset_url);
  const latest = ((editionData ?? []) as Edition[])[0] ?? null;
  const isLinked = !!linkedStudent;
  const attempts = (attemptData ?? []) as unknown as {
    id: string;
    score: number;
    total: number;
    mode: string;
    assessments: { title: string | null } | null;
  }[];

  return (
    <>
      <Link href="/portal/student/resources" className="block group">
        <Card interactive className="p-5 flex items-center justify-between gap-4 border-l-4 border-l-primary">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Study offline</p>
            <p className="font-bebas text-2xl text-foreground leading-tight">Download study guides &amp; past questions</p>
            <p className="text-sm text-muted-foreground">Save them for offline — practise anywhere, even with no data.</p>
          </div>
          <span className="shrink-0 text-primary font-bold">Open →</span>
        </Card>
      </Link>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <StatTile label="Current edition" value={latest?.year ?? "—"} />
        <StatTile label="Current stage" value={latest?.current_stage ?? "—"} />
        <StatTile label="Certificates" value={certificates.length} />
      </div>

      <div>
        <SectionHeading>Prepare</SectionHeading>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/portal/student/practice", label: "Practice drills", desc: "Offline speed practice" },
            { href: "/portal/student/exams", label: "Exams", desc: "Graded CBT" },
            { href: "/portal/student/tech-lab", label: "Tech Skills Lab", desc: "Scratch → Python" },
            { href: "/portal/student/pitch-studio", label: "Pitch Studio", desc: "Design thinking & BMC" },
            { href: "/portal/student/plans", label: "My plans", desc: "Assigned study path" },
            { href: "/portal/student/resources", label: "Study packs", desc: "Past questions & guides" },
          ].map((q) => (
            <Link key={q.href} href={q.href} className="block group">
              <Card interactive className="p-4 h-full">
                <h3 className="font-bebas text-lg text-foreground">{q.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{q.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {attempts.length > 0 ? (
        <div>
          <SectionHeading action={{ href: "/portal/student/results", label: "All results →" }}>
            Recent results
          </SectionHeading>
          <Card className="divide-y divide-foreground/5">
            {attempts.map((a) => {
              const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 p-3">
                  <span className="text-foreground min-w-0 truncate">
                    {a.assessments?.title ?? "Assessment"}
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">{a.mode}</span>
                  </span>
                  <span className="font-bebas text-lg text-foreground shrink-0">
                    {a.score}/{a.total} · {pct}%
                  </span>
                </div>
              );
            })}
          </Card>
        </div>
      ) : null}

      {!isLinked ? <LinkAccountForm /> : null}

      {latest ? (
        <div>
          <SectionHeading>{latest.year} edition</SectionHeading>
          <Card className="p-5 md:p-6 space-y-3">
            <EditionStages stages={latest.stages} current={latest.current_stage} />
            <p className="text-sm text-muted-foreground">
              Current stage:{" "}
              <span className="font-medium text-foreground">
                {latest.current_stage}
              </span>
              {nextStage(latest.stages, latest.current_stage) ? (
                <> · Next: {nextStage(latest.stages, latest.current_stage)}</>
              ) : null}
            </p>
          </Card>
        </div>
      ) : null}

      {registrations.length > 0 ? (
        <div>
          <SectionHeading>Your registration</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {registrations.map((r) => (
              <Card key={r.id} className="p-5">
                <div className="flex items-center justify-between">
                  <span className="font-bebas text-2xl text-foreground">
                    {r.edition_year}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                {r.schools?.name ? (
                  <p className="serif-display italic text-muted-foreground mt-1">
                    {r.schools.name}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <SectionHeading>Certificates</SectionHeading>
        {certificates.length === 0 ? (
          <p className="serif-display italic text-muted-foreground">
            Certificates you earn will be available to download here.
          </p>
        ) : (
          <div className="space-y-3">
            {certificates.map((c) => (
              <Card key={c.id} className="flex items-center justify-between p-4">
                <span className="text-foreground">{c.type ?? "Certificate"}</span>
                <Button asChild variant="outline" size="sm">
                  <a href={c.asset_url ?? "#"} target="_blank" rel="noopener noreferrer">
                    Download
                  </a>
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

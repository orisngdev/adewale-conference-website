import Link from "next/link";
import { Card, PortalBody, PortalHeader, SectionHeading, StatTile } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";

export const metadata = pageMetadata("Admin overview", "Conference platform overview.");
export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/portal/admin/editions", label: "Editions", desc: "Open registration, advance stages" },
  { href: "/portal/admin/registrations", label: "Registrations", desc: "Verify & issue certificates" },
  { href: "/portal/admin/assessments", label: "Assessments", desc: "Author practice drills & exams" },
  { href: "/portal/admin/question-bank", label: "Question bank", desc: "Import & manage questions" },
  { href: "/portal/admin/users", label: "Users & roles", desc: "Manage roles" },
  { href: "/portal/admin/schools", label: "Schools", desc: "Approve access, view schools" },
  { href: "/portal/admin/participants", label: "Participants", desc: "Airtable registrations" },
];

const STATUSES = ["submitted", "verified", "qualified", "finalist"] as const;

type RegRow = { status: string; edition_year: number; certificates: { id: string }[] };
type AttemptRow = { score: number; total: number; violations: number };

export default async function AdminOverview() {
  const supabase = await createClient();
  const [
    { data: regs },
    { count: userCount },
    { count: schoolCount },
    { count: quizCount },
    { data: attempts },
  ] = await Promise.all([
    supabase.from("registrations").select("status, edition_year, certificates(id)"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("schools").select("id", { count: "exact", head: true }),
    supabase.from("assessments").select("id", { count: "exact", head: true }),
    supabase.from("assessment_attempts").select("score, total, violations").eq("status", "submitted"),
  ]);

  const registrations = (regs ?? []) as unknown as RegRow[];
  const attemptRows = (attempts ?? []) as AttemptRow[];

  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s, registrations.filter((r) => r.status === s).length]),
  );
  const byEdition = [
    ...registrations.reduce((m, r) => {
      m.set(r.edition_year, (m.get(r.edition_year) ?? 0) + 1);
      return m;
    }, new Map<number, number>()),
  ].sort((a, b) => b[0] - a[0]);
  const certs = registrations.reduce((n, r) => n + (r.certificates?.length ?? 0), 0);

  const attemptCount = attemptRows.length;
  const avgPct = attemptCount
    ? Math.round(
        (attemptRows.reduce((s, a) => s + (a.total ? a.score / a.total : 0), 0) /
          attemptCount) *
          100,
      )
    : 0;
  const flagged = attemptRows.filter((a) => a.violations > 0).length;

  return (
    <>
      <PortalHeader title="Staff console" subtitle="Overview of the conference platform" />
      <PortalBody>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatTile label="Registrations" value={registrations.length} />
          <StatTile label="Pending review" value={byStatus.submitted} />
          <StatTile label="Users" value={userCount ?? 0} />
          <StatTile label="Schools" value={schoolCount ?? 0} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <SectionHeading>Registrations by status</SectionHeading>
            <Card className="divide-y divide-foreground/5">
              {STATUSES.map((s) => (
                <div key={s} className="flex items-center justify-between p-3">
                  <span className="capitalize text-muted-foreground">{s}</span>
                  <span className="font-bebas text-xl text-foreground">{byStatus[s]}</span>
                </div>
              ))}
            </Card>
          </div>

          <div>
            <SectionHeading>By edition</SectionHeading>
            <Card className="divide-y divide-foreground/5">
              {byEdition.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No registrations yet.</p>
              ) : (
                byEdition.map(([year, n]) => (
                  <div key={year} className="flex items-center justify-between p-3">
                    <span className="text-muted-foreground">{year}</span>
                    <span className="font-bebas text-xl text-foreground">{n}</span>
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>

        <div>
          <SectionHeading action={{ href: "/portal/admin/assessments", label: "Manage assessments →" }}>
            Assessments
          </SectionHeading>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatTile label="Assessments" value={quizCount ?? 0} />
            <StatTile label="Attempts" value={attemptCount} />
            <StatTile label="Avg score" value={`${avgPct}%`} />
            <StatTile label="Flagged" value={flagged} />
          </div>
        </div>

        <div>
          <SectionHeading>Manage</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map((s) => (
              <Link key={s.href} href={s.href} className="block group">
                <Card interactive className="p-5 h-full">
                  <h3 className="font-bebas text-xl text-foreground">{s.label}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </PortalBody>
    </>
  );
}

import { Card, PortalBody, PortalHeader, SectionHeading, StatTile } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { requireModuleView } from "@/supabase/auth";
import { getAdminAnalytics, type BarPoint, type Slice } from "@/lib/analytics";
import { BRAND, STATUS_COLOR } from "@/components/portal/analytics/chart-theme";
import {
  EditionFilter,
  JumpNav,
  resolveWindow,
  WindowFilter,
  windowDays,
} from "@/components/portal/analytics/filters";
import TrendChart from "@/components/portal/analytics/trend-chart";
import BarChartCard from "@/components/portal/analytics/bar-chart";
import DonutChart from "@/components/portal/analytics/donut-chart";

export const metadata = pageMetadata("Analytics", "Program & platform analytics for admins.");
export const dynamic = "force-dynamic";

const JUMP = [
  { id: "top", label: "Overview" },
  { id: "registrations", label: "Registrations" },
  { id: "growth", label: "Growth" },
  { id: "learning", label: "Learning" },
  { id: "students", label: "Students" },
  { id: "challenges", label: "Challenges" },
];

/** Small titled chart container. */
function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-4 md:p-5 ${className}`}>
      <div className="mb-3">
        <h3 className="font-bebas text-lg tracking-wide text-foreground leading-none">{title}</h3>
        {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
      </div>
      {children}
    </Card>
  );
}

const paint = (b: BarPoint, color: string): BarPoint => ({ ...b, color });
const slice = (name: string, value: number, color: string): Slice => ({ name, value, color });

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; edition?: string }>;
}) {
  await requireModuleView("analytics");
  const sp = await searchParams;
  const windowKey = resolveWindow(sp.window);
  const sinceDays = windowDays(sp.window);
  const editionParam = sp.edition ? Number(sp.edition) : undefined;

  const a = await getAdminAnalytics({
    sinceDays,
    editionYear: Number.isFinite(editionParam) ? editionParam : undefined,
  });

  const ladder = a.registrations.ladder.map((b) =>
    paint(b, STATUS_COLOR[b.label.toLowerCase()] ?? BRAND.navy),
  );

  return (
    <>
      <PortalHeader title="Analytics" subtitle="Program & platform overview" />

      <JumpNav items={JUMP} />

      <PortalBody>
        {/* Global time-window control */}
        <div className="flex flex-wrap items-center justify-between gap-3 -mt-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Time window</p>
          <WindowFilter current={windowKey} edition={sp.edition} />
        </div>

        {/* ── KPI band ─────────────────────────────────────────────────── */}
        <div id="top" className="grid gap-4 grid-cols-2 lg:grid-cols-4 scroll-mt-24">
          <StatTile label="Registrations" value={a.kpis.registrations} />
          <StatTile label="Verified" value={a.kpis.verified} />
          <StatTile label="Schools" value={a.kpis.schools} />
          <StatTile label={`Active students · ${a.windowLabel}`} value={a.kpis.activeStudents} />
          <StatTile label={`Attempts · ${a.windowLabel}`} value={a.kpis.attempts} />
          <StatTile label={`Avg score · ${a.windowLabel}`} value={`${a.kpis.avgScore}%`} />
          <StatTile label={`Downloads · ${a.windowLabel}`} value={a.kpis.downloads} />
          <StatTile label="Certificates" value={a.kpis.certificates} />
        </div>

        {/* ── Registrations & competition (edition-scoped) ─────────────── */}
        <section id="registrations" className="scroll-mt-24">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-border pb-3">
            <h2 className="font-bebas text-2xl md:text-3xl text-foreground tracking-wide">
              Registrations &amp; competition
            </h2>
            <EditionFilter years={a.editionYears} current={a.editionYear ?? 0} window={windowKey} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="New registrations" subtitle="All editions, over time" className="lg:col-span-2">
              <TrendChart data={a.registrations.trend} series={[{ key: "value", name: "Registrations", color: BRAND.gold }]} />
            </Panel>

            <Panel
              title="Competition ladder"
              subtitle={a.editionYear ? `${a.editionYear} edition · ${a.registrations.editionTotal} entries` : "No edition"}
            >
              <BarChartCard data={ladder} series={[{ key: "value", name: "Schools" }]} horizontal />
            </Panel>

            <Panel title="Registrations by edition">
              <BarChartCard
                data={a.registrations.byEdition}
                series={[{ key: "value", name: "Registrations", color: BRAND.navy }]}
              />
            </Panel>

            <Panel title="By LGA" subtitle={a.editionYear ? `${a.editionYear} edition` : undefined}>
              <BarChartCard data={a.registrations.byLga} series={[{ key: "value", name: "Schools", color: BRAND.gold }]} horizontal />
            </Panel>

            <Panel title="By category" subtitle={a.editionYear ? `${a.editionYear} edition` : undefined}>
              <BarChartCard data={a.registrations.byCategory} series={[{ key: "value", name: "Schools", color: BRAND.navy }]} horizontal />
            </Panel>
          </div>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mt-4">
            <StatTile label={`Declined · ${a.editionYear ?? ""}`.trim()} value={a.registrations.declined} />
            <StatTile label="Waitlist pending" value={a.registrations.waitlistPending} />
            <StatTile label="Waitlist notified" value={a.registrations.waitlistNotified} />
            <StatTile label={`Entries · ${a.editionYear ?? ""}`.trim()} value={a.registrations.editionTotal} />
          </div>
        </section>

        {/* ── User & school growth ─────────────────────────────────────── */}
        <section id="growth" className="scroll-mt-24">
          <SectionHeading>User &amp; school growth</SectionHeading>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="New users by role" subtitle="Over time" className="lg:col-span-2">
              <TrendChart
                data={a.growth.usersByRole}
                stacked
                series={[
                  { key: "student", name: "Students", color: BRAND.gold },
                  { key: "coordinator", name: "Coordinators", color: BRAND.navy },
                  { key: "admin", name: "Admins", color: BRAND.muted },
                ]}
              />
            </Panel>
            <Panel title="New schools">
              <TrendChart data={a.growth.schools} variant="line" series={[{ key: "value", name: "Schools", color: BRAND.navy }]} />
            </Panel>
            <Panel title="Students added" subtitle="Provisioned reps">
              <TrendChart data={a.growth.students} variant="line" series={[{ key: "value", name: "Students", color: BRAND.gold }]} />
            </Panel>
          </div>
        </section>

        {/* ── Assessments & learning ───────────────────────────────────── */}
        <section id="learning" className="scroll-mt-24">
          <SectionHeading>Assessments &amp; learning</SectionHeading>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Attempts over time" subtitle="Submitted attempts">
              <TrendChart data={a.learning.attempts} series={[{ key: "value", name: "Attempts", color: BRAND.gold }]} />
            </Panel>
            <Panel title="Resource downloads over time">
              <TrendChart data={a.learning.downloads} series={[{ key: "value", name: "Downloads", color: BRAND.navy }]} />
            </Panel>
            <Panel title="Score distribution" subtitle={`Avg ${a.kpis.avgScore}%`}>
              <BarChartCard data={a.learning.scoreHistogram} series={[{ key: "value", name: "Attempts", color: BRAND.gold }]} />
            </Panel>
            <Panel title="Practice vs exam">
              <DonutChart
                data={[
                  slice("Practice", a.learning.modeSplit[0]?.value ?? 0, BRAND.gold),
                  slice("Exam", a.learning.modeSplit[1]?.value ?? 0, BRAND.navy),
                ]}
              />
            </Panel>
            <Panel title="Learning-plan progress" subtitle="All plan items">
              <DonutChart
                data={[
                  slice("Not started", a.learning.planStatus[0]?.value ?? 0, STATUS_COLOR.submitted),
                  slice("In progress", a.learning.planStatus[1]?.value ?? 0, BRAND.gold),
                  slice("Completed", a.learning.planStatus[2]?.value ?? 0, STATUS_COLOR.finalist),
                ]}
              />
            </Panel>
            <Panel title="Learning signals" subtitle={a.windowLabel}>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <StatTile label="Lab completions" value={a.learning.labCompletions} />
                <StatTile label="Flagged attempts" value={a.learning.flagged} />
                <StatTile label="Flagged rate" value={`${a.learning.flaggedPct}%`} />
                <StatTile label="Avg score" value={`${a.kpis.avgScore}%`} />
              </div>
            </Panel>
          </div>
        </section>

        {/* ── Student activity ─────────────────────────────────────────── */}
        <section id="students" className="scroll-mt-24">
          <SectionHeading>Student activity</SectionHeading>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Active students over time" subtitle="Distinct students with any tracked action" className="lg:col-span-2">
              <TrendChart data={a.students.activeTrend} series={[{ key: "value", name: "Active students", color: BRAND.gold }]} />
            </Panel>
            <Panel title="Students engaging per feature" subtitle={a.windowLabel} className="lg:col-span-2">
              <BarChartCard data={a.students.engagementByFeature} series={[{ key: "value", name: "Students", color: BRAND.navy }]} horizontal />
            </Panel>
          </div>
        </section>

        {/* ── Challenges ────────────────────────────────────────────────── */}
        <section id="challenges" className="scroll-mt-24">
          <SectionHeading>Challenges</SectionHeading>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Challenge activity over time" className="lg:col-span-2">
              <TrendChart
                data={a.challenges.activityTrend}
                series={[
                  { key: "submissions", name: "Data submissions", color: BRAND.gold },
                  { key: "entries", name: "Pitch/text entries", color: BRAND.navy },
                ]}
              />
            </Panel>
            <Panel title="Participation per challenge">
              <BarChartCard data={a.challenges.participation} series={[{ key: "value", name: "Entries", color: BRAND.gold }]} horizontal />
            </Panel>
            <Panel title="Entry review status">
              <DonutChart
                data={[
                  slice("Submitted", a.challenges.entryStatus[0]?.value ?? 0, STATUS_COLOR.submitted),
                  slice("Reviewed", a.challenges.entryStatus[1]?.value ?? 0, STATUS_COLOR.finalist),
                ]}
              />
            </Panel>
          </div>
        </section>
      </PortalBody>
    </>
  );
}

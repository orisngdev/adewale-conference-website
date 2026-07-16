import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import SettingsTabs from "@/components/portal/settings-tabs";
import { ConfirmDecisionButton } from "@/components/portal/confirm-decision-button";
import { SelectAllCheckbox } from "@/components/portal/select-all-checkbox";
import { SelectAllMatching } from "@/components/portal/select-all-matching";
import { StageResults } from "@/components/portal/stage-results";
import {
  StageSchoolCard,
  SchoolCertificatesCard,
  type RosterStudent,
} from "@/components/portal/participant-school-card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { FilterBar, parsePage } from "@/components/portal/list-controls";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { bulkRegistrationDecision, sendSchoolBack } from "../actions";
import type { Edition, Rep, StageResult, StudentStageResult } from "@/supabase/types";

export const metadata = pageMetadata("Participants", "The current edition's competition hub.");
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

interface ParticipantReg {
  id: string;
  edition_year: number;
  reps: unknown;
  contact_email: string | null;
  owner_id: string | null;
  school_id: string | null;
  schools: { name: string | null; lga: string | null; category: string | null } | null;
}
interface RosterStudentRow {
  id: string;
  school_id: string;
  name: string;
  level: string | null;
}
interface CertRow {
  id: string;
  registration_id: string;
  student_id: string | null;
  type: string | null;
}

// A school's place in the competition: the first contestable stage it hasn't
// advanced past. index === stageTabs.length means it cleared them all. A school
// lives on exactly this one stage tab (or Overview only, once completed) —
// advancing it moves it to the next stage's tab.
function standing(
  results: StageResult[],
  stageTabs: string[],
): { index: number; label: string } {
  for (let i = 0; i < stageTabs.length; i++) {
    const outcome = results.find((r) => r.stage === stageTabs[i])?.outcome;
    if (outcome === "eliminated") return { index: i, label: `Out at ${stageTabs[i]}` };
    if (outcome !== "advanced") return { index: i, label: `At ${stageTabs[i]}` };
  }
  return { index: stageTabs.length, label: "Cleared all stages" };
}

export default async function AdminParticipants({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edition?: string; page?: string }>;
}) {
  const { q, edition, page: pageParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: editionData }, { data: regRows }] = await Promise.all([
    supabase
      .from("editions")
      .select("year, title, registration_open, stages, current_stage")
      .order("year", { ascending: false }),
    supabase
      .from("registrations")
      .select("id, edition_year, reps, contact_email, owner_id, school_id, schools(name, lga, category)")
      .eq("status", "verified")
      .order("edition_year", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const editions = (editionData ?? []) as Edition[];
  const allRegs = (regRows ?? []) as unknown as ParticipantReg[];
  const years = [...new Set(allRegs.map((r) => r.edition_year))].sort((a, b) => b - a);

  const activeYear = edition ? Number(edition) || null : editions[0]?.year ?? years[0] ?? null;
  const activeEdition = activeYear ? editions.find((e) => e.year === activeYear) ?? null : null;
  const stages = activeEdition?.stages ?? [];
  // The contestable stages become the middle tabs (skip the Registration /
  // Completed bookends, which are never a pass/fail).
  const stageTabs = stages.filter((s) => !["Registration", "Completed"].includes(s));

  const inEdition = activeYear ? allRegs.filter((r) => r.edition_year === activeYear) : allRegs;
  const needle = (q ?? "").trim().toLowerCase();
  const filtered = inEdition.filter((r) => {
    if (!needle) return true;
    const haystack = [
      r.schools?.name,
      r.contact_email,
      ...(Array.isArray(r.reps) ? (r.reps as Rep[]).map((rep) => rep.name) : []),
    ];
    return haystack.some((v) => v?.toLowerCase().includes(needle));
  });

  // School-level stage results for EVERY filtered school (not just the page), so
  // each school's standing — and which stage tab it belongs to, across pages —
  // is known for the tab filters and "select all matching".
  const filteredIds = filtered.map((r) => r.id);
  const { data: schoolStageRows } = filteredIds.length
    ? await supabase
        .from("registration_stage_results")
        .select("id, registration_id, stage, outcome, score, note")
        .in("registration_id", filteredIds)
    : { data: [] as StageResult[] };
  const schoolResultsByReg = new Map<string, StageResult[]>();
  for (const r of (schoolStageRows ?? []) as StageResult[]) {
    const list = schoolResultsByReg.get(r.registration_id) ?? [];
    list.push(r);
    schoolResultsByReg.set(r.registration_id, list);
  }
  const standingByReg = new Map<string, { index: number; label: string }>();
  for (const r of filtered) {
    standingByReg.set(r.id, standing(schoolResultsByReg.get(r.id) ?? [], stageTabs));
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(parsePage(pageParam), pageCount);
  const pageRegs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Roster + student results + certificates only for the schools on this page.
  const regIds = pageRegs.map((r) => r.id);
  const schoolIds = pageRegs.map((r) => r.school_id).filter(Boolean) as string[];

  const [{ data: studentRows }, { data: certRows }] = await Promise.all([
    schoolIds.length
      ? supabase
          .from("students")
          .select("id, school_id, name, level")
          .in("school_id", schoolIds)
          .is("deactivated_at", null)
          .order("name")
      : Promise.resolve({ data: [] as RosterStudentRow[] }),
    regIds.length
      ? supabase
          .from("certificates")
          .select("id, registration_id, student_id, type")
          .in("registration_id", regIds)
      : Promise.resolve({ data: [] as CertRow[] }),
  ]);

  const students = (studentRows ?? []) as RosterStudentRow[];
  const studentIds = students.map((s) => s.id);
  const { data: studentStageRows } = studentIds.length
    ? await supabase
        .from("student_stage_results")
        .select("id, student_id, stage, outcome, score, note")
        .in("student_id", studentIds)
    : { data: [] as StudentStageResult[] };

  const studentsBySchool = new Map<string, RosterStudent[]>();
  for (const s of students) {
    const list = studentsBySchool.get(s.school_id) ?? [];
    list.push({ id: s.id, name: s.name, level: s.level });
    studentsBySchool.set(s.school_id, list);
  }
  const studentResultsById: Record<string, StudentStageResult[]> = {};
  for (const r of (studentStageRows ?? []) as StudentStageResult[]) {
    (studentResultsById[r.student_id] ??= []).push(r);
  }
  const schoolCertsByReg: Record<string, { id: string; type: string | null }[]> = {};
  const studentCertsById: Record<string, { id: string; type: string | null }[]> = {};
  for (const c of (certRows ?? []) as CertRow[]) {
    if (c.student_id) (studentCertsById[c.student_id] ??= []).push({ id: c.id, type: c.type });
    else (schoolCertsByReg[c.registration_id] ??= []).push({ id: c.id, type: c.type });
  }

  const metaOf = (r: ParticipantReg) =>
    [r.schools?.lga, r.schools?.category, r.edition_year].filter(Boolean).join(" · ");
  const rosterOf = (r: ParticipantReg) =>
    r.school_id ? studentsBySchool.get(r.school_id) ?? [] : [];

  // ── Overview: every school, its standing + full timeline (read-only) ──────
  const overviewTab = (
    <div className="space-y-3">
      {pageRegs.map((r) => {
        const results = schoolResultsByReg.get(r.id) ?? [];
        const st = standingByReg.get(r.id);
        // Schools that cleared every stage have no stage-tab card, so surface the
        // "send back" here (targets the last contestable stage).
        const completed = st != null && stageTabs.length > 0 && st.index >= stageTabs.length;
        return (
          <Card key={r.id} className="p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bebas text-xl text-foreground">
                {r.schools?.name ?? "Unassigned school"}
              </span>
              <span className="text-xs text-muted-foreground">
                {st?.label} · {rosterOf(r).length} reps · {metaOf(r)}
              </span>
            </div>
            {results.length ? (
              <StageResults stages={stages} results={results} />
            ) : (
              <p className="text-sm text-muted-foreground">Not marked at any stage yet.</p>
            )}
            {completed ? (
              <form action={sendSchoolBack.bind(null, r.id)}>
                <input type="hidden" name="from_stage" value={stageTabs[stageTabs.length - 1]} />
                <ConfirmSubmitButton
                  size="sm"
                  variant="ghost"
                  destructive
                  className="h-auto p-0 text-xs uppercase tracking-wide hover:bg-transparent hover:underline"
                  title={`Send back to ${stageTabs[stageTabs.length - 1]}?`}
                  description={`Clears this school's result at the ${stageTabs[stageTabs.length - 1]} — reps included — and returns it to that stage to be re-decided.`}
                  confirmLabel="Yes, send back"
                >
                  ↩ Send back to {stageTabs[stageTabs.length - 1]}
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </Card>
        );
      })}
    </div>
  );

  // ── One tab per stage: only the schools currently AT that stage ───────────
  const stageTabDefs = stageTabs.map((stage, stageIndex) => {
    const bulkId = `bulk-${stage.replace(/\s+/g, "-").toLowerCase()}`;
    const here = pageRegs.filter((r) => standingByReg.get(r.id)?.index === stageIndex);
    const matchingIds = filtered
      .filter((r) => standingByReg.get(r.id)?.index === stageIndex)
      .map((r) => r.id);
    return {
      label: `${stage} (${matchingIds.length})`,
      content:
        here.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No schools are currently at the {stage}
            {matchingIds.length > here.length ? " on this page" : ""}. As schools advance from the
            previous stage they appear here.
          </p>
        ) : (
          <div>
            <form id={bulkId} action={bulkRegistrationDecision}>
              <input type="hidden" name="stage" value={stage} />
              <Card className="p-4 mb-6">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <SelectAllCheckbox formId={bulkId} targetName="ids" />
                  {matchingIds.length > here.length ? (
                    <SelectAllMatching formId={bulkId} ids={matchingIds} />
                  ) : null}
                  <p className="text-sm text-muted-foreground flex-1 min-w-40">
                    Tick schools, then mark them at the{" "}
                    <span className="font-bold text-foreground">{stage}</span> (reps are marked
                    separately below):
                  </p>
                  <ConfirmDecisionButton
                    name="decision"
                    value="advance"
                    size="sm"
                    variant="outline"
                    title={`Mark selected advanced at ${stage}?`}
                    description="Records the ticked schools as advanced past this stage (moving them to the next stage) and notifies each coordinator. Reps are unaffected — advance them per school below."
                    confirmLabel="Yes, mark advanced"
                  >
                    Mark advanced
                  </ConfirmDecisionButton>
                  <ConfirmDecisionButton
                    name="decision"
                    value="eliminate"
                    size="sm"
                    variant="outline"
                    destructive
                    title={`Mark selected not advanced at ${stage}?`}
                    description="Records the ticked schools as not advancing past this stage and notifies each coordinator. Portal access stays open."
                    confirmLabel="Yes, mark"
                  >
                    Mark not advanced
                  </ConfirmDecisionButton>
                </div>
              </Card>
            </form>

            <div className="space-y-6">
              {here.map((r) => (
                <div key={r.id} className="flex gap-3">
                  <input
                    type="checkbox"
                    name="ids"
                    value={r.id}
                    form={bulkId}
                    aria-label={`Select ${r.schools?.name ?? "school"}`}
                    className="mt-6 size-4 accent-primary shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <StageSchoolCard
                      registrationId={r.id}
                      schoolName={r.schools?.name ?? "Unassigned school"}
                      meta={metaOf(r)}
                      stage={stage}
                      prevStage={stageIndex > 0 ? stageTabs[stageIndex - 1] : null}
                      schoolResults={schoolResultsByReg.get(r.id) ?? []}
                      students={rosterOf(r)}
                      studentResultsById={studentResultsById}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
    };
  });

  // ── Certificates: any school / any rep, regardless of stage ───────────────
  const certificatesTab = (
    <div className="space-y-6">
      {pageRegs.map((r) => (
        <SchoolCertificatesCard
          key={r.id}
          registrationId={r.id}
          schoolName={r.schools?.name ?? "Unassigned school"}
          students={rosterOf(r)}
          schoolCerts={schoolCertsByReg[r.id] ?? []}
          studentCertsById={studentCertsById}
        />
      ))}
    </div>
  );

  const tabs = [
    { label: `Overview (${filtered.length})`, content: overviewTab },
    ...stageTabDefs,
    { label: "Certificates", content: certificatesTab },
  ];

  return (
    <>
      <PortalHeader
        title="Participants"
        subtitle="The current edition's competition hub — each school sits on its current stage; advance it to move it on"
      />
      <PortalBody>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <SectionHeading>
              {filtered.length} approved school{filtered.length === 1 ? "" : "s"}
              {activeEdition ? ` · ${activeEdition.year}` : ""}
            </SectionHeading>
            {activeEdition ? (
              <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Current stage: <span className="text-gold-ink">{activeEdition.current_stage}</span>
              </span>
            ) : null}
          </div>

          {years.length > 1 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {years.map((y) => (
                <Link
                  key={y}
                  href={`/portal/admin/participants?edition=${y}`}
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                    activeYear === y
                      ? "bg-primary/15 text-gold-ink"
                      : "bg-foreground/5 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {y}
                </Link>
              ))}
            </div>
          ) : null}

          <FilterBar q={q} placeholder="Search school, email, or rep…" preserve={{ edition }} />

          {pageRegs.length === 0 ? (
            <EmptyState title={needle ? "No matches" : "No approved schools yet"}>
              {needle
                ? "No approved schools match your search."
                : "Schools appear here once approved in Registrations at close of review."}
            </EmptyState>
          ) : (
            <SettingsTabs tabs={tabs} />
          )}

          {pageCount > 1 ? (
            <p className="text-xs text-muted-foreground mt-4">
              Showing page {page} of {pageCount} — narrow with search to see more per page.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground mt-2">
            Shows schools approved for the competition. Accept entries under{" "}
            <Link href="/portal/admin/registrations" className="text-primary hover:underline">
              Registrations
            </Link>
            .
          </p>
        </div>
      </PortalBody>
    </>
  );
}

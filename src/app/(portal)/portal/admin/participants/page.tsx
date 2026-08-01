import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
  StatTile,
} from "@/components/portal/ui";
import SettingsTabs from "@/components/portal/settings-tabs";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { SubmitButton } from "@/components/portal/submit-button";
import { FilterBar, Pagination, clampPage, parsePage } from "@/components/portal/list-controls";
import { ReadOnlyBadge } from "@/components/portal/read-only-badge";
import { SchoolCertificatesCard, type RosterStudent } from "@/components/portal/participant-school-card";
import { pageMetadata } from "@/lib/seo";
import { searchHaystackMatches, searchTokens } from "@/lib/search";
import { createClient } from "@/supabase/server";
import { canManageModule, requireModuleView } from "@/supabase/auth";
import {
  advanceGroupEntries,
  assignGroupEntry,
  createTournamentGroup,
  createTournamentMatch,
  issueIndividualAward,
  recordMatchResult,
  saveQualificationDecision,
  updateGroupEntry,
} from "../actions";
import {
  QUALIFICATION_REASONS,
  type Edition,
  type IndividualAward,
  type Rep,
  type StageOutcome,
  type StageResult,
  type TournamentGroup,
  type TournamentGroupEntry,
  type TournamentMatch,
} from "@/supabase/types";

export const metadata = pageMetadata("Participants", "Run the competition after approval.");
export const dynamic = "force-dynamic";

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary";
const compactInputCls =
  "rounded-md border border-foreground/15 bg-background px-2 py-1 text-xs outline-none focus:border-primary";
const PAGE_SIZE = 20;

interface ParticipantReg {
  id: string;
  edition_year: number;
  reps: unknown;
  details: Record<string, string> | null;
  qualification_zone: string | null;
  contact_email: string | null;
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

const BOOKENDS = new Set(["Registration", "Completed"]);
const KNOCKOUT_LABELS = new Set(["Round of 24", "Round of 16", "Quarter Finals", "Semi Finals", "Finals"]);

function detailsValue(details: Record<string, string> | null, key: string) {
  const value = details?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function zoneOf(r: ParticipantReg) {
  return (
    r.qualification_zone ||
    detailsValue(r.details, "Zonal Finals Location") ||
    detailsValue(r.details, "Which center do you prefer for the Zonal Final Exam?  ") ||
    r.schools?.lga ||
    "Unassigned"
  );
}

function stageTabs(stages: string[]) {
  return stages.filter((s) => !BOOKENDS.has(s));
}

function standing(results: StageResult[], stages: string[]) {
  for (let i = 0; i < stages.length; i++) {
    const outcome = results.find((r) => r.stage === stages[i])?.outcome;
    if (outcome === "eliminated") return { index: i, stage: stages[i], label: `Out at ${stages[i]}` };
    if (outcome !== "advanced") return { index: i, stage: stages[i], label: `At ${stages[i]}` };
  }
  return { index: stages.length, stage: "Completed", label: "Champion / completed" };
}

function resultAt(results: StageResult[], stage: string) {
  return results.find((r) => r.stage === stage) ?? null;
}

function outcomeLabel(outcome?: StageOutcome | null) {
  if (outcome === "advanced") return "Advanced";
  if (outcome === "eliminated") return "Not advanced";
  if (outcome === "pending") return "Pending";
  return "Unmarked";
}

function outcomeClass(outcome?: StageOutcome | null) {
  if (outcome === "advanced") return "bg-green-100 text-green-800 border-green-600/30";
  if (outcome === "eliminated") return "bg-red-100 text-red-800 border-red-600/30";
  if (outcome === "pending") return "bg-primary/15 text-gold-ink border-primary/30";
  return "bg-foreground/5 text-muted-foreground border-foreground/10";
}

function OutcomePill({ outcome }: { outcome?: StageOutcome | null }) {
  return (
    <span className={`border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${outcomeClass(outcome)}`}>
      {outcomeLabel(outcome)}
    </span>
  );
}

function sortedGroups(groups: TournamentGroup[]) {
  return [...groups].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function sortedEntries(entries: TournamentGroupEntry[]) {
  return [...entries].sort((a, b) => {
    const ar = a.rank ?? 999;
    const br = b.rank ?? 999;
    return ar - br || (a.seed ?? 999) - (b.seed ?? 999);
  });
}

export default async function AdminParticipants({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edition?: string; page?: string }>;
}) {
  await requireModuleView("participants");
  const canManage = await canManageModule("participants");
  const { q, edition, page: pageParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: editionData }, { data: regRows }] = await Promise.all([
    supabase
      .from("editions")
      .select("year, title, registration_open, stages, current_stage")
      .order("year", { ascending: false }),
    supabase
      .from("registrations")
      .select("id, edition_year, reps, details, qualification_zone, contact_email, school_id, schools(name, lga, category)")
      .eq("status", "verified")
      .order("edition_year", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const editions = (editionData ?? []) as Edition[];
  const allRegs = (regRows ?? []) as unknown as ParticipantReg[];
  const years = [...new Set(allRegs.map((r) => r.edition_year))].sort((a, b) => b - a);
  const activeYear = edition ? Number(edition) || null : editions[0]?.year ?? years[0] ?? null;
  const currentYear = editions[0]?.year ?? years[0] ?? null;
  const canEditCompetition = canManage && activeYear != null && activeYear === currentYear;
  const activeEdition = activeYear ? editions.find((e) => e.year === activeYear) ?? null : null;
  const stages = stageTabs(activeEdition?.stages ?? []);
  const inEdition = activeYear ? allRegs.filter((r) => r.edition_year === activeYear) : allRegs;
  const needle = searchTokens(q).join(" ");
  const filtered = inEdition.filter((r) => {
    if (!needle) return true;
    const reps = Array.isArray(r.reps) ? (r.reps as Rep[]).map((rep) => rep.name) : [];
    return searchHaystackMatches([r.schools?.name, r.contact_email, zoneOf(r), ...reps], q);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = clampPage(parsePage(pageParam), pageCount);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const listParams = { edition, q };

  const regIds = filtered.map((r) => r.id);
  const schoolIds = filtered.map((r) => r.school_id).filter(Boolean) as string[];

  const [
    { data: stageRows },
    { data: studentRows },
    { data: certRows },
    { data: groupRows },
    { data: entryRows },
    { data: matchRows },
    { data: awardRows },
  ] = await Promise.all([
    regIds.length
      ? supabase
          .from("registration_stage_results")
          .select("id, registration_id, stage, outcome, score, note, reason")
          .in("registration_id", regIds)
      : Promise.resolve({ data: [] as StageResult[] }),
    schoolIds.length
      ? supabase.from("students").select("id, school_id, name, level").in("school_id", schoolIds).is("deactivated_at", null).order("name")
      : Promise.resolve({ data: [] as RosterStudentRow[] }),
    regIds.length
      ? supabase.from("certificates").select("id, registration_id, student_id, type").in("registration_id", regIds)
      : Promise.resolve({ data: [] as CertRow[] }),
    activeYear
      ? supabase.from("tournament_groups").select("id, edition_year, stage, name, sort_order, advance_count").eq("edition_year", activeYear)
      : Promise.resolve({ data: [] as TournamentGroup[] }),
    activeYear
      ? supabase.from("tournament_group_entries").select("id, group_id, registration_id, seed, rank, score, note, advance_override")
      : Promise.resolve({ data: [] as TournamentGroupEntry[] }),
    activeYear
      ? supabase
          .from("tournament_matches")
          .select("id, edition_year, stage, kind, team_a_registration_id, team_b_registration_id, team_a_score, team_b_score, winner_registration_id, status, scheduled_at, venue, note, parent_match_id, slot, superseded_at")
          .eq("edition_year", activeYear)
          .order("stage")
          .order("slot")
      : Promise.resolve({ data: [] as TournamentMatch[] }),
    activeYear
      ? supabase.from("individual_awards").select("id, edition_year, student_id, registration_id, stage, title, note").eq("edition_year", activeYear)
      : Promise.resolve({ data: [] as IndividualAward[] }),
  ]);

  const regsById = new Map(filtered.map((r) => [r.id, r]));
  const resultsByReg = new Map<string, StageResult[]>();
  for (const row of (stageRows ?? []) as StageResult[]) {
    const list = resultsByReg.get(row.registration_id) ?? [];
    list.push(row);
    resultsByReg.set(row.registration_id, list);
  }
  const standingByReg = new Map(filtered.map((r) => [r.id, standing(resultsByReg.get(r.id) ?? [], stages)]));

  const studentsBySchool = new Map<string, RosterStudent[]>();
  for (const s of (studentRows ?? []) as RosterStudentRow[]) {
    const list = studentsBySchool.get(s.school_id) ?? [];
    list.push({ id: s.id, name: s.name, level: s.level });
    studentsBySchool.set(s.school_id, list);
  }
  const students = (studentRows ?? []) as RosterStudentRow[];
  const schoolCertsByReg: Record<string, { id: string; type: string | null }[]> = {};
  const studentCertsById: Record<string, { id: string; type: string | null }[]> = {};
  for (const c of (certRows ?? []) as CertRow[]) {
    if (c.student_id) (studentCertsById[c.student_id] ??= []).push({ id: c.id, type: c.type });
    else (schoolCertsByReg[c.registration_id] ??= []).push({ id: c.id, type: c.type });
  }

  const groups = (groupRows ?? []) as TournamentGroup[];
  const entries = (entryRows ?? []) as TournamentGroupEntry[];
  const matches = (matchRows ?? []) as TournamentMatch[];
  const awards = (awardRows ?? []) as IndividualAward[];
  const entriesByGroup = new Map<string, TournamentGroupEntry[]>();
  for (const entry of entries) {
    if (!regsById.has(entry.registration_id)) continue;
    const list = entriesByGroup.get(entry.group_id) ?? [];
    list.push(entry);
    entriesByGroup.set(entry.group_id, list);
  }
  const assignedRegIds = new Set(entries.map((e) => e.registration_id));
  const qualifiedRegs = filtered.filter((r) => resultAt(resultsByReg.get(r.id) ?? [], "Qualifications")?.outcome === "advanced");
  const unassignedQualified = qualifiedRegs.filter((r) => !assignedRegIds.has(r.id));
  const knockoutStages = stages.filter((s) => KNOCKOUT_LABELS.has(s));
  const atQualifications = filtered.filter((r) => standingByReg.get(r.id)?.stage === "Qualifications").length;
  const eliminated = filtered.filter((r) => (resultsByReg.get(r.id) ?? []).some((res) => res.outcome === "eliminated")).length;
  const inKnockouts = filtered.filter((r) => KNOCKOUT_LABELS.has(standingByReg.get(r.id)?.stage ?? "")).length;
  const champion = filtered.filter((r) => resultAt(resultsByReg.get(r.id) ?? [], "Finals")?.outcome === "advanced").length;
  const groupStageTotal = assignedRegIds.size + unassignedQualified.length;
  const schoolName = (id?: string | null) => (id ? regsById.get(id)?.schools?.name ?? "Unknown school" : "Unassigned");
  const rosterOf = (r: ParticipantReg) => (r.school_id ? studentsBySchool.get(r.school_id) ?? [] : []);

  const overviewTab = (
    <div className="grid gap-3">
      {paged.map((r) => {
        const current = standingByReg.get(r.id);
        const results = resultsByReg.get(r.id) ?? [];
        return (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bebas text-2xl leading-none text-foreground">{r.schools?.name ?? "Unassigned school"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {zoneOf(r)} · {r.schools?.category ?? "School"} · {rosterOf(r).length} reps
                </p>
              </div>
              <span className="rounded-md border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-foreground">
                {current?.label ?? "At Qualifications"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {stages.map((stage) => (
                <span key={stage} className="inline-flex items-center gap-2 border border-foreground/10 px-2 py-1 text-xs">
                  {stage}
                  <OutcomePill outcome={resultAt(results, stage)?.outcome} />
                </span>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );

  const qualificationsTab = (
    <div className="space-y-4">
      {paged.map((r) => {
        const result = resultAt(resultsByReg.get(r.id) ?? [], "Qualifications");
        return (
          <Card key={r.id} className="p-4">
            <form action={saveQualificationDecision.bind(null, r.id)} className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(120px,0.7fr))_auto] lg:items-end">
              <div className="min-w-0">
                <p className="font-bebas text-xl leading-none text-foreground">{r.schools?.name ?? "Unassigned school"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{r.schools?.lga ?? "No LGA"} · {r.schools?.category ?? "School"} · {rosterOf(r).length} reps</p>
              </div>
              <label className="text-xs text-muted-foreground">
                Zone
                <input name="zone" defaultValue={zoneOf(r)} className={`mt-1 w-full ${inputCls}`} />
              </label>
              <label className="text-xs text-muted-foreground">
                Score
                <input name="score" type="number" step="any" defaultValue={result?.score ?? ""} className={`mt-1 w-full ${inputCls}`} />
              </label>
              <label className="text-xs text-muted-foreground">
                Reason
                <select name="reason" defaultValue={result?.reason ?? ""} className={`mt-1 w-full ${inputCls}`}>
                  <option value="">No reason</option>
                  {QUALIFICATION_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Outcome
                <select name="outcome" defaultValue={result?.outcome ?? "pending"} className={`mt-1 w-full ${inputCls}`}>
                  <option value="pending">Pending</option>
                  <option value="advanced">Advance to Grand Finale</option>
                  <option value="eliminated">Not advanced</option>
                </select>
              </label>
              <div className="flex items-center gap-2 lg:justify-end">
                <OutcomePill outcome={result?.outcome} />
                {canEditCompetition ? <SubmitButton size="sm" pendingText="Saving…">Save</SubmitButton> : <ReadOnlyBadge />}
              </div>
              <label className="lg:col-span-full text-xs text-muted-foreground">
                Note
                <input name="note" defaultValue={result?.note ?? ""} className={`mt-1 w-full ${inputCls}`} />
              </label>
            </form>
          </Card>
        );
      })}
    </div>
  );

  const groupsTab = (
    <div className="space-y-6">
      {canEditCompetition ? (
        <Card className="p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bebas text-2xl leading-none text-foreground">Group setup</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create Grand Finale groups, then place schools that advanced from Qualifications.
              </p>
            </div>
            <span className="rounded-md border border-foreground/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {unassignedQualified.length} waiting
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="border border-foreground/10 bg-background/50 p-3">
              <p className="mb-3 text-sm font-semibold text-foreground">Create or update a group</p>
              <form action={createTournamentGroup} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_110px] sm:items-end">
                <input type="hidden" name="edition_year" value={activeYear ?? ""} />
                <label className="text-xs text-muted-foreground">
                  Group name
                  <input name="name" placeholder="Group A" className={`mt-1 w-full ${inputCls}`} />
                </label>
                <label className="text-xs text-muted-foreground">
                  Teams to advance
                  <input name="advance_count" type="number" min="0" defaultValue="2" className={`mt-1 w-full ${inputCls}`} />
                </label>
                <label className="text-xs text-muted-foreground">
                  Display order
                  <input name="sort_order" type="number" defaultValue={groups.length + 1} className={`mt-1 w-full ${inputCls}`} />
                </label>
                <div className="sm:col-span-full">
                  <SubmitButton size="sm" pendingText="Saving…">Save group</SubmitButton>
                </div>
              </form>
            </div>
            <div className="border border-foreground/10 bg-background/50 p-3">
              <p className="mb-3 text-sm font-semibold text-foreground">Assign a school to a group</p>
              {groups.length && unassignedQualified.length ? (
                <form action={assignGroupEntry} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_150px] sm:items-end">
                  <label className="text-xs text-muted-foreground">
                    School waiting for group
                    <select name="registration_id" className={`mt-1 w-full ${inputCls}`}>
                      {unassignedQualified.map((r) => <option key={r.id} value={r.id}>{r.schools?.name ?? "Unassigned school"}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Group
                    <select name="group_id" className={`mt-1 w-full ${inputCls}`}>
                      {sortedGroups(groups).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Starting position
                    <input name="seed" type="number" min="1" placeholder="Optional" className={`mt-1 w-full ${inputCls}`} />
                  </label>
                  <div className="sm:col-span-full flex flex-wrap items-center gap-3">
                    <SubmitButton size="sm" pendingText="Assigning…">Assign to group</SubmitButton>
                    <p className="text-xs text-muted-foreground">Use starting position only when you want a manual order inside the group.</p>
                  </div>
                </form>
              ) : !groups.length ? (
                <p className="text-sm text-muted-foreground">Create a group first, then assign qualified schools here.</p>
              ) : (
                <p className="text-sm text-muted-foreground">All qualified schools in this view are already assigned.</p>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {unassignedQualified.length ? (
        <Card className="border border-primary/25 bg-primary/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bebas text-2xl leading-none text-foreground">
                Ready for group assignment
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                These schools advanced from Qualifications. Create a Grand Finale group, then assign
                them here.
              </p>
            </div>
            <span className="rounded-md bg-background px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold-ink">
              {unassignedQualified.length} waiting
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unassignedQualified.map((r) => (
              <div key={r.id} className="border border-foreground/10 bg-background px-3 py-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {r.schools?.name ?? "Unassigned school"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {zoneOf(r)} · {rosterOf(r).length} reps
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState title="No groups yet">Create a group to place qualified schools.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sortedGroups(groups).map((group) => {
            const groupEntries = sortedEntries(entriesByGroup.get(group.id) ?? []);
            return (
              <Card key={group.id} className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bebas text-2xl leading-none text-foreground">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Top {group.advance_count} team{group.advance_count === 1 ? "" : "s"} advance, with manual overrides.
                    </p>
                  </div>
                  {canEditCompetition ? (
                    <form action={advanceGroupEntries.bind(null, group.id)}>
                      <ConfirmSubmitButton
                        size="sm"
                        title={`Advance ${group.name}?`}
                        description="Marks advancing teams past Grand Finale Group Stage and marks the rest not advanced. Manual overrides win over rank."
                        confirmLabel="Yes, apply"
                      >
                        Apply advancement
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {groupEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No teams assigned.</p>
                  ) : groupEntries.map((entry) => (
                    <form key={entry.id} action={updateGroupEntry.bind(null, entry.id)} className="grid gap-2 border border-foreground/10 bg-background/50 p-2 md:grid-cols-[minmax(0,1fr)_60px_80px_110px_auto] md:items-center">
                      <span className="min-w-0 text-sm font-medium text-foreground">{schoolName(entry.registration_id)}</span>
                      <input name="rank" type="number" defaultValue={entry.rank ?? ""} placeholder="Rank" className={compactInputCls} />
                      <input name="score" type="number" step="any" defaultValue={entry.score ?? ""} placeholder="Score" className={compactInputCls} />
                      <select name="advance_override" defaultValue={entry.advance_override === true ? "advance" : entry.advance_override === false ? "hold" : ""} className={compactInputCls}>
                        <option value="">Auto</option>
                        <option value="advance">Advance</option>
                        <option value="hold">Hold</option>
                      </select>
                      {canEditCompetition ? <SubmitButton size="sm" variant="outline" pendingText="Saving…">Save</SubmitButton> : null}
                      <input name="note" defaultValue={entry.note ?? ""} placeholder="Note" className={`md:col-span-full ${compactInputCls}`} />
                    </form>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const bracketTab = (
    <div className="space-y-6">
      {canEditCompetition ? (
        <Card className="p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bebas text-2xl leading-none text-foreground">Bracket setup</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add knockout matches, or move a school directly into the selected round.
              </p>
            </div>
            <span className="rounded-md border border-foreground/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {matches.filter((m) => m.kind !== "face_off").length} bracket item{matches.filter((m) => m.kind !== "face_off").length === 1 ? "" : "s"}
            </span>
          </div>
          <form action={createTournamentMatch} className="grid gap-3 lg:grid-cols-[150px_160px_minmax(180px,1fr)_minmax(180px,1fr)_120px_minmax(160px,1fr)_auto] lg:items-end">
            <input type="hidden" name="edition_year" value={activeYear ?? ""} />
            <label className="text-xs text-muted-foreground">
              Knockout round
              <select name="stage" className={`mt-1 w-full ${inputCls}`}>
                {knockoutStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              What is happening?
              <select name="kind" className={`mt-1 w-full ${inputCls}`}>
                <option value="knockout">Create a match</option>
                <option value="bye">Advance a school directly</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              First school
              <select name="team_a_registration_id" className={`mt-1 w-full ${inputCls}`}>
                {filtered.map((r) => <option key={r.id} value={r.id}>{r.schools?.name ?? "Unassigned school"}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Opponent
              <select name="team_b_registration_id" className={`mt-1 w-full ${inputCls}`}>
                <option value="">No opponent / direct advance</option>
                {filtered.map((r) => <option key={r.id} value={r.id}>{r.schools?.name ?? "Unassigned school"}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Match position
              <input name="slot" type="number" min="1" placeholder="Optional" className={`mt-1 w-full ${inputCls}`} />
            </label>
            <label className="text-xs text-muted-foreground">
              Venue
              <input name="venue" placeholder="Optional" className={`mt-1 w-full ${inputCls}`} />
            </label>
            <SubmitButton size="sm" pendingText="Creating…">Add to bracket</SubmitButton>
          </form>
        </Card>
      ) : null}

      {knockoutStages.length === 0 ? (
        <EmptyState title="No knockout stages configured" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {knockoutStages.map((stage) => {
            const stageMatches = matches.filter((m) => m.stage === stage && m.kind !== "face_off");
            return (
              <Card key={stage} className="p-4">
                <p className="font-bebas text-2xl leading-none text-foreground">{stage}</p>
                <div className="mt-3 space-y-3">
                  {stageMatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No matches or direct advances yet.</p>
                  ) : stageMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      schoolName={schoolName}
                      canManage={canEditCompetition}
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const faceOffTab = (
    <div className="space-y-4">
      {canEditCompetition ? (
        <Card className="p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-bebas text-2xl leading-none text-foreground">Face-off setup</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a tie-breaker when two schools need one final decision for the same stage.
              </p>
            </div>
            <span className="rounded-md border border-foreground/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {matches.filter((m) => m.kind === "face_off").length} face-off{matches.filter((m) => m.kind === "face_off").length === 1 ? "" : "s"}
            </span>
          </div>
          <form action={createTournamentMatch} className="grid gap-3 md:grid-cols-[150px_minmax(180px,1fr)_minmax(180px,1fr)_minmax(160px,1fr)_auto] md:items-end">
            <input type="hidden" name="edition_year" value={activeYear ?? ""} />
            <input type="hidden" name="kind" value="face_off" />
            <label className="text-xs text-muted-foreground">
              Decision stage
              <select name="stage" className={`mt-1 w-full ${inputCls}`}>
                {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              First school
              <select name="team_a_registration_id" className={`mt-1 w-full ${inputCls}`}>
                {filtered.map((r) => <option key={r.id} value={r.id}>{r.schools?.name ?? "Unassigned school"}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Second school
              <select name="team_b_registration_id" className={`mt-1 w-full ${inputCls}`}>
                {filtered.map((r) => <option key={r.id} value={r.id}>{r.schools?.name ?? "Unassigned school"}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Reason
              <input name="note" placeholder="Tie-breaker reason" className={`mt-1 w-full ${inputCls}`} />
            </label>
            <SubmitButton size="sm" pendingText="Creating…">Add face-off</SubmitButton>
          </form>
        </Card>
      ) : null}
      {matches.filter((m) => m.kind === "face_off").length === 0 ? (
        <EmptyState title="No face-offs yet" />
      ) : (
        <div className="grid gap-3">
          {matches.filter((m) => m.kind === "face_off").map((match) => (
            <MatchCard key={match.id} match={match} schoolName={schoolName} canManage={canEditCompetition} />
          ))}
        </div>
      )}
    </div>
  );

  const certificatesTab = (
    <div className="space-y-6">
      {canEditCompetition ? (
        <Card className="p-4">
          <form action={issueIndividualAward} className="grid gap-2 md:grid-cols-[minmax(180px,1fr)_160px_minmax(160px,1fr)_minmax(160px,1fr)_auto] md:items-end">
            <input type="hidden" name="edition_year" value={activeYear ?? ""} />
            <label className="text-xs text-muted-foreground">
              Rep
              <select name="student_id" className={`mt-1 w-full ${inputCls}`}>
                {students.map((s) => {
                  const reg = filtered.find((r) => r.school_id === s.school_id);
                  return <option key={s.id} value={s.id}>{s.name} · {reg?.schools?.name ?? "School"}</option>;
                })}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Stage
              <select name="stage" className={`mt-1 w-full ${inputCls}`}>
                <option value="">Whole edition</option>
                {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Award
              <input name="title" required placeholder="Top Scorer" className={`mt-1 w-full ${inputCls}`} />
            </label>
            <label className="text-xs text-muted-foreground">
              Note
              <input name="note" className={`mt-1 w-full ${inputCls}`} />
            </label>
            <SubmitButton size="sm" pendingText="Saving…">Add award</SubmitButton>
          </form>
          {awards.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {awards.map((award) => {
                const student = students.find((s) => s.id === award.student_id);
                return (
                  <span key={award.id} className="border border-foreground/10 bg-background px-2 py-1 text-xs text-muted-foreground">
                    <b className="text-foreground">{award.title}</b> · {student?.name ?? "Rep"}{award.stage ? ` · ${award.stage}` : ""}
                  </span>
                );
              })}
            </div>
          ) : null}
        </Card>
      ) : null}
      {paged.map((r) => (
        <SchoolCertificatesCard
          key={r.id}
          registrationId={r.id}
          schoolName={r.schools?.name ?? "Unassigned school"}
          students={rosterOf(r)}
          schoolCerts={schoolCertsByReg[r.id] ?? []}
          studentCertsById={studentCertsById}
          canManage={canEditCompetition}
        />
      ))}
    </div>
  );

  const tabs = [
    { label: `Overview (${filtered.length})`, content: overviewTab },
    { label: `Qualifications (${atQualifications})`, content: qualificationsTab },
    { label: `Groups (${groupStageTotal})`, content: groupsTab },
    { label: `Bracket (${matches.filter((m) => m.kind !== "face_off").length})`, content: bracketTab },
    { label: `Face-offs (${matches.filter((m) => m.kind === "face_off").length})`, content: faceOffTab },
    { label: "Awards & certificates", content: certificatesTab },
  ];

  return (
    <>
      <PortalHeader
        title="Participants"
        subtitle="Approved school teams start at Qualifications; run zones, groups, matches, awards, and certificates here"
      />
      <PortalBody>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <SectionHeading>{activeYear ? `${activeYear} competition` : "Competition"}</SectionHeading>
            {!canEditCompetition ? <ReadOnlyBadge /> : null}
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
          <FilterBar q={q} placeholder="Search school, zone, email, or rep…" preserve={{ edition }} />
          {canManage && !canEditCompetition ? (
            <Card className="mb-4 border border-foreground/10 bg-foreground/5 p-4">
              <p className="text-sm text-muted-foreground">
                This competition is read-only. Past editions are locked for normal stage, group, bracket, award, and certificate edits.
              </p>
            </Card>
          ) : null}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <StatTile label="Approved" value={inEdition.length} />
            <StatTile label="At Qualifications" value={atQualifications} />
            <StatTile label="Awaiting Group" value={unassignedQualified.length} />
            <StatTile label="In Knockouts" value={inKnockouts} />
            <StatTile label="Eliminated" value={eliminated} />
            <StatTile label="Champion" value={champion} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title={needle ? "No matches" : "No approved schools yet"}>
              {needle ? "No approved participants match your search." : (
                <Button asChild size="sm" variant="outline">
                  <Link href="/portal/admin/registrations">Review registrations</Link>
                </Button>
              )}
            </EmptyState>
          ) : (
            <>
              <SettingsTabs tabs={tabs} />
              <Pagination
                page={page}
                pageCount={pageCount}
                path="/portal/admin/participants"
                params={listParams}
              />
            </>
          )}
        </div>
      </PortalBody>
    </>
  );
}

function MatchCard({
  match,
  schoolName,
  canManage,
}: {
  match: TournamentMatch;
  schoolName: (id?: string | null) => string;
  canManage: boolean;
}) {
  const directAdvance = match.kind === "bye";
  return (
    <div className="border border-foreground/10 bg-background/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground">
            {directAdvance
              ? `${schoolName(match.team_a_registration_id)} advances directly`
              : `${schoolName(match.team_a_registration_id)} vs ${schoolName(match.team_b_registration_id)}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {match.kind === "face_off" ? "Face-off" : directAdvance ? "Advance directly" : "Match"} · {match.status}
            {match.venue ? ` · ${match.venue}` : ""}
          </p>
        </div>
        {match.winner_registration_id ? (
          <span className="border border-green-600/30 bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-800">
            Winner: {schoolName(match.winner_registration_id)}
          </span>
        ) : null}
      </div>
      {canManage && !directAdvance ? (
        <form action={recordMatchResult.bind(null, match.id)} className="mt-3 grid gap-2 md:grid-cols-[80px_80px_minmax(180px,1fr)_140px_minmax(160px,1fr)_auto] md:items-end">
          <input name="team_a_score" type="number" step="any" defaultValue={match.team_a_score ?? ""} placeholder="A score" className={compactInputCls} />
          <input name="team_b_score" type="number" step="any" defaultValue={match.team_b_score ?? ""} placeholder="B score" className={compactInputCls} />
          <select name="winner_registration_id" defaultValue={match.winner_registration_id ?? ""} className={compactInputCls}>
            <option value="">No winner</option>
            {match.team_a_registration_id ? <option value={match.team_a_registration_id}>{schoolName(match.team_a_registration_id)}</option> : null}
            {match.team_b_registration_id ? <option value={match.team_b_registration_id}>{schoolName(match.team_b_registration_id)}</option> : null}
          </select>
          <select name="status" defaultValue={match.status} className={compactInputCls}>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="needs_face_off">Needs face-off</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input name="note" defaultValue={match.note ?? ""} placeholder="Note" className={compactInputCls} />
          <SubmitButton size="sm" pendingText="Saving…">Record result</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

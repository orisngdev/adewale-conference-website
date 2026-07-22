import "server-only";

import { createClient } from "@/supabase/server";
import { requireAdmin } from "@/supabase/auth";
import { tierRank } from "@/lib/resource-access";

// Admin analytics: read-only aggregation over the RLS-respecting server client.
// An admin's is_admin() policy lets these reads see every row, so no
// service-role client is needed. Everything is bucketed/derived in app code
// (ADR-0007); time-series are windowed at the DB so large tables aren't scanned
// in full. Day/week/month boundaries are computed in Africa/Lagos (WAT, UTC+1).

// ── Public shapes ────────────────────────────────────────────────────────────

export type TrendPoint = { label: string; [series: string]: number | string };
export type BarPoint = { label: string; value: number; color?: string };
export type Slice = { name: string; value: number; color?: string };

export type AdminAnalytics = {
  windowLabel: string;
  editionYear: number | null;
  editionYears: number[];
  kpis: {
    registrations: number;
    verified: number;
    schools: number;
    activeStudents: number;
    attempts: number;
    avgScore: number;
    downloads: number;
    certificates: number;
  };
  registrations: {
    trend: TrendPoint[];
    ladder: BarPoint[];
    byEdition: BarPoint[];
    byLga: BarPoint[];
    byCategory: BarPoint[];
    editionTotal: number;
    declined: number;
    waitlistPending: number;
    waitlistNotified: number;
  };
  growth: {
    usersByRole: TrendPoint[];
    roleKeys: { key: string; name: string }[];
    schools: TrendPoint[];
    students: TrendPoint[];
  };
  learning: {
    attempts: TrendPoint[];
    scoreHistogram: BarPoint[];
    modeSplit: Slice[];
    flagged: number;
    flaggedPct: number;
    downloads: TrendPoint[];
    labCompletions: number;
    planStatus: Slice[];
  };
  students: {
    activeTrend: TrendPoint[];
    engagementByFeature: BarPoint[];
  };
  challenges: {
    activityTrend: TrendPoint[];
    participation: BarPoint[];
    entryStatus: Slice[];
  };
};

// ── WAT bucketing ────────────────────────────────────────────────────────────

type Gran = "day" | "week" | "month";
const WAT_OFFSET_MS = 60 * 60 * 1000; // +01:00, no DST
const DAY_MS = 86_400_000;

// Hard ceiling on rows pulled per chart query, so a runaway table can never OOM
// the request. Headline KPI numbers come from exact count() queries (below), not
// from row length, so they stay correct even when a chart read is capped to the
// most-recent MAX_ROWS. See ADR-0007 for the SQL-side escalation path.
const MAX_ROWS = 50_000;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A Date whose UTC fields read as the WAT wall-clock of `iso`. */
function watDate(iso: string): Date {
  return new Date(new Date(iso).getTime() + WAT_OFFSET_MS);
}
function dayStartMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function weekStartMs(d: Date): number {
  const back = (d.getUTCDay() + 6) % 7; // days since Monday
  return dayStartMs(d) - back * DAY_MS;
}
function monthIdx(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}
function bucketKey(iso: string, gran: Gran): number {
  const d = watDate(iso);
  return gran === "month" ? monthIdx(d) : gran === "week" ? weekStartMs(d) : dayStartMs(d);
}
function bucketLabel(key: number, gran: Gran): string {
  if (gran === "month") return `${MON[key % 12]} '${String(Math.floor(key / 12)).slice(2)}`;
  const d = new Date(key);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}
function granFor(sinceDays: number | null): Gran {
  if (sinceDays == null) return "month";
  if (sinceDays <= 90) return "day";
  return "week";
}

/** Inclusive sequence of bucket keys from `startISO` (or earliest key) to now. */
function bucketSequence(gran: Gran, startISO: string | null, earliest: number | null): number[] {
  const nowKey = bucketKey(new Date().toISOString(), gran);
  let start: number;
  if (startISO) start = bucketKey(startISO, gran);
  else if (earliest != null) start = earliest;
  else start = nowKey;
  const step = gran === "day" ? DAY_MS : gran === "week" ? 7 * DAY_MS : 1;
  const keys: number[] = [];
  for (let k = start; k <= nowKey && keys.length < 800; k += step) keys.push(k);
  if (keys.length === 0) keys.push(nowKey);
  return keys;
}

function countInto(timestamps: (string | null | undefined)[], gran: Gran): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of timestamps) {
    if (!t) continue;
    const k = bucketKey(t, gran);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Single-series trend, gap-filled across the window. */
function singleTrend(
  timestamps: (string | null | undefined)[],
  gran: Gran,
  startISO: string | null,
  key = "value",
): TrendPoint[] {
  const counts = countInto(timestamps, gran);
  const earliest = counts.size ? Math.min(...counts.keys()) : null;
  return bucketSequence(gran, startISO, earliest).map((k) => ({
    label: bucketLabel(k, gran),
    [key]: counts.get(k) ?? 0,
  })) as TrendPoint[];
}

/** Multi-series trend sharing one bucket axis. */
function multiTrend(
  streams: { key: string; timestamps: (string | null | undefined)[] }[],
  gran: Gran,
  startISO: string | null,
): TrendPoint[] {
  const perStream = streams.map((s) => ({ key: s.key, counts: countInto(s.timestamps, gran) }));
  const allKeys = perStream.flatMap((s) => [...s.counts.keys()]);
  const earliest = allKeys.length ? Math.min(...allKeys) : null;
  return bucketSequence(gran, startISO, earliest).map((k) => {
    const point: TrendPoint = { label: bucketLabel(k, gran) } as TrendPoint;
    for (const s of perStream) point[s.key] = s.counts.get(k) ?? 0;
    return point;
  });
}

/** Distinct-active trend: unique student ids per bucket. */
function activeTrend(
  events: { id: string | null; iso: string | null }[],
  gran: Gran,
  startISO: string | null,
): TrendPoint[] {
  const sets = new Map<number, Set<string>>();
  for (const e of events) {
    if (!e.id || !e.iso) continue;
    const k = bucketKey(e.iso, gran);
    (sets.get(k) ?? sets.set(k, new Set()).get(k)!).add(e.id);
  }
  const earliest = sets.size ? Math.min(...sets.keys()) : null;
  return bucketSequence(gran, startISO, earliest).map((k) => ({
    label: bucketLabel(k, gran),
    value: sets.get(k)?.size ?? 0,
  })) as TrendPoint[];
}

// ── Small helpers ────────────────────────────────────────────────────────────

function topN(counts: Map<string, number>, n: number): BarPoint[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const out: BarPoint[] = sorted.slice(0, n).map(([label, value]) => ({ label: label || "—", value }));
  const rest = sorted.slice(n).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) out.push({ label: "Other", value: rest });
  return out;
}
function tally<T>(rows: T[], keyOf: (r: T) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k == null) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
function distinct(ids: (string | null | undefined)[]): Set<string> {
  const s = new Set<string>();
  for (const id of ids) if (id) s.add(id);
  return s;
}

const WINDOW_LABEL: Record<string, string> = {
  "30": "30 days",
  "90": "90 days",
  "365": "12 months",
};
function windowLabelOf(sinceDays: number | null): string {
  return sinceDays == null ? "All time" : WINDOW_LABEL[String(sinceDays)] ?? `${sinceDays} days`;
}

// ── Row shapes (hand-cast, matching the untyped codebase convention) ─────────

type RegRow = {
  id: string;
  status: string;
  edition_year: number;
  created_at: string;
  schools: { lga: string | null; category: string | null } | null;
};
type AttemptRow = {
  created_at: string;
  score: number | null;
  total: number | null;
  mode: string | null;
  violations: number | null;
  student_user_id: string | null;
};

// ── Main entry ───────────────────────────────────────────────────────────────

export async function getAdminAnalytics(opts: {
  sinceDays: number | null;
  editionYear?: number | null;
}): Promise<AdminAnalytics> {
  const sinceDays = opts.sinceDays;
  const sinceISO = sinceDays == null ? null : new Date(Date.now() - sinceDays * DAY_MS).toISOString();
  const gran = granFor(sinceDays);

  // Defense-in-depth: the admin layout already gates, but these reads bypass
  // nothing — an unexpected non-admin simply gets an empty dashboard.
  const admin = await requireAdmin();
  if (!admin) return emptyAnalytics(sinceDays);

  const supabase = await createClient();

  // Windowed selector: apply .gte only when a finite window is chosen.
  const win = <T extends { gte: (c: string, v: string) => T }>(q: T, col: string) =>
    sinceISO ? q.gte(col, sinceISO) : q;

  const [
    // Exact headline counts — index-backed count() queries, correct at any scale
    // and cheap (no rows transferred). These, not row.length, drive the KPI band.
    regCountRes,
    verifiedCountRes,
    schoolCountRes,
    certCountRes,
    attemptCountRes,
    downloadCountRes,
    // Row reads for charts / derived metrics — capped and ordered newest-first so a
    // capped read keeps the most-recent (most-relevant) rows rather than a random slice.
    regsRes,
    stageRes,
    profilesRes,
    schoolsRes,
    studentsRes,
    attemptsRes,
    downloadsRes,
    labRes,
    techLabRes,
    planRes,
    subsRes,
    entriesRes,
    challengesRes,
    waitlistRes,
    editionsRes,
  ] = await Promise.all([
    supabase.from("registrations").select("id", { count: "exact", head: true }),
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("status", "verified"),
    supabase.from("schools").select("id", { count: "exact", head: true }),
    supabase.from("certificates").select("id", { count: "exact", head: true }),
    win(
      supabase.from("assessment_attempts").select("id", { count: "exact", head: true }).eq("status", "submitted"),
      "created_at",
    ),
    win(supabase.from("resource_downloads").select("id", { count: "exact", head: true }), "created_at"),
    supabase
      .from("registrations")
      .select("id, status, edition_year, created_at, schools(lga, category)")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
    supabase.from("registration_stage_results").select("registration_id, stage, outcome").limit(MAX_ROWS),
    supabase.from("profiles").select("role, created_at").order("created_at", { ascending: false }).limit(MAX_ROWS),
    supabase.from("schools").select("created_at").order("created_at", { ascending: false }).limit(MAX_ROWS),
    supabase
      .from("students")
      .select("created_at, deactivated_at")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
    win(
      supabase
        .from("assessment_attempts")
        .select("created_at, score, total, mode, violations, student_user_id")
        .eq("status", "submitted"),
      "created_at",
    )
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
    win(supabase.from("resource_downloads").select("student_user_id, created_at"), "created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
    win(supabase.from("lab_progress").select("student_user_id, completed_at"), "completed_at")
      .order("completed_at", { ascending: false })
      .limit(MAX_ROWS),
    win(supabase.from("tech_lab_progress").select("student_user_id, completed_at"), "completed_at")
      .order("completed_at", { ascending: false })
      .limit(MAX_ROWS),
    supabase.from("plan_item_progress").select("student_user_id, status, completed_at").limit(MAX_ROWS),
    win(supabase.from("challenge_submissions").select("student_user_id, created_at"), "created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
    win(
      supabase.from("challenge_entries").select("student_user_id, submitted_at, status, challenge_id"),
      "submitted_at",
    )
      .order("submitted_at", { ascending: false })
      .limit(MAX_ROWS),
    supabase.from("challenges").select("id, title"),
    supabase.from("waitlist").select("notified_at").limit(MAX_ROWS),
    supabase.from("editions").select("year").order("year", { ascending: false }),
  ]);

  const regs = (regsRes.data ?? []) as unknown as RegRow[];
  const stageRows = (stageRes.data ?? []) as { registration_id: string; stage: string; outcome: string | null }[];
  const profiles = (profilesRes.data ?? []) as { role: string | null; created_at: string }[];
  const schools = (schoolsRes.data ?? []) as { created_at: string }[];
  const students = (studentsRes.data ?? []) as { created_at: string; deactivated_at: string | null }[];
  const attempts = (attemptsRes.data ?? []) as AttemptRow[];
  const downloads = (downloadsRes.data ?? []) as { student_user_id: string | null; created_at: string }[];
  const labs = (labRes.data ?? []) as { student_user_id: string | null; completed_at: string }[];
  const techLabs = (techLabRes.data ?? []) as { student_user_id: string | null; completed_at: string }[];
  const plans = (planRes.data ?? []) as {
    student_user_id: string | null;
    status: string | null;
    completed_at: string | null;
  }[];
  const subs = (subsRes.data ?? []) as { student_user_id: string | null; created_at: string }[];
  const entries = (entriesRes.data ?? []) as {
    student_user_id: string | null;
    submitted_at: string;
    status: string | null;
    challenge_id: string;
  }[];
  const challengeTitles = new Map(
    ((challengesRes.data ?? []) as { id: string; title: string }[]).map((c) => [c.id, c.title]),
  );
  const waitlist = (waitlistRes.data ?? []) as { notified_at: string | null }[];
  const editionYears = ((editionsRes.data ?? []) as { year: number }[]).map((e) => e.year);

  // Selected edition (default: latest).
  const editionYear = opts.editionYear ?? editionYears[0] ?? null;

  // ── Registrations & competition (edition-scoped for the ladder) ────────────
  const stageByReg = new Map<string, { stage: string; outcome: string | null }[]>();
  for (const s of stageRows) (stageByReg.get(s.registration_id) ?? stageByReg.set(s.registration_id, []).get(s.registration_id)!).push(s);

  const editionRegs = editionYear == null ? [] : regs.filter((r) => r.edition_year === editionYear);
  let accepted = 0,
    qualified = 0,
    finalist = 0,
    declined = 0;
  for (const r of editionRegs) {
    if (r.status === "declined") declined++;
    const tier = tierRank(r.status, stageByReg.get(r.id) ?? []);
    if (tier >= 1) accepted++;
    if (tier >= 2) qualified++;
    if (tier >= 3) finalist++;
  }
  const ladder: BarPoint[] = [
    { label: "Registered", value: editionRegs.length },
    { label: "Accepted", value: accepted },
    { label: "Qualified", value: qualified },
    { label: "Finalist", value: finalist },
  ];

  const byEdition: BarPoint[] = [...tally(regs, (r) => String(r.edition_year)).entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([label, value]) => ({ label, value }));
  const byLga = topN(tally(editionRegs, (r) => r.schools?.lga ?? "Unknown"), 10);
  const byCategory = topN(tally(editionRegs, (r) => r.schools?.category ?? "Unknown"), 8);

  // ── Growth ─────────────────────────────────────────────────────────────────
  const roleKeys = [
    { key: "student", name: "Students" },
    { key: "coordinator", name: "Coordinators" },
    { key: "admin", name: "Admins" },
  ];
  const usersByRole = multiTrend(
    roleKeys.map((rk) => ({
      key: rk.key,
      timestamps: profiles.filter((p) => (p.role ?? "student") === rk.key).map((p) => p.created_at),
    })),
    gran,
    sinceISO,
  );

  // ── Learning ────────────────────────────────────────────────────────────────
  const scored = attempts.filter((a) => (a.total ?? 0) > 0);
  const avgScore = scored.length
    ? Math.round((scored.reduce((s, a) => s + a.score! / a.total!, 0) / scored.length) * 100)
    : 0;
  const histBuckets = [0, 0, 0, 0, 0];
  for (const a of scored) {
    const pct = (a.score! / a.total!) * 100;
    histBuckets[Math.min(4, Math.floor(pct / 20))]++;
  }
  const scoreHistogram: BarPoint[] = ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"].map(
    (label, i) => ({ label, value: histBuckets[i] }),
  );
  const flagged = attempts.filter((a) => (a.violations ?? 0) > 0).length;
  const modeSplit: Slice[] = [
    { name: "Practice", value: attempts.filter((a) => a.mode === "practice").length },
    { name: "Exam", value: attempts.filter((a) => a.mode !== "practice").length },
  ];
  const planStatus: Slice[] = [
    { name: "Not started", value: plans.filter((p) => (p.status ?? "not_started") === "not_started").length },
    { name: "In progress", value: plans.filter((p) => p.status === "in_progress").length },
    { name: "Completed", value: plans.filter((p) => p.status === "completed").length },
  ];

  // ── Student activity ─────────────────────────────────────────────────────────
  const plansInWindow = plans.filter((p) => p.completed_at && (!sinceISO || p.completed_at >= sinceISO));
  const activeEvents = [
    ...attempts.map((a) => ({ id: a.student_user_id, iso: a.created_at })),
    ...downloads.map((d) => ({ id: d.student_user_id, iso: d.created_at })),
    ...labs.map((l) => ({ id: l.student_user_id, iso: l.completed_at })),
    ...techLabs.map((l) => ({ id: l.student_user_id, iso: l.completed_at })),
  ];
  const active = new Set<string>([
    ...distinct(attempts.map((a) => a.student_user_id)),
    ...distinct(downloads.map((d) => d.student_user_id)),
    ...distinct(labs.map((l) => l.student_user_id)),
    ...distinct(techLabs.map((l) => l.student_user_id)),
    ...distinct(plansInWindow.map((p) => p.student_user_id)),
    ...distinct(subs.map((s) => s.student_user_id)),
    ...distinct(entries.map((e) => e.student_user_id)),
  ]);
  const labStudents = distinct([...labs, ...techLabs].map((l) => l.student_user_id));
  const engagementByFeature: BarPoint[] = [
    { label: "Assessments", value: distinct(attempts.map((a) => a.student_user_id)).size },
    { label: "Resources", value: distinct(downloads.map((d) => d.student_user_id)).size },
    { label: "Labs", value: labStudents.size },
    { label: "Plans", value: distinct(plansInWindow.map((p) => p.student_user_id)).size },
    {
      label: "Challenges",
      value: distinct([...subs, ...entries].map((r) => r.student_user_id)).size,
    },
  ];

  // ── Challenges ────────────────────────────────────────────────────────────────
  const activityTrend = multiTrend(
    [
      { key: "submissions", timestamps: subs.map((s) => s.created_at) },
      { key: "entries", timestamps: entries.map((e) => e.submitted_at) },
    ],
    gran,
    sinceISO,
  );
  const participationCounts = new Map<string, number>();
  for (const e of entries) {
    const name = challengeTitles.get(e.challenge_id) ?? "Challenge";
    participationCounts.set(name, (participationCounts.get(name) ?? 0) + 1);
  }
  const participation = topN(participationCounts, 10);
  const entryStatus: Slice[] = [
    { name: "Submitted", value: entries.filter((e) => e.status === "submitted").length },
    { name: "Reviewed", value: entries.filter((e) => e.status === "reviewed").length },
  ];

  return {
    windowLabel: windowLabelOf(sinceDays),
    editionYear,
    editionYears,
    kpis: {
      registrations: regCountRes.count ?? 0,
      verified: verifiedCountRes.count ?? 0,
      schools: schoolCountRes.count ?? 0,
      activeStudents: active.size,
      attempts: attemptCountRes.count ?? 0,
      avgScore,
      downloads: downloadCountRes.count ?? 0,
      certificates: certCountRes.count ?? 0,
    },
    registrations: {
      trend: singleTrend(regs.map((r) => r.created_at), gran, sinceISO),
      ladder,
      byEdition,
      byLga,
      byCategory,
      editionTotal: editionRegs.length,
      declined,
      waitlistPending: waitlist.filter((w) => !w.notified_at).length,
      waitlistNotified: waitlist.filter((w) => w.notified_at).length,
    },
    growth: {
      usersByRole,
      roleKeys,
      schools: singleTrend(schools.map((s) => s.created_at), gran, sinceISO),
      students: singleTrend(students.map((s) => s.created_at), gran, sinceISO),
    },
    learning: {
      attempts: singleTrend(attempts.map((a) => a.created_at), gran, sinceISO),
      scoreHistogram,
      modeSplit,
      flagged,
      flaggedPct: attempts.length ? Math.round((flagged / attempts.length) * 100) : 0,
      downloads: singleTrend(downloads.map((d) => d.created_at), gran, sinceISO),
      labCompletions: labs.length + techLabs.length,
      planStatus,
    },
    students: {
      activeTrend: activeTrend(activeEvents, gran, sinceISO),
      engagementByFeature,
    },
    challenges: {
      activityTrend,
      participation,
      entryStatus,
    },
  };
}

function emptyAnalytics(sinceDays: number | null): AdminAnalytics {
  return {
    windowLabel: windowLabelOf(sinceDays),
    editionYear: null,
    editionYears: [],
    kpis: {
      registrations: 0,
      verified: 0,
      schools: 0,
      activeStudents: 0,
      attempts: 0,
      avgScore: 0,
      downloads: 0,
      certificates: 0,
    },
    registrations: {
      trend: [],
      ladder: [],
      byEdition: [],
      byLga: [],
      byCategory: [],
      editionTotal: 0,
      declined: 0,
      waitlistPending: 0,
      waitlistNotified: 0,
    },
    growth: { usersByRole: [], roleKeys: [], schools: [], students: [] },
    learning: {
      attempts: [],
      scoreHistogram: [],
      modeSplit: [],
      flagged: 0,
      flaggedPct: 0,
      downloads: [],
      labCompletions: 0,
      planStatus: [],
    },
    students: { activeTrend: [], engagementByFeature: [] },
    challenges: { activityTrend: [], participation: [], entryStatus: [] },
  };
}

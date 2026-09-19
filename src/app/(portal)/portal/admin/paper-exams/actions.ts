"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/supabase/server";
import { requireManage } from "@/supabase/auth";
import { parseCsvGrid } from "@/lib/csv";
import { chunk } from "@/lib/batch";
import { ensureRoster } from "@/lib/ensure-roster";
import { personNameKey } from "@/lib/person-identity";
import {
  aggregateSchoolScore,
  applyCutoff,
  compareKeys,
  gradePaper,
  parseAnswerKey,
  rankBy,
  answerLetters,
  DEFAULT_OPTION_COUNT,
  type CutoffRule,
  type KeyError,
  type PaperItem,
  type Response,
  type SchoolScoreRule,
} from "@/lib/paper-exam";
import {
  paperFingerprint,
  readCapturedKey,
  readPapers,
  readQuizName,
  sniffZipGradeHeader,
} from "@/lib/zipgrade";
import { matchPapers, type RosterCandidate } from "@/lib/paper-exam-match";
import { QUALIFICATION_REASONS } from "@/supabase/types";

const MODULE = "participants" as const;
const BASE = "/portal/admin/paper-exams";

/** Every write here reports. A discarded PostgrestError is how the old per-rep
 *  stage-result bug stayed invisible for weeks, and how "click Create and
 *  nothing happens" looks from the outside: a missing column, a failed RLS
 *  check, or an RPC that raised on purpose, all rendered as silence. */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const denied: ActionResult = { ok: false, error: "You have read-only access to participants." };

/** Why an exam could not be worked on. Deliberately NOT one message: "locked"
 *  and "could not read it at all" have completely different fixes, and saying
 *  the wrong one sends you looking in the wrong place. */
function notEditable(reason: NotEditable): ActionResult {
  if (reason.kind === "unreadable") return { ok: false, error: reason.message };
  if (reason.kind === "missing") {
    return { ok: false, error: "That paper exam no longer exists, or this account cannot read it." };
  }
  return {
    ok: false,
    error: `This exam is for ${reason.examYear} and the current edition is ${reason.latestYear}, so it is locked. Tick “this is a past sitting being imported for the record” on the exam to work on it anyway.`,
  };
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}
export interface PaperImportState {
  stage: "idle" | "preview" | "done" | "error";
  message?: string;
  importId?: string;
  parsed?: number;
  matched?: number;
  undecided?: number;
  keyMismatchRows?: number;
  invalidMarkRows?: number;
  mapping?: { field: string; column: string }[];
  unmapped?: string[];
  warnings?: string[];
  errors?: ImportError[];
  /** The key found in the file, offered when the exam has none yet. */
  keyFromFile?: string;
}

type NotEditable =
  | { kind: "missing" }
  | { kind: "unreadable"; message: string }
  | { kind: "locked"; examYear: number; latestYear: number };

/** The exam row, or why it cannot be worked on. Past editions are locked for
 *  normal admin edits, exactly as every other competition action is — but a
 *  backfill says outright that it is a deliberate historical import. */
async function loadEditableExam(supabase: SupabaseClient, examId: string) {
  // Read the error. Discarding it here is what turned "this build expects a
  // column the database does not have" into "past editions are locked" — a
  // message that sent the reader looking at the wrong thing entirely.
  const { data: exam, error } = await supabase
    .from("paper_exams")
    .select("id, edition_year, stage, title, item_count, option_count, is_backfill, status, subjects, source_quiz_name, school_score_rule, school_score_top_n")
    .eq("id", examId)
    .maybeSingle();
  if (error) {
    return {
      ok: false as const,
      reason: { kind: "unreadable" as const, message: describe(error, "open that paper exam") },
    };
  }
  if (!exam) return { ok: false as const, reason: { kind: "missing" as const } };
  // A backfill is a deliberate import of a past sitting, so it is exempt from
  // the past-edition lock. Nothing else about the exam changes.
  if (exam.is_backfill) return { ok: true as const, exam };
  const { data: latest } = await supabase
    .from("editions")
    .select("year")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (Number(latest?.year) !== Number(exam.edition_year)) {
    return {
      ok: false as const,
      reason: {
        kind: "locked" as const,
        examYear: Number(exam.edition_year),
        latestYear: Number(latest?.year),
      },
    };
  }
  return { ok: true as const, exam };
}

/** Back-compatible helper for the call sites that only need the row. */
async function editableExam(supabase: SupabaseClient, examId: string) {
  const r = await loadEditableExam(supabase, examId);
  return r.ok ? r.exam : null;
}

/** Turn a PostgrestError into something an operator can act on. A missing column
 *  or an unapplied migration reads as gibberish otherwise. */
function describe(error: { message: string; code?: string; details?: string | null }, what: string): string {
  const code = error.code ?? "";
  if (code === "PGRST204" || code === "42703") {
    return `Could not ${what}: the database is missing a column this build expects (${error.message}). A migration has not been applied.`;
  }
  if (code === "42P01") {
    return `Could not ${what}: a table this build expects does not exist yet. The paper-exam migrations have not been applied.`;
  }
  if (code === "23505") {
    return `Could not ${what}: one already exists with that edition, stage and title.`;
  }
  if (code === "42501") {
    return `Could not ${what}: the database refused the write for this account.`;
  }
  return `Could not ${what}: ${error.message}`;
}

function parseSubjects(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

// ── the exam ────────────────────────────────────────────────────────────────

export async function createPaperExam(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireManage(MODULE);
  if (!admin) return denied;

  const title = String(formData.get("title") ?? "").trim();
  const editionYear = Number(formData.get("edition_year"));
  const itemCount = Number(formData.get("item_count") || 100);
  const optionCount = Number(formData.get("option_count") || DEFAULT_OPTION_COUNT);
  const subjects = parseSubjects(String(formData.get("subjects") ?? ""));
  const sourceQuizName = String(formData.get("source_quiz_name") ?? "").trim() || null;

  if (!title) return { ok: false, error: "Give the exam a title." };
  if (!Number.isInteger(editionYear)) return { ok: false, error: "Edition must be a year." };
  if (subjects.length === 0) {
    return { ok: false, error: "List at least one subject — they become the breakdown labels." };
  }
  if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 100) {
    return { ok: false, error: "Items must be between 1 and 100." };
  }
  if (optionCount !== 4 && optionCount !== 5) {
    return { ok: false, error: "Options per question must be 4 (A-D) or 5 (A-E)." };
  }
  const isBackfill = String(formData.get("is_backfill") ?? "") === "1";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("paper_exams")
    .insert({
      title,
      edition_year: editionYear,
      item_count: itemCount,
      option_count: optionCount,
      is_backfill: isBackfill,
      subjects,
      source_quiz_name: sourceQuizName,
      created_by: admin.user.id,
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: describe(error, "create that paper exam") };
  if (!data?.id) return { ok: false, error: "The exam was not created, and the database said why." };

  revalidatePath(BASE);
  redirect(`${BASE}/${data.id}`);
}

export async function updatePaperExam(
  examId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireManage(MODULE))) return denied;
  const supabase = await createClient();
  const editable = await loadEditableExam(supabase, examId);
  if (!editable.ok) return notEditable(editable.reason);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const subjects = parseSubjects(String(formData.get("subjects") ?? ""));
  if (subjects.length) patch.subjects = subjects;
  const rule = String(formData.get("school_score_rule") ?? "");
  if (["sum_all", "sum_top_n", "mean_present", "best"].includes(rule)) {
    patch.school_score_rule = rule;
  }
  const topN = Number(formData.get("school_score_top_n"));
  if (Number.isInteger(topN) && topN >= 1 && topN <= 10) patch.school_score_top_n = topN;
  if (formData.has("source_quiz_name")) {
    patch.source_quiz_name = String(formData.get("source_quiz_name") ?? "").trim() || null;
  }

  const { error } = await supabase.from("paper_exams").update(patch).eq("id", examId);
  if (error) return { ok: false, error: describe(error, "save those settings") };
  revalidatePath(`${BASE}/${examId}`);
  return { ok: true, message: "Saved." };
}

/** Turn the historical-backfill flag on or off.
 *
 *  Deliberately NOT behind the past-edition lock: an exam created for an old
 *  year without this flag is locked out of every other action, including the
 *  one that would set the flag. That is a trap with no way out, so this is the
 *  way out. It changes no result — only whether the lock applies. */
export async function setBackfill(
  examId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireManage(MODULE))) return denied;
  const supabase = await createClient();
  const on = String(formData.get("is_backfill") ?? "") === "1";

  const { data: exam } = await supabase
    .from("paper_exams")
    .select("id, title, status")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) {
    return { ok: false, error: "That paper exam no longer exists, or this account cannot read it." };
  }
  if (!on && exam.status !== "draft") {
    return {
      ok: false,
      error: `Turning this off would lock a “${exam.status}” exam out of every action. Leave it on.`,
    };
  }

  const { error } = await supabase
    .from("paper_exams")
    .update({ is_backfill: on, updated_at: new Date().toISOString() })
    .eq("id", examId);
  if (error) return { ok: false, error: describe(error, "change that setting") };

  revalidatePath(`${BASE}/${examId}`);
  revalidatePath(BASE);
  return {
    ok: true,
    message: on
      ? "Marked as a past sitting — this exam is no longer locked by its edition."
      : "No longer marked as a past sitting.",
  };
}

/** Delete an exam outright, so it can be created again with the same title —
 *  `unique (edition_year, stage, title)` otherwise blocks a second attempt.
 *
 *  Only one that has published nothing: a committed import has already written
 *  scores to student_stage_results, and a committed cutoff has written outcomes
 *  to the schools; neither belongs to this table and neither would come back.
 *  Items, candidates, staged imports and staged papers go with it by cascade. */
export async function deletePaperExam(
  examId: string,
  _prev: ActionResult | null,
  _formData?: FormData,
): Promise<ActionResult> {
  if (!(await requireManage(MODULE))) return denied;
  const supabase = await createClient();
  // Read directly rather than through the lock: a draft created for the wrong
  // edition is exactly the thing most in need of deleting, and the lock would
  // refuse it. The status and committed-import checks below are the real guard,
  // and they are about what has been PUBLISHED, not about which year it is.
  const { data: exam } = await supabase
    .from("paper_exams")
    .select("id, title, status, edition_year, is_backfill")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) {
    return { ok: false, error: "That paper exam no longer exists, or this account cannot read it." };
  }

  if (exam.status === "published") {
    return {
      ok: false,
      error:
        "This exam's cutoff has been committed, so its schools and reps carry the outcomes it decided. Deleting it would leave those behind. Nothing was deleted.",
    };
  }

  const { data: committed } = await supabase
    .from("paper_exam_imports")
    .select("id")
    .eq("exam_id", examId)
    .eq("status", "committed")
    .limit(1);
  if (committed?.length) {
    return {
      ok: false,
      error:
        "This exam has a published import, so its scores are already on students' records. Deleting it would leave those behind. Nothing was deleted.",
    };
  }

  // Candidate numbers are mirrored onto students.exam_id, and loadRoster falls
  // back to that column — so leaving them behind would make a fresh exam match
  // against numbers that no sheet carries. Only clear a value this exam wrote,
  // and never on a backfill, where exam_id is the historical record itself.
  if (!exam.is_backfill) {
    const { data: candidates } = await supabase
      .from("paper_exam_candidates")
      .select("student_id, exam_no")
      .eq("exam_id", examId);
    const wrote = new Map(
      ((candidates ?? []) as { student_id: string; exam_no: string }[]).map((c) => [
        c.student_id,
        c.exam_no,
      ]),
    );
    if (wrote.size) {
      const ids = [...wrote.keys()];
      const stale: string[] = [];
      for (const batch of chunk(ids, 200)) {
        const { data: students } = await supabase
          .from("students")
          .select("id, exam_id")
          .in("id", batch);
        for (const st of (students ?? []) as { id: string; exam_id: string | null }[]) {
          if (st.exam_id && st.exam_id === wrote.get(st.id)) stale.push(st.id);
        }
      }
      for (const batch of chunk(stale, 200)) {
        const { error } = await supabase
          .from("students")
          .update({ exam_id: null })
          .in("id", batch);
        if (error) return { ok: false, error: describe(error, "clear the candidate numbers") };
      }
    }
  }

  const { error } = await supabase.from("paper_exams").delete().eq("id", examId);
  if (error) return { ok: false, error: describe(error, "delete this paper exam") };

  revalidatePath(BASE);
  redirect(BASE);
}

/** Releasing the review publishes the per-item CORRECT ANSWERS to every student
 *  who sat the paper. The key is reused across centres and sittings, so this
 *  must stay a deliberate, separate act — never a side effect of importing. */
export async function setReviewReleased(
  examId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireManage(MODULE))) return denied;
  const supabase = await createClient();
  const editable = await loadEditableExam(supabase, examId);
  if (!editable.ok) return notEditable(editable.reason);
  const released = String(formData.get("released") ?? "") === "1";
  const { error } = await supabase
    .from("paper_exams")
    .update({ review_released: released, updated_at: new Date().toISOString() })
    .eq("id", examId);
  if (error) return { ok: false, error: describe(error, "change the review setting") };
  revalidatePath(`${BASE}/${examId}`);
  revalidatePath("/portal/student");
  return { ok: true, message: released ? "Answers are now visible to students." : "Answers hidden." };
}

// ── the key ─────────────────────────────────────────────────────────────────

export interface KeySaveState {
  stage: "idle" | "saved" | "error";
  version?: string;
  saved?: number;
  errors?: KeyError[];
}

/** Set the key for one version, from two pasted fields: the answers, and how
 *  the items map to subjects. Replaces the whole version, so a re-paste is
 *  idempotent — and saves nothing at all if anything is wrong, because a
 *  partial key would silently score every unlisted item wrong for everyone. */
export async function saveKeyItems(
  examId: string,
  _prev: KeySaveState,
  formData: FormData,
): Promise<KeySaveState> {
  if (!(await requireManage(MODULE))) {
    return {
      stage: "error",
      errors: [{ field: "answers", message: "You have read-only access to participants." }],
    };
  }
  const supabase = await createClient();
  const editableKey = await loadEditableExam(supabase, examId);
  if (!editableKey.ok) {
    const why = notEditable(editableKey.reason);
    return {
      stage: "error",
      errors: [{ field: "answers", message: why.ok ? "" : why.error }],
    };
  }
  const exam = editableKey.exam;

  const version = String(formData.get("version") ?? "A").toUpperCase();
  if (!["A", "B", "C", "D"].includes(version)) {
    return { stage: "error", errors: [{ field: "answers", message: "Choose which copy this is." }] };
  }

  // The option count is saved WITH the key, not from a separate settings form:
  // the two have to agree, and validating the answers against the same number
  // that is about to be stored is the only way that cannot drift.
  const submitted = Number(formData.get("option_count"));
  const optionCount =
    submitted === 4 || submitted === 5 ? submitted : Number(exam.option_count) || DEFAULT_OPTION_COUNT;

  const { items, errors } = parseAnswerKey({
    answers: String(formData.get("answers") ?? ""),
    subjectMap: String(formData.get("subject_map") ?? ""),
    subjects: (exam.subjects as string[]) ?? [],
    itemCount: Number(exam.item_count),
    optionCount,
  });
  if (errors.length) return { stage: "error", version, errors };

  if (optionCount !== Number(exam.option_count)) {
    const letters = answerLetters(optionCount) as string[];
    const { data: beyond } = await supabase
      .from("paper_exam_items")
      .select("version, position, correct")
      .eq("exam_id", examId)
      .neq("version", version)
      .not("correct", "in", `(${letters.join(",")})`)
      .limit(1);
    if (beyond?.length) {
      const clash = beyond[0];
      return {
        stage: "error",
        version,
        errors: [
          {
            field: "answers",
            message: `Copy ${clash.version} answers question ${clash.position} with “${clash.correct}”, which a ${optionCount}-option paper does not have. Fix that copy first.`,
          },
        ],
      };
    }
    const { error } = await supabase
      .from("paper_exams")
      .update({ option_count: optionCount, updated_at: new Date().toISOString() })
      .eq("id", examId);
    if (error) {
      return {
        stage: "error",
        version,
        errors: [{ field: "answers", message: describe(error, "save the option count") }],
      };
    }
  }

  const { error: wipeError } = await supabase
    .from("paper_exam_items")
    .delete()
    .eq("exam_id", examId)
    .eq("version", version);
  if (wipeError) {
    return {
      stage: "error",
      version,
      errors: [{ field: "answers", message: describe(wipeError, "replace the previous key") }],
    };
  }
  for (const batch of chunk(items, 200)) {
    const { error } = await supabase
      .from("paper_exam_items")
      .insert(batch.map((r) => ({ exam_id: examId, version, ...r })));
    if (error) return { stage: "error", version, errors: [{ field: "answers", message: error.message }] };
  }

  revalidatePath(`${BASE}/${examId}`);
  return { stage: "saved", version, saved: items.length };
}

// ── candidate numbers + roster ──────────────────────────────────────────────

/** Reps become student rows when a registration is APPROVED, so a school still
 *  waiting on a decision has nobody to number and would silently miss the
 *  sitting. Every registered rep sits, whatever their school's status, so fill
 *  the gaps first. A name already on the roster is left alone — including one
 *  the replacement flow retired, which is why deactivated rows count as known.
 *
 *  Declined is the exception: declining is how a bogus or duplicate entry is
 *  withdrawn, so re-provisioning its reps would undo the withdrawal. */
async function provisionEveryRegisteredRep(
  supabase: SupabaseClient,
  editionYear: number,
): Promise<{ added: number; failed: number } | { error: string }> {
  const [{ data: regs, error: regErr }, { data: students, error: stErr }] = await Promise.all([
    supabase
      .from("registrations")
      .select("school_id, reps")
      .eq("edition_year", editionYear)
      .neq("status", "declined"),
    supabase.from("students").select("school_id, name").eq("edition_year", editionYear),
  ]);
  if (regErr) return { error: describe(regErr, "read the registrations") };
  if (stErr) return { error: describe(stErr, "read the roster") };

  const known = new Set(
    ((students ?? []) as { school_id: string | null; name: string }[]).map(
      (s) => `${s.school_id}|${personNameKey(s.name)}`,
    ),
  );

  let added = 0;
  let failed = 0;
  for (const reg of (regs ?? []) as { school_id: string | null; reps: unknown }[]) {
    if (!reg.school_id) continue;
    const reps = (Array.isArray(reg.reps) ? reg.reps : []) as {
      name?: string;
      level?: string | null;
    }[];
    const missing = reps.filter((rep) => {
      const name = (rep?.name ?? "").trim();
      if (!name) return false;
      const key = `${reg.school_id}|${personNameKey(name)}`;
      // Adding as we go: a school with two registrations lists the same reps
      // twice, and one registration can list the same name three times.
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    if (!missing.length) continue;

    const res = await ensureRoster({
      school_id: reg.school_id,
      edition_year: editionYear,
      reps: missing,
    });
    added += res.provisioned;
    failed += res.errors;
  }
  return { added, failed };
}

export async function allocateNumbers(
  examId: string,
  _prev: ActionResult | null,
  _formData?: FormData,
): Promise<ActionResult> {
  if (!(await requireManage(MODULE))) return denied;
  const supabase = await createClient();
  const editable = await loadEditableExam(supabase, examId);
  if (!editable.ok) return notEditable(editable.reason);
  if (editable.exam.is_backfill) {
    return {
      ok: false,
      error:
        "This is a past sitting. Its candidate numbers are already on the student records — that is what makes its papers match — and allocating would overwrite them. Nothing was changed.",
    };
  }

  const filled = await provisionEveryRegisteredRep(
    supabase,
    Number(editable.exam.edition_year),
  );
  if ("error" in filled) return { ok: false, error: filled.error };

  const { data, error } = await supabase.rpc("allocate_candidate_numbers", { p_exam_id: examId });
  if (error) return { ok: false, error: describe(error, "allocate candidate numbers") };

  // The RPC refuses past 999 rather than colliding, and says what it would need.
  const result = (data ?? {}) as { allocated?: number; would_need?: number; ceiling?: number };
  if (result.would_need) {
    return {
      ok: false,
      error: `This roster needs ${result.would_need} numbers, but a 3-digit sheet holds ${result.ceiling}. Split the sitting, or re-issue the sheet with a wider ID box.`,
    };
  }
  revalidatePath(`${BASE}/${examId}`);
  const notes = [
    result.allocated
      ? `Allocated ${result.allocated} candidate number${result.allocated === 1 ? "" : "s"}.`
      : "Every rep already has a number — nothing renumbered.",
    filled.added ? `Added ${filled.added} rep${filled.added === 1 ? "" : "s"} who had no record yet.` : null,
    filled.failed
      ? `${filled.failed} rep${filled.failed === 1 ? "" : "s"} could not be added — check the school's roster.`
      : null,
  ].filter(Boolean);
  return { ok: true, message: notes.join(" ") };
}

// ── import ──────────────────────────────────────────────────────────────────

async function loadKey(
  supabase: SupabaseClient,
  examId: string,
): Promise<Map<string, PaperItem[]>> {
  const { data } = await supabase
    .from("paper_exam_items")
    .select("version, position, subject, correct")
    .eq("exam_id", examId)
    .order("position");
  const byVersion = new Map<string, PaperItem[]>();
  for (const row of (data ?? []) as PaperExamItemRow[]) {
    const list = byVersion.get(row.version) ?? [];
    list.push({ position: row.position, subject: row.subject, correct: row.correct as PaperItem["correct"] });
    byVersion.set(row.version, list);
  }
  return byVersion;
}

interface PaperExamItemRow {
  version: string;
  position: number;
  subject: string;
  correct: string;
}

async function loadRoster(
  supabase: SupabaseClient,
  examId: string,
  editionYear: number,
): Promise<RosterCandidate[]> {
  const { data } = await supabase
    .from("students")
    .select("id, name, level, school_id, exam_id, edition_year, deactivated_at, schools(name)")
    .eq("edition_year", editionYear)
    .is("deactivated_at", null);
  const { data: candidates } = await supabase
    .from("paper_exam_candidates")
    .select("student_id, exam_no, class_name")
    .eq("exam_id", examId);

  const byStudent = new Map(
    ((candidates ?? []) as { student_id: string; exam_no: string; class_name: string | null }[]).map(
      (c) => [c.student_id, c],
    ),
  );
  type StudentRow = {
    id: string;
    name: string;
    level: string | null;
    school_id: string | null;
    exam_id: string | null;
    schools: { name: string | null } | null;
  };
  return ((data ?? []) as unknown as StudentRow[]).map((s) => {
    const c = byStudent.get(s.id);
    return {
      studentId: s.id,
      name: s.name,
      schoolId: s.school_id,
      schoolName: s.schools?.name ?? null,
      // paper_exam_candidates is authoritative for a sitting this portal printed.
      // students.exam_id is the fallback, and it is what makes a historical
      // backfill work: past editions already carry the number that was on the
      // sheet, which is the same number the capture file comes back with.
      examNo: c?.exam_no ?? s.exam_id ?? null,
      className: c?.class_name ?? s.level ?? null,
      level: s.level,
    };
  });
}

/** Stage a capture file: sniff, re-grade against OUR key, match, and write every
 *  row with a status. Preview writes nothing; confirm stages and redirects to
 *  the review page (the staged rows ARE the real preview — 491 rows x 100
 *  responses is far too much to round-trip through action state). */
export async function importPaperResults(
  _prev: PaperImportState,
  formData: FormData,
): Promise<PaperImportState> {
  const admin = await requireManage(MODULE);
  if (!admin) return { stage: "error", message: "You have read-only access to participants." };

  const examId = String(formData.get("exam_id") ?? "");
  const confirm = String(formData.get("confirm") ?? "0") === "1";
  const filename = String(formData.get("filename") ?? "").trim() || null;
  const payload = String(formData.get("payload") ?? "");
  if (!payload.trim()) return { stage: "error", message: "Paste or choose a CSV export first." };

  const supabase = await createClient();
  const editableImport = await loadEditableExam(supabase, examId);
  if (!editableImport.ok) {
    const why = notEditable(editableImport.reason);
    return { stage: "error", message: why.ok ? "" : why.error };
  }
  const exam = editableImport.exam;
  const itemCount = Number(exam.item_count);
  const optionCount = Number(exam.option_count);

  const grid = parseCsvGrid(payload);
  if (grid.length < 2) return { stage: "error", message: "That file has no data rows." };

  const sniff = sniffZipGradeHeader(grid[0], itemCount, grid.slice(1, 21));
  if (!sniff.ok) {
    return {
      stage: "error",
      message: sniff.error,
      unmapped: sniff.headers,
    };
  }
  const map = sniff.map;

  // The single most likely operator mistake: exporting the wrong quiz.
  const quizName = readQuizName(grid, map);
  const expected = (exam.source_quiz_name as string | null) ?? null;
  if (expected && quizName && quizName.trim().toLowerCase() !== expected.trim().toLowerCase()) {
    return {
      stage: "error",
      message: `This file is an export of “${quizName}”, but this paper exam expects “${expected}”. Re-export the right quiz, or clear the expected name on the exam.`,
    };
  }

  const papers = readPapers(grid, map, itemCount, optionCount);

  const keysByVersion = await loadKey(supabase, examId);
  if (keysByVersion.size === 0) {
    // The export carries the key on every row, so offer it rather than sending
    // the operator away to type 100 letters. Adopting it is still their explicit
    // act — grading here is never a matter of trusting the capture tool.
    const fromFile = readCapturedKey(papers, itemCount);
    return {
      stage: "error",
      message: fromFile
        ? "This exam has no answer key yet. The file carries one — copy it into the Answer key field, then import again."
        : "Author the answer key before importing results.",
      keyFromFile: fromFile ?? undefined,
    };
  }

  const roster = await loadRoster(supabase, examId, Number(exam.edition_year));
  const { results, summary } = matchPapers(papers, roster);

  // Most papers are printed in a single version, and then the sheet's Key box
  // is left unshaded — so the export's Key column is blank on every row. With
  // only one key authored there is nothing to choose between, so that is NOT an
  // assumption worth flagging; flagging it would put every paper in the
  // "worth a look" list and make the list worthless.
  const authoredVersions = [...keysByVersion.keys()].sort();
  const soleVersion = authoredVersions.length === 1 ? authoredVersions[0] : null;

  const graded = results.map(({ paper, match }) => {
    const version = paper.keyVersion ?? soleVersion ?? "A";
    const items = keysByVersion.get(version) ?? keysByVersion.get("A") ?? [];
    const result = gradePaper(items, paper.responses);
    const mismatches = paper.capturedKey ? compareKeys(items, paper.capturedKey) : [];
    return {
      paper,
      match,
      version,
      // Only a real guess: several versions exist and this sheet did not say
      // which one it is.
      versionAssumed: !paper.keyVersion && !soleVersion,
      result,
      mismatches,
    };
  });

  const keyMismatchRows = graded.filter((g) => g.mismatches.length > 0).length;
  const invalidMarkRows = graded.filter((g) => g.result.invalid > 0).length;
  const mapping = Object.entries(map.fields).map(([field, col]) => ({
    field,
    column: grid[0][col as number] ?? "",
  }));

  const warnings = [...map.warnings];
  if (keyMismatchRows > 0) {
    warnings.push(
      `${keyMismatchRows} row(s) carry a key that disagrees with ours — check the Key version, or the key typed into the capture tool.`,
    );
  }

  if (!confirm) {
    // Say it before staging, not after: an exact repeat is a fact about the
    // file the operator should see while they can still check it.
    const fingerprints = new Set(graded.map(({ paper }) => paperFingerprint(examId, paper)));
    const repeats = graded.length - fingerprints.size;
    if (repeats) {
      warnings.push(
        `${repeats} row${repeats === 1 ? " is an exact repeat of another row" : "s are exact repeats of other rows"} — same candidate, same name, same answers. Only one of each will be staged.`,
      );
    }
    return {
      stage: "preview",
      parsed: graded.length,
      matched: summary.matched,
      undecided: summary.undecided,
      keyMismatchRows,
      invalidMarkRows,
      mapping,
      unmapped: map.unmapped,
      warnings,
    };
  }

  const { data: imported } = await supabase
    .from("paper_exam_imports")
    .insert({
      exam_id: examId,
      source: "zipgrade_csv",
      filename,
      header_map: { fields: mapping, unmapped: map.unmapped, warnings },
      row_count: graded.length,
      matched_count: summary.matched,
      undecided_count: summary.undecided,
      key_mismatch_count: keyMismatchRows,
      imported_by: admin.user.id,
    })
    .select("id")
    .maybeSingle();
  const importId = imported?.id as string | undefined;
  if (!importId) return { stage: "error", message: "Could not stage the import." };

  // Every row is written, matched or not — never a silent drop.
  const rows = graded.map(({ paper, match, version, versionAssumed, result, mismatches }) => ({
    exam_id: examId,
    import_id: importId,
    external_id: paper.externalId,
    exam_no: paper.examNo,
    first_name: paper.firstName,
    last_name: paper.lastName,
    class_name: paper.className,
    version,
    version_assumed: versionAssumed,
    responses: paper.responses as unknown as Response[],
    total: result.total,
    attempted: result.attempted,
    invalid_marks: result.invalid,
    subscores: result.subscores,
    capture_num_correct: paper.captureNumCorrect,
    key_mismatches: mismatches.length,
    name_mismatch: match.nameMismatch ?? false,
    student_id: match.studentId,
    match_method: match.method,
    status: match.studentId ? "matched" : match.confidence === "ambiguous" ? "ambiguous" : "unmatched",
    source_fingerprint: paperFingerprint(examId, paper),
    source_row: paper.raw,
  }));

  // Dedupe by fingerprint BEFORE chunking. Two identical sheets in one file —
  // the 2025 export has a pair — share a fingerprint, and a single upsert
  // cannot touch the same conflict key twice: Postgres rejects the whole
  // statement, so one duplicate pair silently cost 91 other rows their import.
  // Across statements it is a harmless no-op; within one it is fatal.
  const byFingerprint = new Map<string, (typeof rows)[number]>();
  let identical = 0;
  for (const row of rows) {
    if (byFingerprint.has(row.source_fingerprint)) identical++;
    else byFingerprint.set(row.source_fingerprint, row);
  }
  const unique = [...byFingerprint.values()];

  const errors: ImportError[] = [];
  let written = 0;
  for (const batch of chunk(unique, 200)) {
    const { error, count } = await supabase
      .from("paper_exam_papers")
      .upsert(batch, { onConflict: "exam_id,source_fingerprint", count: "exact" });
    if (error) errors.push({ row: 0, field: "batch", message: error.message });
    else written += count ?? batch.length;
  }

  revalidatePath(`${BASE}/${examId}`);
  if (errors.length === 0) redirect(`${BASE}/${examId}/imports/${importId}`);
  // A partial write is not a dead end: the upsert is keyed on the fingerprint,
  // so importing the same file again fills in whatever did not land.
  return {
    stage: "error",
    message: `${errors[0].message} — ${written} of ${unique.length} papers were staged. Import the same file again to finish; the ones already staged will not be duplicated.`,
    importId,
    parsed: written,
    warnings: identical
      ? [`${identical} row${identical === 1 ? " was" : "s were"} an exact repeat of another and staged once.`]
      : undefined,
  };
}

/** Assign a student to an unmatched row, or discard it with a required reason.
 *  There is no third option: a row cannot stay undecided AND be published. */
export async function resolvePaperRow(
  paperId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireManage(MODULE);
  if (!admin) return denied;
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("paper_exam_papers")
    .select("id, exam_id, import_id")
    .eq("id", paperId)
    .maybeSingle();
  if (!row) return { ok: false, error: "That paper is no longer staged." };
  const editable = await loadEditableExam(supabase, row.exam_id as string);
  if (!editable.ok) return notEditable(editable.reason);

  const op = String(formData.get("op") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  let message = "Resolved.";

  if (op === "discard") {
    if (!note) return { ok: false, error: "Say why this paper is being discarded." };
    const { error } = await supabase
      .from("paper_exam_papers")
      .update({
        status: "discarded",
        student_id: null,
        resolution_note: note,
        resolved_by: admin.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paperId);
    if (error) return { ok: false, error: describe(error, "discard this paper") };
    message = "Discarded.";
  } else if (op === "assign") {
    const studentId = String(formData.get("student_id") ?? "").trim();
    if (!studentId) return { ok: false, error: "Pick a student first." };
    const { error } = await supabase
      .from("paper_exam_papers")
      .update({
        status: "matched",
        student_id: studentId,
        match_method: "manual",
        resolution_note: note || null,
        resolved_by: admin.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paperId);
    // 23505 = the partial unique index: that student already has a kept sheet.
    if (error?.code === "23505") {
      await supabase
        .from("paper_exam_papers")
        .update({
          status: "duplicate",
          resolution_note: "Another sheet is already kept for this student.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paperId);
      await refreshImportCounts(supabase, row.import_id as string);
      revalidatePath(`${BASE}/${row.exam_id}/imports/${row.import_id}`);
      return {
        ok: false,
        error:
          "That student already has a kept sheet. This one is now marked a duplicate — discard whichever is wrong.",
      };
    }
    if (error) return { ok: false, error: describe(error, "attach this paper") };
    message = "Attached.";
  } else return { ok: false, error: "Choose whether to attach or discard this paper." };

  await refreshImportCounts(supabase, row.import_id as string);
  revalidatePath(`${BASE}/${row.exam_id}/imports/${row.import_id}`);
  return { ok: true, message };
}

async function refreshImportCounts(supabase: SupabaseClient, importId: string) {
  const { data } = await supabase
    .from("paper_exam_papers")
    .select("status")
    .eq("import_id", importId);
  const rows = (data ?? []) as { status: string }[];
  await supabase
    .from("paper_exam_imports")
    .update({
      row_count: rows.length,
      matched_count: rows.filter((r) => r.status === "matched").length,
      undecided_count: rows.filter((r) =>
        ["unmatched", "ambiguous", "duplicate"].includes(r.status),
      ).length,
    })
    .eq("id", importId);
}

export async function commitImport(
  importId: string,
  _prev: ActionResult | null,
  _formData?: FormData,
): Promise<ActionResult> {
  if (!(await requireManage(MODULE))) return denied;
  const supabase = await createClient();
  const { data: imp } = await supabase
    .from("paper_exam_imports")
    .select("id, exam_id")
    .eq("id", importId)
    .maybeSingle();
  if (!imp) return { ok: false, error: "That import no longer exists." };
  const editable = await loadEditableExam(supabase, imp.exam_id as string);
  if (!editable.ok) return notEditable(editable.reason);

  // The RPC refuses while any row is undecided; that refusal is the whole point
  // of the review step, so it has to reach the operator verbatim.
  const { data, error } = await supabase.rpc("commit_paper_import", { p_import_id: importId });
  if (error) return { ok: false, error: describe(error, "publish this import") };
  const published = Number((data as { published?: number } | null)?.published ?? 0);
  revalidatePath(`${BASE}/${imp.exam_id}`);
  revalidatePath(`${BASE}/${imp.exam_id}/imports/${importId}`);
  revalidatePath("/portal/student");
  revalidatePath("/portal/school");
  return {
    ok: true,
    message: `Published ${published} paper${published === 1 ? "" : "s"}.`,
  };
}

export async function discardImport(
  importId: string,
  _prev: ActionResult | null,
  _formData?: FormData,
): Promise<ActionResult> {
  if (!(await requireManage(MODULE))) return denied;
  const supabase = await createClient();
  const { data: imp } = await supabase
    .from("paper_exam_imports")
    .select("id, exam_id, status")
    .eq("id", importId)
    .maybeSingle();
  if (!imp) return { ok: false, error: "That import no longer exists." };
  if (imp.status === "committed") {
    return { ok: false, error: "This import is already published — it is history now." };
  }
  // A partly-published import is still 'staged', so status alone no longer says
  // whether discarding would retract scores students can see.
  const { count, error: countError } = await supabase
    .from("paper_exam_papers")
    .select("id", { count: "exact", head: true })
    .eq("import_id", importId)
    .not("published_at", "is", null);
  if (countError) return { ok: false, error: describe(countError, "check this import") };
  if (count) {
    return {
      ok: false,
      error: `${count} paper${count === 1 ? " from this import has" : "s from this import have"} already been published to students. Discarding would leave those scores behind with nothing explaining them.`,
    };
  }
  const editable = await loadEditableExam(supabase, imp.exam_id as string);
  if (!editable.ok) return notEditable(editable.reason);

  const { error } = await supabase
    .from("paper_exam_imports")
    .update({ status: "discarded" })
    .eq("id", importId);
  if (error) return { ok: false, error: describe(error, "discard this import") };
  revalidatePath(`${BASE}/${imp.exam_id}`);
  return { ok: true, message: "Discarded." };
}

// ── rank and cut ────────────────────────────────────────────────────────────

interface RankingRow {
  student_id: string;
  student_name: string;
  school_id: string | null;
  school_name: string | null;
  lga: string | null;
  registration_id: string | null;
  centre: string | null;
  total: number | null;
  out_of: number | null;
}

export interface SchoolStanding {
  registrationId: string;
  schoolName: string;
  lga: string | null;
  centre: string | null;
  score: number;
  scoreMax: number;
  reps: number;
  rank: number;
  lgaRank: number;
  outcome: "advanced" | "eliminated";
}

export interface CutPreview {
  standings: SchoolStanding[];
  advanced: number;
  eliminated: number;
  cutScore: number | null;
  /** Schools whose tied score STRADDLES the cut. Commit is blocked on these. */
  tied: { registrationId: string; schoolName: string; score: number }[];
  rule: SchoolScoreRule;
  topN: number;
}

/** Read the papers, aggregate to schools, rank, and apply a cutoff — all
 *  without writing anything. The page renders this as the preview. */
export async function previewCut(
  examId: string,
  rule: CutoffRule,
): Promise<CutPreview | null> {
  if (!(await requireManage(MODULE))) return null;
  const supabase = await createClient();
  const { data: exam } = await supabase
    .from("paper_exams")
    .select("school_score_rule, school_score_top_n")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) return null;

  const { data, error } = await supabase.rpc("get_paper_ranking", { p_exam_id: examId });
  if (error) return null;
  const rows = ((data ?? []) as RankingRow[]).filter((r) => r.registration_id);

  const bySchool = new Map<string, RankingRow[]>();
  for (const row of rows) {
    const key = row.registration_id as string;
    const list = bySchool.get(key);
    if (list) list.push(row);
    else bySchool.set(key, [row]);
  }

  const scoreRule = exam.school_score_rule as SchoolScoreRule;
  const topN = Number(exam.school_score_top_n) || 3;

  const schools = [...bySchool.entries()].map(([registrationId, reps]) => {
    const agg = aggregateSchoolScore(
      reps.map((r) => ({
        studentId: r.student_id,
        total: r.total ?? 0,
        outOf: r.out_of ?? 0,
      })),
      scoreRule,
      topN,
    );
    return {
      registrationId,
      schoolName: reps[0].school_name ?? "Unknown school",
      lga: reps[0].lga,
      centre: reps[0].centre,
      score: agg.score,
      scoreMax: agg.score_max,
      reps: agg.counted,
    };
  });

  const overall = rankBy(schools, (s) => s.score);
  const perLga = new Map(
    rankBy(schools, (s) => s.score, (s) => s.lga ?? "—").map((r) => [
      r.row.registrationId,
      r.rank,
    ]),
  );
  const cut = applyCutoff(overall, (s) => s.score, rule);

  const standings: SchoolStanding[] = cut.decisions.map((d) => ({
    ...d.row,
    rank: d.rank,
    lgaRank: perLga.get(d.row.registrationId) ?? 0,
    outcome: d.outcome,
  }));

  return {
    standings,
    advanced: cut.advanced,
    eliminated: cut.eliminated,
    cutScore: cut.cutScore,
    tied: cut.tiedAtCut.map((s) => ({
      registrationId: s.registrationId,
      schoolName: s.schoolName,
      score: s.score,
    })),
    rule: scoreRule,
    topN,
  };
}

function cutoffFromForm(formData: FormData): CutoffRule | null {
  const kind = String(formData.get("cut_kind") ?? "");
  if (kind === "top_n") {
    const n = Number(formData.get("cut_n"));
    return Number.isInteger(n) && n > 0 ? { kind: "top_n", n } : null;
  }
  if (kind === "min_score") {
    const min = Number(formData.get("cut_min"));
    return Number.isFinite(min) ? { kind: "min_score", min } : null;
  }
  return null;
}

export async function commitCut(
  examId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireManage(MODULE))) return denied;
  const supabase = await createClient();
  const editable = await loadEditableExam(supabase, examId);
  if (!editable.ok) return notEditable(editable.reason);

  const rule = cutoffFromForm(formData);
  if (!rule) return { ok: false, error: "Choose a cutoff rule and its number first." };
  const preview = await previewCut(examId, rule);
  if (!preview) return { ok: false, error: "Could not read the standings for this exam." };
  // A tie across the cut is never broken by sort order.
  if (preview.tied.length > 0) {
    return {
      ok: false,
      error: `${preview.tied.length} schools are tied across the cut. Widen the count or record a face-off — a national tie is not settled by sort order.`,
    };
  }

  const reasonRaw = String(formData.get("reason") ?? "").trim();
  const reason = (QUALIFICATION_REASONS as readonly string[]).includes(reasonRaw)
    ? reasonRaw
    : null;

  const rows = preview.standings.map((s) => ({
    registration_id: s.registrationId,
    outcome: s.outcome,
    score: s.score,
    score_max: s.scoreMax,
    reason: s.outcome === "advanced" ? reason : null,
    lga_rank: s.lgaRank,
    state_rank: s.rank,
    note: null,
  }));

  const { error } = await supabase.rpc("commit_paper_cut", { p_exam_id: examId, p_rows: rows });
  if (error) return { ok: false, error: describe(error, "commit the cut") };

  const { error: statusError } = await supabase
    .from("paper_exams")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", examId);
  if (statusError) {
    return {
      ok: false,
      error: `The outcomes were committed, but marking the exam published failed: ${statusError.message}`,
    };
  }

  revalidatePath(`${BASE}/${examId}`);
  revalidatePath("/portal/admin/participants");
  revalidatePath("/portal/school");
  revalidatePath("/portal/student");
  const advanced = rows.filter((r) => r.outcome === "advanced").length;
  return {
    ok: true,
    message: `Committed ${rows.length} school decisions — ${advanced} advanced.`,
  };
}

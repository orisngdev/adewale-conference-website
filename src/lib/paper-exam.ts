// Paper-exam domain logic: grading, school aggregation, ranking, cutoff.
//
// gradePaper() mirrors public.grade_paper() in
// 20260909090300_paper_exam_rpcs.sql — the SQL is authoritative at commit, this
// copy drives the import preview. Change one, change both.

// Both A-D and A-E sheets are in use — the 2025 key has an E at item 20 — so the
// letters are the outer bound and the exam's own option_count decides how many
// of them are real. An E on a four-option paper is a misread, not an answer.
export const PAPER_ANSWERS = ["A", "B", "C", "D", "E"] as const;
export type Answer = (typeof PAPER_ANSWERS)[number];

export const DEFAULT_OPTION_COUNT = 4;

/** The letters a given sheet actually offers. */
export function answerLetters(optionCount: number): Answer[] {
  const n = Math.min(Math.max(Math.trunc(optionCount) || DEFAULT_OPTION_COUNT, 2), PAPER_ANSWERS.length);
  return PAPER_ANSWERS.slice(0, n) as Answer[];
}

/** Is this letter on the sheet? */
export function isAnswerInRange(letter: string, optionCount: number): boolean {
  return (answerLetters(optionCount) as string[]).includes(letter.toUpperCase());
}

/** A letter, `null` for blank, or `"?"` for an unreadable or multi-bubbled
 *  mark. Neither null nor "?" can ever be correct. */
export type Response = Answer | "?" | null;

export const KEY_VERSIONS = ["A", "B", "C", "D"] as const;
export type KeyVersion = (typeof KEY_VERSIONS)[number];

export interface PaperItem {
  position: number; // 1-based, as printed
  subject: string;
  correct: Answer;
}

export interface SubjectScore {
  correct: number;
  out_of: number;
}

/** Stored as student_stage_results.breakdown; keys spelled as paper_exams.subjects. */
export type Breakdown = Record<string, SubjectScore>;

export interface GradeResult {
  total: number;
  out_of: number;
  attempted: number;
  invalid: number;
  subscores: Breakdown;
}

/** Grade one paper against one key version. `responses` is index-0-based
 *  (index 0 = item 1); a missing entry counts as blank. */
export function gradePaper(items: PaperItem[], responses: readonly Response[]): GradeResult {
  const subscores: Breakdown = {};
  let total = 0;
  let attempted = 0;
  let invalid = 0;

  for (const item of items) {
    const choice = responses[item.position - 1] ?? null;
    const isCorrect = choice === item.correct;
    if (choice === "?") invalid++;
    else if (choice !== null) attempted++;

    const bucket = (subscores[item.subject] ??= { correct: 0, out_of: 0 });
    bucket.out_of++;
    if (isCorrect) {
      bucket.correct++;
      total++;
    }
  }

  return { total, out_of: items.length, attempted, invalid, subscores };
}

// ── authoring the key ───────────────────────────────────────────────────────

/** Which of the two fields an error belongs to, so the form can mark it. */
export type KeyField = "answers" | "subjects";

export interface KeyError {
  field: KeyField;
  message: string;
}

export interface KeyParseResult {
  items: PaperItem[];
  errors: KeyError[];
}

const RANGE_RE = /^\s*(\d{1,3})\s*(?:-|–|—|to|\.\.)\s*(\d{1,3})\s*[,:;]?\s*(.+?)\s*$/i;
const SINGLE_RE = /^\s*(\d{1,3})\s*[,:;]\s*(.+?)\s*$/;
const POSITIONAL_ANSWER_RE = /^\s*(\d{1,3})\s*[,:;.)\s]\s*([A-Ea-e])\s*$/;

function outOfRange(letters: string, optionCount: number): string {
  const range = answerLetters(optionCount);
  return `Answer “${letters}” is not on this paper — its questions have ${optionCount} options, ${range[0]} to ${range[range.length - 1]}. Change the paper's options if that is wrong.`;
}

function normalizeSubject(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Accepts a bare run of letters (`ABDC…`) or one line per item (`1,A` / `1. A`). */
function readAnswers(
  raw: string,
  itemCount: number,
  optionCount: number,
  errors: KeyError[],
): { answers: (Answer | null)[]; countReported: boolean } {
  const out: (Answer | null)[] = Array(itemCount).fill(null);
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const positional = lines.length > 0 && POSITIONAL_ANSWER_RE.test(lines[0]);

  if (positional) {
    for (const line of lines) {
      const m = POSITIONAL_ANSWER_RE.exec(line);
      if (!m) {
        errors.push({ field: "answers", message: `Could not read the answer line “${line}”. Use “12,B”.` });
        continue;
      }
      const position = Number(m[1]);
      if (position < 1 || position > itemCount) {
        errors.push({ field: "answers", message: `Question ${position} is outside this paper's 1–${itemCount}.` });
        continue;
      }
      const letter = m[2].toUpperCase();
      if (!isAnswerInRange(letter, optionCount)) {
        errors.push({ field: "answers", message: outOfRange(letter, optionCount) });
        continue;
      }
      out[position - 1] = letter as Answer;
    }
    return { answers: out, countReported: false };
  }

  const letters = raw.replace(/[^A-Ea-e]/g, "").toUpperCase();
  const countReported = letters.length !== itemCount;
  if (countReported) {
    const short = itemCount - letters.length;
    errors.push({
      field: "answers",
      message:
        short > 0
          ? `Found ${letters.length} answers, but this paper has ${itemCount} questions — ${short} short. Paste one letter per question, or one “12,B” line per question.`
          : `Found ${letters.length} answers, but this paper has only ${itemCount} questions.`,
    });
  }
  const beyond = [...new Set(letters.split("").filter((l) => !isAnswerInRange(l, optionCount)))];
  if (beyond.length) {
    errors.push({ field: "answers", message: outOfRange(beyond.join(", "), optionCount) });
  }
  for (let i = 0; i < Math.min(letters.length, itemCount); i++) {
    out[i] = letters[i] as Answer;
  }
  return { answers: out, countReported };
}

/** Blank means one subject everywhere; `cycle` rotates the list item by item;
 *  otherwise ranges or single items. Blank with several subjects is an error, not
 *  a guess — guessing wrong mis-tags every item in every student's breakdown. */
function readSubjectMap(
  raw: string,
  subjects: string[],
  itemCount: number,
  errors: KeyError[],
): (string | null)[] {
  const out: (string | null)[] = Array(itemCount).fill(null);
  const canonical = new Map(subjects.map((s) => [normalizeSubject(s), s]));
  const resolve = (name: string): string | null => canonical.get(normalizeSubject(name)) ?? null;

  const trimmed = raw.trim();

  if (!trimmed) {
    if (subjects.length === 1) return out.fill(subjects[0]);
    errors.push({
      field: "subjects",
      message:
        "Say which questions belong to which subject — ranges like “1-25 Mathematics”, or the word “cycle” if the subjects rotate question by question.",
    });
    return out;
  }

  if (trimmed.toLowerCase() === "cycle") {
    if (subjects.length === 0) {
      errors.push({ field: "subjects", message: "This exam has no subjects yet." });
      return out;
    }
    for (let i = 0; i < itemCount; i++) out[i] = subjects[i % subjects.length];
    return out;
  }

  for (const line of trimmed.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const range = RANGE_RE.exec(line);
    const single = range ? null : SINGLE_RE.exec(line);
    if (!range && !single) {
      errors.push({
        field: "subjects",
        message: `Could not read “${line}”. Use “1-25 Mathematics” or “7, Mathematics”.`,
      });
      continue;
    }

    const from = Number(range ? range[1] : single![1]);
    const to = range ? Number(range[2]) : from;
    const name = (range ? range[3] : single![2]).trim();

    const subject = resolve(name);
    if (!subject) {
      errors.push({
        field: "subjects",
        message: `“${name}” is not one of this exam's subjects (${subjects.join(", ") || "none set"}).`,
      });
      continue;
    }
    if (from < 1 || to > itemCount || from > to) {
      errors.push({
        field: "subjects",
        message: `Questions ${from}–${to} are outside this paper's 1–${itemCount}.`,
      });
      continue;
    }
    for (let p = from; p <= to; p++) out[p - 1] = subject;
  }
  return out;
}

/** Build the key for one version from what an admin pasted. */
export function parseAnswerKey(input: {
  answers: string;
  subjects: string[];
  subjectMap?: string;
  itemCount: number;
  /** How many bubbles each question has, from paper_exams.option_count. */
  optionCount?: number;
}): KeyParseResult {
  const { answers, subjects, subjectMap, itemCount } = input;
  const optionCount = input.optionCount ?? DEFAULT_OPTION_COUNT;
  const errors: KeyError[] = [];

  if (itemCount < 1) {
    return { items: [], errors: [{ field: "answers", message: "This paper has no questions." }] };
  }

  const { answers: letters, countReported } = readAnswers(answers, itemCount, optionCount, errors);
  const mapped = readSubjectMap(subjectMap ?? "", subjects, itemCount, errors);

  const missingAnswers: number[] = [];
  const missingSubjects: number[] = [];
  const items: PaperItem[] = [];

  for (let i = 0; i < itemCount; i++) {
    const correct = letters[i];
    const subject = mapped[i];
    if (!correct) missingAnswers.push(i + 1);
    if (!subject) missingSubjects.push(i + 1);
    if (correct && subject) items.push({ position: i + 1, subject, correct });
  }

  // A partial key scores every unlisted item wrong for everyone, so reject it
  // outright — but a wrong total already explains which are missing.
  if (missingAnswers.length && !countReported) {
    errors.push({
      field: "answers",
      message: `No answer given for question${plural(missingAnswers)} ${summarise(missingAnswers)}.`,
    });
  }
  if (missingSubjects.length) {
    errors.push({
      field: "subjects",
      message: `No subject given for question${plural(missingSubjects)} ${summarise(missingSubjects)}.`,
    });
  }

  return { items: errors.length ? [] : items, errors };
}

function plural(list: number[]): string {
  return list.length === 1 ? "" : "s";
}

/** Compress a list of item numbers into ranges so an error names 1–25 rather
 *  than twenty-five separate numbers. */
function summarise(list: number[]): string {
  const parts: string[] = [];
  let start = list[0];
  let previous = list[0];
  for (const n of list.slice(1)) {
    if (n === previous + 1) {
      previous = n;
      continue;
    }
    parts.push(start === previous ? `${start}` : `${start}–${previous}`);
    start = n;
    previous = n;
  }
  parts.push(start === previous ? `${start}` : `${start}–${previous}`);
  const shown = parts.slice(0, 6).join(", ");
  return parts.length > 6 ? `${shown} and ${parts.length - 6} more` : shown;
}

/** 1-based positions where our key and the tool's disagree — the cheapest
 *  signal that the wrong quiz was exported or the key was mistyped. */
export function compareKeys(
  items: PaperItem[],
  capturedKey: readonly Response[],
): number[] {
  const out: number[] = [];
  for (const item of items) {
    const theirs = capturedKey[item.position - 1] ?? null;
    if (theirs !== null && theirs !== item.correct) out.push(item.position);
  }
  return out;
}

export function percent(total: number, outOf: number): number {
  if (!outOf) return 0;
  return Math.round((total / outOf) * 1000) / 10;
}

// ── where an exam has got to ────────────────────────────────────────────────
// Derived from what exists, never read off a label. `paper_exams.status` moves
// exactly once — to 'published', when a cutoff is committed — so showing it raw
// reported "draft" on an exam whose key was authored, whose papers were imported
// and graded, and whose answers had been released to students. A phase computed
// from facts cannot drift from them.

export type PaperExamPhaseKey =
  | "draft"
  | "key"
  | "ready"
  | "grading"
  | "scored"
  | "published";

export interface PaperExamFacts {
  /** Every item of copy A has an answer and a subject. */
  keyComplete: boolean;
  /** Candidate numbers allocated — or a past sitting, where the students
   *  already carry the numbers that were on their sheets. */
  sheetsReady: boolean;
  hasStagedImport: boolean;
  hasCommittedImport: boolean;
  /** A cutoff has been committed, so the schools carry outcomes. */
  published: boolean;
  isBackfill?: boolean;
}

export interface PaperExamPhase {
  key: PaperExamPhaseKey;
  label: string;
  /** What has to be true to leave this phase. */
  hint: string;
  tone: "neutral" | "progress" | "done";
}

export function paperExamPhase(f: PaperExamFacts): PaperExamPhase {
  if (f.published)
    return {
      key: "published",
      label: "Published",
      hint: "Outcomes are committed and students can see their results.",
      tone: "done",
    };
  if (f.hasCommittedImport)
    return {
      key: "scored",
      label: "Scored",
      hint: "Every rep has a score. Rank the schools and commit a cutoff to publish.",
      tone: "progress",
    };
  if (f.hasStagedImport)
    return {
      key: "grading",
      label: "Grading",
      hint: "Papers are staged. Resolve the ones needing a decision, then commit them.",
      tone: "progress",
    };
  if (f.keyComplete && f.sheetsReady)
    return {
      key: "ready",
      label: f.isBackfill ? "Ready to import" : "Ready to sit",
      hint: f.isBackfill
        ? "Import the capture file from the sitting."
        : "Print the sheets, sit the paper, then import the capture file.",
      tone: "progress",
    };
  if (f.keyComplete)
    return {
      key: "key",
      label: "Key set",
      hint: f.isBackfill
        ? "The students already carry their candidate numbers."
        : "Allocate candidate numbers and download the roster.",
      tone: "progress",
    };
  return {
    key: "draft",
    label: "Draft",
    hint: "Set the answer key and each item's subject.",
    tone: "neutral",
  };
}

// ── school aggregation ──────────────────────────────────────────────────────

export const SCHOOL_SCORE_RULES = ["sum_all", "sum_top_n", "mean_present", "best"] as const;
export type SchoolScoreRule = (typeof SCHOOL_SCORE_RULES)[number];

export const SCHOOL_SCORE_RULE_LABELS: Record<SchoolScoreRule, string> = {
  sum_all: "Sum of all reps",
  sum_top_n: "Sum of the top N reps",
  mean_present: "Average of the reps who sat",
  best: "Best single rep",
};

export interface RepScore {
  studentId: string;
  total: number;
  outOf: number;
}

export interface SchoolScore {
  score: number;
  score_max: number;
  counted: number;
}

/** The rule is stored per exam, so the ranking screen can state which one
 *  produced its numbers. */
export function aggregateSchoolScore(
  reps: readonly RepScore[],
  rule: SchoolScoreRule,
  topN = 3,
): SchoolScore {
  if (reps.length === 0) return { score: 0, score_max: 0, counted: 0 };
  const sorted = [...reps].sort((a, b) => b.total - a.total);

  switch (rule) {
    case "best": {
      const top = sorted[0];
      return { score: top.total, score_max: top.outOf, counted: 1 };
    }
    case "sum_top_n": {
      const taken = sorted.slice(0, Math.max(1, topN));
      return {
        score: sum(taken.map((r) => r.total)),
        // Full N even when fewer reps sat: two of three is scored out of three.
        score_max: (taken[0]?.outOf ?? 0) * Math.max(1, topN),
        counted: taken.length,
      };
    }
    case "mean_present": {
      const mean = sum(sorted.map((r) => r.total)) / sorted.length;
      return {
        score: Math.round(mean * 100) / 100,
        score_max: sorted[0].outOf,
        counted: sorted.length,
      };
    }
    case "sum_all":
    default:
      return {
        score: sum(sorted.map((r) => r.total)),
        score_max: sum(sorted.map((r) => r.outOf)),
        counted: sorted.length,
      };
  }
}

function sum(ns: readonly number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

// ── ranking ─────────────────────────────────────────────────────────────────

export interface Ranked<T> {
  row: T;
  rank: number;
}

/** Competition ranking: ties share a rank and the next one skips (10, 10, 12).
 *  `groupBy` gives independent ladders, which is how per-LGA rank is derived. */
export function rankBy<T>(
  rows: readonly T[],
  score: (row: T) => number,
  groupBy?: (row: T) => string,
): Ranked<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = groupBy ? groupBy(row) : "";
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const out: Ranked<T>[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => score(b) - score(a));
    let rank = 0;
    let seen = 0;
    let previous: number | null = null;
    for (const row of sorted) {
      seen++;
      const s = score(row);
      if (previous === null || s !== previous) {
        rank = seen;
        previous = s;
      }
      out.push({ row, rank });
    }
  }
  return out;
}

// ── cutoff ──────────────────────────────────────────────────────────────────

export type CutoffRule =
  | { kind: "top_n"; n: number }
  | { kind: "min_score"; min: number };

export interface CutoffOutcome<T> {
  row: T;
  rank: number;
  outcome: "advanced" | "eliminated";
}

export interface CutoffPreview<T> {
  decisions: CutoffOutcome<T>[];
  advanced: number;
  eliminated: number;
  /** The score at the boundary, when the rule produces one. */
  cutScore: number | null;
  /** Rows sharing the boundary score when it straddles the cut — some in, some
   *  out. Blocks commit; the alternative is breaking a tie by sort order. */
  tiedAtCut: T[];
}

export function applyCutoff<T>(
  ranked: readonly Ranked<T>[],
  score: (row: T) => number,
  rule: CutoffRule,
): CutoffPreview<T> {
  const sorted = [...ranked].sort(
    (a, b) => score(b.row) - score(a.row) || a.rank - b.rank,
  );

  const advances = (entry: Ranked<T>, index: number): boolean =>
    rule.kind === "top_n" ? index < rule.n : score(entry.row) >= rule.min;

  const decisions = sorted.map((entry, i) => ({
    row: entry.row,
    rank: entry.rank,
    outcome: (advances(entry, i) ? "advanced" : "eliminated") as
      | "advanced"
      | "eliminated",
  }));

  const advanced = decisions.filter((d) => d.outcome === "advanced").length;
  const cutScore =
    rule.kind === "min_score"
      ? rule.min
      : advanced > 0 && advanced <= sorted.length
        ? score(sorted[advanced - 1].row)
        : null;

  // A min_score rule cannot split a tie: everyone on the threshold clears it.
  let tiedAtCut: T[] = [];
  if (rule.kind === "top_n" && cutScore !== null) {
    const onBoundary = decisions.filter((d) => score(d.row) === cutScore);
    const split =
      onBoundary.some((d) => d.outcome === "advanced") &&
      onBoundary.some((d) => d.outcome === "eliminated");
    if (split) tiedAtCut = onBoundary.map((d) => d.row);
  }

  return {
    decisions,
    advanced,
    eliminated: decisions.length - advanced,
    cutScore,
    tiedAtCut,
  };
}

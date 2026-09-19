// The only ZipGrade-aware module; everything downstream consumes RawPaper[].
// ZipGrade has no API and does not document its export columns, so the header is
// sniffed: named columns via an alias table, per-question series by pattern
// rather than by offset. A file we cannot read is refused, never half-imported.

import { createHash } from "crypto";
import type { CsvCell } from "@/lib/csv";
import { stripBom } from "@/lib/csv";
import {
  DEFAULT_OPTION_COUNT,
  formatCandidateNumber,
  isAnswerInRange,
  KEY_VERSIONS,
  PAPER_ANSWERS,
  type KeyVersion,
  type Response,
} from "@/lib/paper-exam";

/** One captured sheet, capture-tool-agnostic. */
export interface RawPaper {
  /** 1-based data row in the source file, for tracing a finding back. */
  rowIndex: number;
  externalId: string | null;
  examNo: string | null;
  firstName: string | null;
  lastName: string | null;
  className: string | null;
  /** Free text. The 2025 sitting put the school here, so it is a matching hint. */
  customId: string | null;
  keyVersion: KeyVersion | null;
  /** Index 0 = item 1. */
  responses: Response[];
  /** The tool's own total and key. Cross-checked against ours, never scored. */
  captureNumCorrect: number | null;
  capturedKey: Response[] | null;
  raw: Record<string, string>;
}

export const NAMED_FIELDS = [
  "externalId",
  "examNo",
  "firstName",
  "lastName",
  "studentName",
  "className",
  "quizName",
  "captureNumCorrect",
  "possiblePoints",
  "percentCorrect",
  "customId",
  "exportedAt",
  "keyVersion",
  "capturedAt",
] as const;
export type NamedField = (typeof NAMED_FIELDS)[number];

/** Accepted spellings, already normalized; first match wins for a column. */
export const HEADER_ALIASES: Record<string, NamedField> = {
  externalid: "externalId",
  external: "externalId",
  extid: "externalId",
  externalstudentid: "externalId",
  studentid: "examNo",
  zipgradeid: "examNo",
  studentnumber: "examNo",
  candidateno: "examNo",
  candidatenumber: "examNo",
  id: "examNo",
  firstname: "firstName",
  first: "firstName",
  fname: "firstName",
  studentfirstname: "firstName",
  lastname: "lastName",
  last: "lastName",
  lname: "lastName",
  surname: "lastName",
  studentlastname: "lastName",
  studentname: "studentName",
  name: "studentName",
  fullname: "studentName",
  customid: "customId",
  custom: "customId",
  class: "className",
  classname: "className",
  quizclass: "className",
  section: "className",
  quizname: "quizName",
  quiz: "quizName",
  quiztitle: "quizName",
  numcorrect: "captureNumCorrect",
  earnedpoints: "captureNumCorrect",
  correct: "captureNumCorrect",
  score: "captureNumCorrect",
  possiblepoints: "possiblePoints",
  numquestions: "possiblePoints",
  totalquestions: "possiblePoints",
  keyversion: "keyVersion",
  key: "keyVersion",
  version: "keyVersion",
  form: "keyVersion",
  datecreated: "capturedAt",
  quizcreated: "capturedAt",
  dataexported: "exportedAt",
  percentcorrect: "percentCorrect",
  dateuploaded: "capturedAt",
  quizdate: "capturedAt",
  date: "capturedAt",
  timestamp: "capturedAt",
};

/** `External Id`, `external_id` and `ExternalID` all collapse to `externalid`.
 *  Separate from normalizeSchoolName, which is index-locked by check:normalizers. */
export function normalizeHeaderKey(header: string): string {
  return stripBom(header).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export interface HeaderMap {
  /** Column index per named field. */
  fields: Partial<Record<NamedField, number>>;
  /** Column index per item, index 0 = item 1. */
  responseColumns: number[];
  /** The tool's own key series, if present. */
  keyColumns: number[] | null;
  /** Headers we recognised as nothing — shown to the operator, never guessed at. */
  unmapped: string[];
  warnings: string[];
}

export type SniffResult =
  | { ok: true; map: HeaderMap }
  | { ok: false; error: string; headers: string[] };

interface Series {
  prefix: string;
  columns: number[]; // index by number-1
}

/** The export interleaves `Stu1,PriKey1,Points1,Mark1,Stu2,…` and two of those
 *  series are the tool's own marking. They must not be mistaken for answers:
 *  Points is 0/1 and Mark is C/X, both of which parse as plausible letters, so a
 *  mis-picked series is a fileful of silently wrong scores rather than an error. */
const DERIVED_SERIES = /^(points?|pts|marks?|score[ds]?|earned|possible|percent|correct)$/;

export function isDerivedSeriesHeader(header: string): boolean {
  const m = /^(.*?)(\d{1,3})$/.exec(normalizeHeaderKey(header));
  return m ? DERIVED_SERIES.test(m[1]) : false;
}

/** `prefix<number>` groups whose numbers form a contiguous run from 1. */
function findSeries(headers: string[], claimed: Set<number>): Series[] {
  const groups = new Map<string, Map<number, number>>();
  headers.forEach((raw, col) => {
    if (claimed.has(col)) return;
    const key = normalizeHeaderKey(raw);
    const m = /^(.*?)(\d{1,3})$/.exec(key);
    if (!m) return;
    if (DERIVED_SERIES.test(m[1])) return;
    const n = Number(m[2]);
    if (n < 1 || n > 100) return;
    const bucket = groups.get(m[1]) ?? new Map<number, number>();
    if (!bucket.has(n)) bucket.set(n, col);
    groups.set(m[1], bucket);
  });

  const out: Series[] = [];
  for (const [prefix, bucket] of groups) {
    const columns: number[] = [];
    // A gap ends the run, so a stray `col7` cannot masquerade as a series.
    for (let n = 1; bucket.has(n); n++) columns.push(bucket.get(n)!);
    if (columns.length >= 1) out.push({ prefix, columns });
  }
  return out.sort((a, b) => b.columns.length - a.columns.length);
}

const KEY_PREFIX = /(key|ans|answer|correct)/;

/** Responses or key? Prefix keyword first; if silent, decide on the data —
 *  responses vary between students, a key is identical on every row. */
function classifySeries(
  candidates: Series[],
  sampleRows: readonly string[][],
): { responses: Series; key: Series | null } {
  if (candidates.length === 1) return { responses: candidates[0], key: null };

  const keyish = candidates.filter((s) => KEY_PREFIX.test(s.prefix));
  const plain = candidates.filter((s) => !KEY_PREFIX.test(s.prefix));
  if (plain.length === 1 && keyish.length >= 1) {
    return { responses: plain[0], key: keyish[0] };
  }

  const varies = (s: Series): boolean => {
    if (sampleRows.length < 2) return true;
    const signature = (row: string[]) => s.columns.map((c) => row[c] ?? "").join("|");
    const first = signature(sampleRows[0]);
    return sampleRows.some((row) => signature(row) !== first);
  };

  const varying = candidates.filter(varies);
  const constant = candidates.filter((s) => !varies(s));
  if (varying.length >= 1 && constant.length >= 1) {
    return { responses: varying[0], key: constant[0] };
  }
  return { responses: candidates[0], key: candidates[1] ?? null };
}

/** A series must start at 1 and be at least `itemCount` long; extra columns are
 *  ignored with a warning. Pass the first ~20 data rows as `sampleRows` so the
 *  response/key tie-break can look at the data when the names are silent. */
export function sniffZipGradeHeader(
  headers: string[],
  itemCount: number,
  sampleRows: readonly string[][] = [],
): SniffResult {
  const warnings: string[] = [];
  const fields: Partial<Record<NamedField, number>> = {};
  const claimed = new Set<number>();

  headers.forEach((raw, col) => {
    const field = HEADER_ALIASES[normalizeHeaderKey(raw)];
    if (field && fields[field] === undefined) {
      fields[field] = col;
      claimed.add(col);
    }
  });

  const runs = findSeries(headers, claimed);
  const candidates = runs.filter((s) => s.columns.length >= itemCount);
  if (candidates.length === 0) {
    const longest = runs[0]?.columns.length ?? 0;
    return {
      ok: false,
      error: longest
        ? `The longest run of per-question columns is 1–${longest}, but this paper exam has ${itemCount} items. Check the exam's item count, or re-export the “Full Format (with student responses)” report.`
        : "No per-question response columns found. Export the “Full Format (with student responses)” report — the summary export has no per-question answers.",
      headers,
    };
  }

  const { responses, key } = classifySeries(candidates, sampleRows);
  if (responses.columns.length > itemCount) {
    warnings.push(
      `The file carries ${responses.columns.length} response columns; only items 1–${itemCount} are scored.`,
    );
  }

  // Counted, not listed: 200 lines of them would bury a real unread header.
  const ignoredDerived = headers.filter(
    (h, col) => !claimed.has(col) && isDerivedSeriesHeader(h),
  ).length;
  if (ignoredDerived) {
    warnings.push(
      `Ignored ${ignoredDerived} per-question scoring columns (Points/Mark) — marking is done here, from the answers.`,
    );
  }

  const unmapped = headers.filter(
    (h, col) =>
      !claimed.has(col) &&
      !responses.columns.includes(col) &&
      !(key?.columns ?? []).includes(col) &&
      !isDerivedSeriesHeader(h),
  );

  if (fields.externalId === undefined && fields.examNo === undefined) {
    warnings.push(
      "Neither an External ID nor a Student ID column was found — every row will have to be matched by name.",
    );
  }

  return {
    ok: true,
    map: {
      fields,
      responseColumns: responses.columns.slice(0, itemCount),
      keyColumns: key ? key.columns.slice(0, itemCount) : null,
      unmapped,
      warnings,
    },
  };
}

/** One captured mark. Blank -> null, a letter -> itself, an index -> its letter
 *  (some exports emit 1-5), anything else -> '?', counted wrong and warned
 *  about: an unreadable mark is a fact about the sheet, not a parse failure to
 *  hide. A letter beyond the sheet's own options is one of those facts — an E
 *  off a four-option paper is a misread, and scoring it would hide that. */
export function parseAnswer(
  cell: string | undefined | null,
  optionCount: number = DEFAULT_OPTION_COUNT,
): Response {
  const s = (cell ?? "").trim().toUpperCase().replace(/[.\s]/g, "");
  if (s === "" || s === "-") return null;
  const letter = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E" }[s] ?? s;
  if (/^[A-E]$/.test(letter)) {
    return isAnswerInRange(letter, optionCount) ? (letter as Response) : "?";
  }
  return "?"; // '*', 'AB', 'CE' — a double-bubble or an unreadable mark.
}

function cell(row: string[], col: number | undefined): string | null {
  if (col === undefined) return null;
  const v = (row[col] ?? "").trim();
  return v === "" ? null : v;
}

function parseKeyVersion(value: string | null): KeyVersion | null {
  if (!value) return null;
  const first = value.trim().toUpperCase().replace(/^KEY\s*/, "").charAt(0);
  return (KEY_VERSIONS as readonly string[]).includes(first) ? (first as KeyVersion) : null;
}

/** Last whitespace token is the surname; also handles "SURNAME, First". A
 *  single-token name gets "-", since the roster import requires both fields. */
export function splitName(full: string): { first: string; last: string } {
  const trimmed = full.trim().replace(/\s+/g, " ");
  if (!trimmed) return { first: "", last: "-" };
  const comma = trimmed.indexOf(",");
  if (comma > 0) {
    const last = trimmed.slice(0, comma).trim();
    const first = trimmed.slice(comma + 1).trim();
    return { first: first || "-", last: last || "-" };
  }
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "-" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

/** Stable identity for a sheet: re-importing the same file is a no-op, while a
 *  genuinely different second sheet for one student still forces a decision. */
export function paperFingerprint(
  examId: string,
  paper: {
    externalId: string | null;
    examNo: string | null;
    firstName: string | null;
    lastName: string | null;
    responses: readonly Response[];
  },
): string {
  const parts = [
    examId,
    paper.externalId ?? "",
    paper.examNo ?? "",
    (paper.firstName ?? "").toLowerCase(),
    (paper.lastName ?? "").toLowerCase(),
    paper.responses.map((r) => r ?? "_").join(""),
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

/** Read every data row into RawPaper[]. `grid` includes the header row. */
export function readPapers(
  grid: string[][],
  map: HeaderMap,
  itemCount: number,
  optionCount: number = DEFAULT_OPTION_COUNT,
): RawPaper[] {
  const header = grid[0] ?? [];
  return grid.slice(1).map((row, i) => {
    const raw: Record<string, string> = {};
    header.forEach((h, c) => {
      raw[h.trim() || `col${c}`] = row[c] ?? "";
    });

    const named = cell(row, map.fields.studentName);
    const split = named ? splitName(named) : null;
    const first = cell(row, map.fields.firstName) ?? split?.first ?? null;
    const last = cell(row, map.fields.lastName) ?? split?.last ?? null;

    const numCorrect = cell(row, map.fields.captureNumCorrect);
    return {
      rowIndex: i + 1,
      externalId: cell(row, map.fields.externalId),
      examNo: cell(row, map.fields.examNo),
      firstName: first,
      lastName: last,
      className: cell(row, map.fields.className),
      customId: cell(row, map.fields.customId),
      keyVersion: parseKeyVersion(cell(row, map.fields.keyVersion)),
      responses: map.responseColumns
        .slice(0, itemCount)
        .map((c) => parseAnswer(row[c], optionCount)),
      captureNumCorrect: numCorrect !== null && /^\d+$/.test(numCorrect) ? Number(numCorrect) : null,
      // Read at full range on purpose: the clamp models what a bubble sheet can
      // physically carry, and the tool's key is typed in, not scanned. An E here
      // against a four-option exam is a real disagreement to surface, not noise.
      capturedKey: map.keyColumns
        ? map.keyColumns.slice(0, itemCount).map((c) => parseAnswer(row[c], PAPER_ANSWERS.length))
        : null,
      raw,
    };
  });
}

/** The key the export carries, as a run of letters ready to paste into the key
 *  editor — the real export repeats it on every row as `PriKey1…PriKey100`, so
 *  nobody needs to retype 100 answers. Null unless it is complete and every row
 *  agrees; a disagreement means the file mixes key versions and a single run of
 *  letters would be a lie. */
export function readCapturedKey(
  papers: readonly RawPaper[],
  itemCount: number,
): string | null {
  let agreed: string | null = null;
  for (const paper of papers) {
    if (!paper.capturedKey) continue;
    const letters = paper.capturedKey.slice(0, itemCount);
    if (letters.length !== itemCount || letters.some((r) => r === null || r === "?")) continue;
    const run = letters.join("");
    if (agreed === null) agreed = run;
    else if (agreed !== run) return null;
  }
  return agreed;
}

/** The quiz name the file claims, for the wrong-export check. */
export function readQuizName(grid: string[][], map: HeaderMap): string | null {
  const col = map.fields.quizName;
  if (col === undefined) return null;
  for (const row of grid.slice(1)) {
    const v = (row[col] ?? "").trim();
    if (v) return v;
  }
  return null;
}

export interface RosterRow {
  /** The 3-digit bubbled number — the identity results come back on. */
  examNo: string;
  name: string;
  /** SS1 / SS2. */
  className: string | null;
  schoolName: string | null;
  /** The teacher bringing the reps to the centre, not the principal. */
  teacherName: string | null;
}

/** The roster in the capture tool's student-import shape.
 *
 *  Identity rests entirely on `Student ID`, the candidate number. There is
 *  deliberately no External ID column: the access code IS the auth password for
 *  code-login students (student-accounts.ts), so nothing beyond the candidate
 *  number is worth handing a third party.
 *
 *  The school rides in `Custom ID` because that is the one free field the tool
 *  round-trips — the 2025 export has no School column but every row carries
 *  the school in `CustomID`. Teacher is last, for the humans handing out
 *  the packs; if the importer ever refuses the file, delete that column. */
export function zipgradeRosterMatrix(rows: readonly RosterRow[]): CsvCell[][] {
  const matrix: CsvCell[][] = [
    ["First Name", "Last Name", "Student ID", "Class", "Custom ID", "Teacher"],
  ];
  for (const row of rows) {
    const { first, last } = splitName(row.name);
    matrix.push([
      first,
      last,
      formatCandidateNumber(row.examNo),
      row.className ?? "",
      row.schoolName ?? "",
      row.teacherName ?? "",
    ]);
  }
  return matrix;
}

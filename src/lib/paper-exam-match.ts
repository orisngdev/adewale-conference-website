// Matching a captured sheet back to a student. Nothing here ever drops a row: a
// paper that cannot be matched comes back with `confidence: "none"` and the
// nearest candidates, so the operator has something to choose from.

import { normalizeSchoolName } from "@/lib/school-identity";
import type { RawPaper } from "@/lib/zipgrade";

export type MatchMethod = "external_id" | "exam_no" | "name_class" | "manual";
export type MatchConfidence = "exact" | "probable" | "ambiguous" | "none";

export interface RosterCandidate {
  studentId: string;
  name: string;
  schoolId: string | null;
  schoolName: string | null;
  /** From paper_exam_candidates — unique per exam by database constraint. */
  examNo: string | null;
  /** The sheet's Class field — the rep's class, SS1 / SS2. */
  className: string | null;
  /** The rep's class on their student row. */
  level: string | null;
}

export interface Suggestion {
  studentId: string;
  name: string;
  schoolName: string | null;
  /** Why this student is being offered, in words the operator can act on. */
  why: string;
}

export interface MatchResult {
  studentId: string | null;
  method: MatchMethod | null;
  confidence: MatchConfidence;
  /** The number matched but the name on the sheet does not. Still a match — the
   *  bubbled number is the identity — but it must never be a silent one. */
  nameMismatch?: boolean;
  suggestions: Suggestion[];
}

/** Diacritics folded, case and punctuation dropped, whitespace collapsed. A
 *  third normalizer deliberately: normalizeSchoolName is index-locked to a SQL
 *  function and normalizeSearchText keeps spaces for `ilike`. */
export function normalizePersonName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Order-insensitive, so "BRIGHT, ADA" and "Ada Bright" agree. */
export function personNameKey(value: string): string {
  return normalizePersonName(value).split(" ").filter(Boolean).sort().join(" ");
}

function paperName(paper: Pick<RawPaper, "firstName" | "lastName">): string {
  return [paper.firstName ?? "", paper.lastName ?? ""].join(" ").trim();
}

/** Compared numerically: the tool stores its student ID as a number, so a sheet
 *  bubbled `007` comes back as `7`. */
function sameExamNo(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isNaN(na) || Number.isNaN(nb)) return a.trim() === b.trim();
  return na === nb;
}

/** Our student ids are UUIDs. The capture tool's "External ID" is free text and
 *  in practice holds whatever the operator typed — the 2025 sitting used it for
 *  the school name. So a value that is not
 *  UUID-shaped is not a record id, and is treated as a school hint instead of
 *  being compared against every student id. */
function looksLikeRecordId(value: string): boolean {
  return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(value.trim());
}

function sameId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const strip = (s: string) => s.trim().toLowerCase().replace(/-/g, "");
  return strip(a) === strip(b);
}

function sameSchoolName(claimed: string, candidate: RosterCandidate): boolean {
  const norm = normalizeSchoolName(claimed);
  const school = normalizeSchoolName(candidate.schoolName ?? "");
  if (!norm || !school) return false;
  return school === norm || school.includes(norm) || norm.includes(school);
}

function sameClass(claimed: string, candidate: RosterCandidate): boolean {
  const want = normalizePersonName(claimed).replace(/\s+/g, "");
  if (!want) return false;
  return [candidate.className, candidate.level].some((against) => {
    const other = normalizePersonName(against ?? "").replace(/\s+/g, "");
    return other !== "" && other === want;
  });
}

/** What the sheet claims about its owner, strongest discriminator first.
 *
 *  The school is strong: it separates two students who share a name. A class is
 *  weak — it separates them only when they are in different years — so it must
 *  be tried last, or two same-name SS1 reps at different centres stay ambiguous
 *  even though the sheet says which school each came from.
 *
 *  Custom ID is where the 2025 export carried the school. Class is tried as a
 *  school name too, for older files that put a centre or school there. */
function sheetHints(paper: RawPaper): ((candidate: RosterCandidate) => boolean)[] {
  const hints: ((candidate: RosterCandidate) => boolean)[] = [];
  const custom = (paper.customId ?? "").trim();
  const external = (paper.externalId ?? "").trim();
  const claimed = (paper.className ?? "").trim();
  if (custom) hints.push((c) => sameSchoolName(custom, c));
  // Same field under the tool's other name, when it is plainly not a record id.
  if (external && !looksLikeRecordId(external)) {
    hints.push((c) => sameSchoolName(external, c));
  }
  if (claimed) {
    hints.push((c) => sameSchoolName(claimed, c));
    hints.push((c) => sameClass(claimed, c));
  }
  return hints;
}

/** Does anything on the sheet agree with this candidate? For the operator's
 *  benefit only — narrowing uses the hints in order, not this. */
function sheetAgrees(paper: RawPaper, candidate: RosterCandidate): boolean {
  return sheetHints(paper).some((hint) => hint(candidate));
}

function suggest(candidate: RosterCandidate, why: string): Suggestion {
  return {
    studentId: candidate.studentId,
    name: candidate.name,
    schoolName: candidate.schoolName,
    why,
  };
}

/** Students sharing at least one name token, to offer when nothing matched. */
function nearest(paper: RawPaper, roster: readonly RosterCandidate[]): Suggestion[] {
  const tokens = new Set(normalizePersonName(paperName(paper)).split(" ").filter(Boolean));
  if (tokens.size === 0) return [];
  const scored: { candidate: RosterCandidate; shared: number }[] = [];
  for (const candidate of roster) {
    const theirs = normalizePersonName(candidate.name).split(" ").filter(Boolean);
    const shared = theirs.filter((t) => tokens.has(t)).length;
    if (shared > 0) scored.push({ candidate, shared });
  }
  return scored
    .sort((a, b) => b.shared - a.shared || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, 5)
    .map(({ candidate }) =>
      suggest(
        candidate,
        sheetAgrees(paper, candidate)
          ? "part of the name matched, and the class or school agreed"
          : "part of the name matched, but the class and school did not",
      ),
    );
}

export function matchPaper(paper: RawPaper, roster: readonly RosterCandidate[]): MatchResult {
  // 1. A record id from the capture source. Our roster carries none, so this
  //    rung is for an in-app scanner or a hand-edited file.
  if (paper.externalId && looksLikeRecordId(paper.externalId)) {
    const hit = roster.find((c) => sameId(paper.externalId, c.studentId));
    if (hit) {
      return {
        studentId: hit.studentId,
        method: "external_id",
        confidence: "exact",
        suggestions: [],
      };
    }
  }

  // 2. The bubbled candidate number — in practice the identity for a CSV
  //    import, and unique per exam by constraint. With no record id on the
  //    sheet, a mis-bubbled digit lands on the wrong student and only the name
  //    disagreement below catches it; that is what the review list is for.
  if (paper.examNo) {
    const hits = roster.filter((c) => sameExamNo(paper.examNo, c.examNo));
    if (hits.length === 1) {
      // A number is only as good as the hand that bubbled it. When the sheet
      // also carries a name and that name is somebody else, the match stands
      // but stops being "exact" — this is what catches a mis-bubbled digit, and
      // a file exported from the wrong sitting whose numbers happen to overlap.
      const sheetName = personNameKey(paperName(paper));
      const mismatch = sheetName !== "" && sheetName !== personNameKey(hits[0].name);
      return {
        studentId: hits[0].studentId,
        method: "exam_no",
        confidence: mismatch ? "probable" : "exact",
        nameMismatch: mismatch,
        suggestions: mismatch
          ? [suggest(hits[0], `holds candidate number ${paper.examNo}, but the sheet is named “${paperName(paper)}”`)]
          : [],
      };
    }
    if (hits.length > 1) {
      return {
        studentId: null,
        method: null,
        confidence: "ambiguous",
        suggestions: hits.map((c) => suggest(c, `shares candidate number ${paper.examNo}`)),
      };
    }
  }

  // 3. Name, narrowed by the sheet's class or school when it helps.
  const key = personNameKey(paperName(paper));
  if (key) {
    const byName = roster.filter((c) => personNameKey(c.name) === key);
    if (byName.length === 1) {
      return {
        studentId: byName[0].studentId,
        method: "name_class",
        confidence: "probable",
        suggestions: [],
      };
    }
    if (byName.length > 1) {
      for (const hint of sheetHints(paper)) {
        const narrowed = byName.filter(hint);
        if (narrowed.length === 1) {
          return {
            studentId: narrowed[0].studentId,
            method: "name_class",
            confidence: "probable",
            suggestions: [],
          };
        }
      }
      // Same name at two schools and the class does not separate them; a guess
      // assigns a real student's exam to someone else.
      return {
        studentId: null,
        method: null,
        confidence: "ambiguous",
        suggestions: byName.map((c) =>
          suggest(
            c,
            sheetAgrees(paper, c)
              ? "the name matched, and the class or school agreed"
              : "the name matched, but the class and school did not",
          ),
        ),
      };
    }
  }

  return { studentId: null, method: null, confidence: "none", suggestions: nearest(paper, roster) };
}

export interface MatchSummary {
  total: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  /** Rows the operator must decide on before anything can be published. */
  undecided: number;
}

export interface MatchedPaper {
  paper: RawPaper;
  match: MatchResult;
}

/** Match every paper, then demote both rows when two resolved to the same
 *  student: only one sheet can be kept, and which one is a human decision. */
export function matchPapers(
  papers: readonly RawPaper[],
  roster: readonly RosterCandidate[],
): { results: MatchedPaper[]; summary: MatchSummary } {
  const first = papers.map((paper) => ({ paper, match: matchPaper(paper, roster) }));

  const counts = new Map<string, number>();
  for (const { match } of first) {
    if (match.studentId) counts.set(match.studentId, (counts.get(match.studentId) ?? 0) + 1);
  }

  const results = first.map(({ paper, match }) => {
    if (match.studentId && (counts.get(match.studentId) ?? 0) > 1) {
      const clash = roster.find((c) => c.studentId === match.studentId);
      return {
        paper,
        match: {
          studentId: null,
          method: null,
          confidence: "ambiguous" as MatchConfidence,
          suggestions: clash
            ? [suggest(clash, "another sheet in this file matched the same student")]
            : [],
        },
      };
    }
    return { paper, match };
  });

  const matched = results.filter((r) => r.match.studentId !== null).length;
  const ambiguous = results.filter((r) => r.match.confidence === "ambiguous").length;
  const unmatched = results.filter((r) => r.match.confidence === "none").length;

  return {
    results,
    summary: {
      total: results.length,
      matched,
      ambiguous,
      unmatched,
      undecided: ambiguous + unmatched,
    },
  };
}

import { resolveCentreId } from "./exam-centre";
import { searchHaystackMatches } from "./search";
import type { AttendanceStatus } from "@/supabase/types";

/** A candidate as the register shows them: the printed number first, because
 *  that is what is on the desk. */
export type RosterCandidate = {
  studentId: string;
  examNo: string;
  name: string;
  schoolId: string;
  schoolName: string;
  level: string | null;
};

export type AttendanceMark = {
  student_id: string;
  status: AttendanceStatus;
  centre_id: string;
  marked_at: string;
};

/** "unmarked" is a real state, not a missing value: at the end of the day it is
 *  the list a lead still has to account for, and it is not the same as absent. */
export type RosterState = AttendanceStatus | "unmarked";

export type RosterEntry = RosterCandidate & {
  state: RosterState;
  markedAt: string | null;
  /** Where the mark was made, which for a walk-in is not where they were sent. */
  markedAtCentreId: string | null;
};

type CentreRef = { id: string; town?: string | null; legacy_zone: string | null };
type RegistrationRef = {
  school_id: string | null;
  qualification_zone: string | null;
  exam_centre_id?: string | null;
  created_at?: string | null;
};

/**
 * One registration per school, earliest first.
 *
 * 17 historical school-editions have more than one registration and there is no
 * unique constraint stopping another, so joining a roster through `school_id`
 * fans out and counts a school's reps twice. Collapsing here is the same choice
 * the student_editions backfill makes with a lateral.
 */
export function pickRegistrationPerSchool<T extends RegistrationRef>(rows: T[]): Map<string, T> {
  const bySchool = new Map<string, T>();
  for (const row of rows) {
    if (!row.school_id) continue;
    const held = bySchool.get(row.school_id);
    if (!held || (row.created_at ?? "") < (held.created_at ?? "")) {
      bySchool.set(row.school_id, row);
    }
  }
  return bySchool;
}

/** school id → the venue it sits at, or null when nothing allocates it. */
export function schoolCentres(
  registrations: RegistrationRef[],
  centres: CentreRef[],
): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const [schoolId, reg] of pickRegistrationPerSchool(registrations)) {
    out.set(schoolId, resolveCentreId(reg, centres));
  }
  return out;
}

/** Numeric, so 007 sorts before 100 rather than after it. */
export function byExamNo(a: RosterCandidate, b: RosterCandidate) {
  return Number(a.examNo) - Number(b.examNo) || a.name.localeCompare(b.name);
}

export function buildRoster(
  candidates: RosterCandidate[],
  marks: AttendanceMark[],
): RosterEntry[] {
  const byStudent = new Map(marks.map((m) => [m.student_id, m]));
  return candidates
    .map((c) => {
      const mark = byStudent.get(c.studentId);
      return {
        ...c,
        state: (mark?.status ?? "unmarked") as RosterState,
        markedAt: mark?.marked_at ?? null,
        markedAtCentreId: mark?.centre_id ?? null,
      };
    })
    .sort(byExamNo);
}

export type AttendanceCounts = {
  present: number;
  absent: number;
  unmarked: number;
  total: number;
};

export function attendanceCounts(entries: { state: RosterState }[]): AttendanceCounts {
  const counts = { present: 0, absent: 0, unmarked: 0, total: entries.length };
  for (const e of entries) counts[e.state] += 1;
  return counts;
}

/** One row of the append-only history, joined to whoever made it. */
export type AttendanceEvent = {
  student_id: string;
  at: string;
  centre_leads: { name: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

/**
 * The mark that currently stands for each student.
 *
 * Compares timestamps rather than trusting the caller's ORDER BY — the drill-down
 * and the export both need this, and one of them changing its sort must not
 * quietly change who the register says marked a candidate.
 */
export function latestEventByStudent<T extends { student_id: string; at: string }>(
  rows: T[],
): Map<string, T> {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const held = latest.get(row.student_id);
    if (!held || row.at > held.at) latest.set(row.student_id, row);
  }
  return latest;
}

/** Who to name in the register. An admin correction falls back to their email,
 *  then to a role, so a mark is never attributed to nobody. */
export function markerName(event: AttendanceEvent | undefined): string {
  if (!event) return "";
  if (event.centre_leads?.name) return event.centre_leads.name;
  return event.profiles?.full_name || event.profiles?.email || "an admin";
}

/** Name, candidate number or school. A bare number matches the number only, so
 *  typing 042 at a desk does not also return every school with a 42 in it. */
export function matchesCandidate(entry: RosterCandidate, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  if (/^\d{1,3}$/.test(trimmed)) return Number(entry.examNo) === Number(trimmed);
  return searchHaystackMatches([entry.name, entry.schoolName, entry.examNo], trimmed);
}

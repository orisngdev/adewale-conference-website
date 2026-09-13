import type { SupabaseClient } from "@supabase/supabase-js";
import { chunk } from "@/lib/batch";

// Where a rep's published stage score came from, so a stage chip can link to
// the paper behind it. Read with the caller's client: paper_exam_papers' read
// policy already scopes rows to the student, their school and admins.

export interface PaperLink {
  paperId: string;
  href: string;
  subjects: string[] | null;
}

/** studentId -> "stage|edition" -> the paper behind that stage's score.
 *
 *  Keyed by edition as well as stage because a student row is RETAGGED into the
 *  next edition rather than duplicated (sync_retag_students), so one row can
 *  carry a Qualifications result for several years. Keyed by stage alone, last
 *  year's paper would win. */
export type PaperLinkIndex = Map<string, Map<string, PaperLink>>;

export function paperKey(stage: string, editionYear: number | null | undefined): string {
  return `${stage}|${editionYear ?? ""}`;
}

/** A rep's result at one stage OF ONE EDITION. Matching on stage alone is the
 *  bug this exists to prevent: a retagged student keeps every past year's rows,
 *  so last year's score renders as this year's. */
export function resultForStage<T extends { stage: string; edition_year?: number | null }>(
  results: readonly T[],
  stage: string,
  editionYear: number | null,
): T | null {
  return (
    results.find((r) => r.stage === stage && Number(r.edition_year) === editionYear) ?? null
  );
}

/** Each role reads a paper under its own section so it keeps its sidebar. The
 *  route only picks the shell — get_paper_result decides who may read what. */
export const PAPER_BASE = {
  student: "/portal/student/results/paper",
  school: "/portal/school/results/paper",
  admin: "/portal/admin/papers",
} as const;

export async function paperLinksForStudents(
  supabase: SupabaseClient,
  studentIds: readonly string[],
  base: string = PAPER_BASE.admin,
): Promise<PaperLinkIndex> {
  const index: PaperLinkIndex = new Map();
  if (studentIds.length === 0) return index;

  type Row = {
    id: string;
    student_id: string | null;
    paper_exams: { stage: string; edition_year: number; subjects: string[] | null } | null;
  };

  // Chunked: a whole edition's roster is ~600 ids, and PostgREST takes the list
  // in the URL, which a request that long does not survive.
  const pages = await Promise.all(
    chunk([...studentIds], 100).map((batch) =>
      supabase
        .from("paper_exam_papers")
        .select("id, student_id, paper_exams(stage, edition_year, subjects)")
        .in("student_id", batch)
        .eq("status", "matched"),
    ),
  );

  for (const row of pages.flatMap((p) => (p.data ?? []) as unknown as Row[])) {
    const exam = row.paper_exams;
    if (!row.student_id || !exam?.stage) continue;
    const byKey = index.get(row.student_id) ?? new Map<string, PaperLink>();
    byKey.set(paperKey(exam.stage, exam.edition_year), {
      paperId: row.id,
      href: `${base}/${row.id}`,
      subjects: exam.subjects ?? null,
    });
    index.set(row.student_id, byKey);
  }
  return index;
}

/** Decorate stage-result rows with the paper link and subject order. */
export function withPaperLinks<
  T extends { stage: string; edition_year?: number | null; breakdown?: unknown },
>(results: T[], links: Map<string, PaperLink> | undefined) {
  return results.map((r) => {
    const link = links?.get(paperKey(r.stage, r.edition_year));
    return {
      ...r,
      detailHref: link?.href ?? null,
      subjectOrder: link?.subjects ?? null,
    };
  });
}

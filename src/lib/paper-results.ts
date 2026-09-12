import type { SupabaseClient } from "@supabase/supabase-js";

// Where a rep's published stage score came from, so a stage chip can link to
// the paper behind it. Read with the caller's client: paper_exam_papers' read
// policy already scopes rows to the student, their school and admins.

export interface PaperLink {
  paperId: string;
  href: string;
  subjects: string[] | null;
}

/** studentId -> stage -> the paper behind that stage's score. */
export type PaperLinkIndex = Map<string, Map<string, PaperLink>>;

export async function paperLinksForStudents(
  supabase: SupabaseClient,
  studentIds: readonly string[],
): Promise<PaperLinkIndex> {
  const index: PaperLinkIndex = new Map();
  if (studentIds.length === 0) return index;

  const { data } = await supabase
    .from("paper_exam_papers")
    .select("id, student_id, paper_exams(stage, subjects)")
    .in("student_id", [...studentIds])
    .eq("status", "matched");

  type Row = {
    id: string;
    student_id: string | null;
    paper_exams: { stage: string; subjects: string[] | null } | null;
  };

  for (const row of (data ?? []) as unknown as Row[]) {
    const stage = row.paper_exams?.stage;
    if (!row.student_id || !stage) continue;
    const byStage = index.get(row.student_id) ?? new Map<string, PaperLink>();
    byStage.set(stage, {
      paperId: row.id,
      href: `/portal/results/paper/${row.id}`,
      subjects: row.paper_exams?.subjects ?? null,
    });
    index.set(row.student_id, byStage);
  }
  return index;
}

/** Decorate stage-result rows with the paper link and subject order. */
export function withPaperLinks<
  T extends { stage: string; breakdown?: unknown },
>(results: T[], links: Map<string, PaperLink> | undefined) {
  return results.map((r) => {
    const link = links?.get(r.stage);
    return {
      ...r,
      detailHref: link?.href ?? null,
      subjectOrder: link?.subjects ?? null,
    };
  });
}

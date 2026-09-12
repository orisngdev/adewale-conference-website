import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { canViewModule } from "@/supabase/auth";
import { toCsv } from "@/lib/csv";
import { zipgradeRosterMatrix, type RosterRow } from "@/lib/zipgrade";

// The roster in the capture tool's student-import shape, so it can print Answer
// Sheet Packs with each rep's name and candidate number already filled in.
//
// Columns: First Name, Last Name, Student ID, Class, Custom ID, Principal.
// Identity is the candidate number alone; there is no External ID column, so
// nothing identifying a student beyond that number leaves for a third party.
// The school rides in Custom ID because that is the field the tool round-trips.
//
// Three divergences from admin/registrations/export/route.ts, because this file
// is parsed by another program rather than read by a human: no `="…"` formula
// guard on Student ID (the tool would ingest `="007"` as the ID), no UTF-8 BOM
// (it risks becoming part of the first header's name), and no access code ever
// — the code IS the auth password for code-login students.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Exporting is a read, so view access is enough — same call as the
  // registrations export.
  if (!(await canViewModule("participants"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from("paper_exams")
    .select("id, title, edition_year, item_count")
    .eq("id", id)
    .maybeSingle();
  if (!exam) return new NextResponse("Not found", { status: 404 });

  const scope = (request.nextUrl.searchParams.get("scope") ?? "all").trim();

  const { data: candidates } = await supabase
    .from("paper_exam_candidates")
    .select("student_id, exam_no, class_name, students(name, level, school_id, schools(name))")
    .eq("exam_id", id)
    .order("exam_no");

  type CandidateRow = {
    student_id: string;
    exam_no: string;
    class_name: string | null;
    students: {
      name: string;
      level: string | null;
      school_id: string | null;
      schools: { name: string | null } | null;
    } | null;
  };
  let rows = (candidates ?? []) as unknown as CandidateRow[];

  if (scope.startsWith("class:")) {
    const wanted = scope.slice("class:".length).toLowerCase();
    rows = rows.filter(
      (r) => (r.class_name ?? r.students?.level ?? "").toLowerCase() === wanted,
    );
  } else if (scope.startsWith("school:")) {
    const schoolId = scope.slice("school:".length);
    rows = rows.filter((r) => r.students?.school_id === schoolId);
  }

  // The principal's name lives in the registration's details blob, keyed per
  // school for this edition — the same source the registration detail page and
  // the announcement targeting read.
  const schoolIds = [
    ...new Set(rows.map((r) => r.students?.school_id).filter(Boolean) as string[]),
  ];
  const principalBySchool = new Map<string, string>();
  if (schoolIds.length) {
    const { data: regs } = await supabase
      .from("registrations")
      .select("school_id, details")
      .eq("edition_year", exam.edition_year)
      .in("school_id", schoolIds);
    for (const reg of (regs ?? []) as {
      school_id: string | null;
      details: Record<string, string> | null;
    }[]) {
      const name = (reg.details?.["Principal Full Name"] ?? "").trim();
      if (reg.school_id && name) principalBySchool.set(reg.school_id, name);
    }
  }

  // Pre-flight: refuse rather than hand over a roster that cannot produce a
  // usable pack. A missing number means somebody would have to hand-write one.
  if (rows.length === 0) {
    return new NextResponse(
      "No candidates to export. Allocate candidate numbers first, or widen the scope.",
      { status: 409 },
    );
  }

  const roster: RosterRow[] = rows.map((r) => ({
    examNo: r.exam_no,
    name: r.students?.name ?? "",
    // Class is the rep's class (SS1 / SS2); fall back to the student row in
    // case a candidate predates that meaning.
    className: r.class_name ?? r.students?.level ?? null,
    schoolName: r.students?.schools?.name ?? null,
    principalName: r.students?.school_id
      ? principalBySchool.get(r.students.school_id) ?? null
      : null,
  }));

  const csv = toCsv(zipgradeRosterMatrix(roster), { bom: false });
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = scope === "all" ? "all" : scope.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const filename = `zipgrade-roster-${slug}-${stamp}.csv`;

  // Mark what was printed, so a re-export after a late addition can show which
  // packs are new.
  await supabase
    .from("paper_exam_candidates")
    .update({ exported_at: new Date().toISOString() })
    .eq("exam_id", id)
    .in(
      "student_id",
      rows.map((r) => r.student_id),
    );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

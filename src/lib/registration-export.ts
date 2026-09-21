import { ageFromDob } from "@/lib/age";
import { requestedCentre } from "@/lib/exam-centre";
import type { XlsxCell } from "@/lib/xlsx";
import type { Rep } from "@/supabase/types";

/** One `registrations` row as the export route selects it. */
export type RegistrationExportRow = {
  edition_year: number;
  status: string;
  contact_email: string | null;
  contact_name: string | null;
  reps: unknown;
  details: Record<string, string> | null;
  qualification_zone: string | null;
  schools: { name: string | null; lga: string | null } | null;
  profiles: { email: string | null; full_name: string | null } | null;
};

export const REGISTRATION_EXPORT_HEADERS = [
  "School",
  "School category",
  "LGA",
  "Exam centre",
  "Centre selected",
  "Edition",
  "Status",
  "Coordinator",
  "Coordinator email",
  "Coordinator phone",
  "Coordinator gender",
  "Principal",
  "Principal email",
  "Principal phone",
  "Principal gender",
  "Rep 1 name",
  "Rep 1 class",
  "Rep 1 dob",
  "Rep 1 age",
  "Rep 1 gender",
  "Rep 1 guardian name",
  "Rep 1 guardian number",
  "Rep 2 name",
  "Rep 2 class",
  "Rep 2 dob",
  "Rep 2 age",
  "Rep 2 gender",
  "Rep 2 guardian name",
  "Rep 2 guardian number",
  "Rep 3 name",
  "Rep 3 class",
  "Rep 3 dob",
  "Rep 3 age",
  "Rep 3 gender",
  "Rep 3 guardian name",
  "Rep 3 guardian number",
];

// Columns holding phone numbers. Spreadsheets parse "+234…"/"0803…" in a plain
// CSV as numbers (scientific notation, dropped leading zero), so these cells get
// the ="…" formula guard. The XLSX path doesn't need it — strings there are
// typed text cells.
export const REGISTRATION_EXPORT_PHONE_COLUMNS = new Set(
  REGISTRATION_EXPORT_HEADERS.flatMap((h, i) =>
    /phone|guardian number/i.test(h) ? [i] : [],
  ),
);

/** Header row plus one row per registration — the two formats serialise it differently. */
export function registrationExportMatrix(
  rows: readonly RegistrationExportRow[],
): XlsxCell[][] {
  const matrix: XlsxCell[][] = [REGISTRATION_EXPORT_HEADERS];
  for (const r of rows) {
    const reps = Array.isArray(r.reps) ? (r.reps as Rep[]) : [];
    const details = r.details ?? {};
    const repCells: XlsxCell[] = [];
    for (let n = 1; n <= 3; n++) {
      const rep = reps[n - 1];
      const name = rep?.name ?? details[`Student Rep ${n} Full Name`] ?? "";
      const level = rep?.level ?? details[`Student Rep ${n} Class`] ?? "";
      const dob = details[`Student Rep ${n} DOB`] ?? "";
      const age = ageFromDob(details[`Student Rep ${n} DOB`]);
      const gender = details[`Student Rep ${n} Gender`] ?? "";
      const guardianName = details[`Student Rep ${n} Guardian Name`] ?? "";
      const guardianNumber = details[`Student Rep ${n} Guardian Number`] ?? "";

      repCells.push(name, level, dob, age ?? "", gender, guardianName, guardianNumber);
    }

    // Two centre columns, because they answer different questions: where the
    // school sits the exam, and what it asked for. No LGA fallback — an LGA in a
    // column headed "Exam centre" is the corruption this codebase keeps unpicking.
    const requested = requestedCentre(details);

    matrix.push([
      r.schools?.name ?? "",
      details[`School Category`] ?? details[`School category`] ?? "",
      r.schools?.lga ?? "",
      r.qualification_zone ?? requested,
      requested,
      r.edition_year,
      r.status,
      r.profiles?.full_name ?? r.contact_name ?? details[`Teacher Full Name`] ?? "",
      r.profiles?.email ?? r.contact_email ?? details[`Teacher Email Address`] ?? "",
      details[`Teacher Number`] ?? "",
      details[`Teacher Gender`] ?? "",
      details[`Principal Full Name`] ?? "",
      details[`Principal Email Address`] ?? "",
      details[`Principal Number`] ?? "",
      details[`Principal Gender`] ?? "",
      ...repCells,
    ]);
  }
  return matrix;
}

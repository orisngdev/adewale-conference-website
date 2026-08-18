import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { canViewModule } from "@/supabase/auth";
import { ageFromDob } from "@/lib/age";
import { buildXlsx, type XlsxCell } from "@/lib/xlsx";
import type { Rep } from "@/supabase/types";

export const dynamic = "force-dynamic";

// Export of registrations — one row per school, with each rep's name, class, and
// age (computed from DOB). CSV opens straight into Google Sheets; XLSX is a real
// Excel workbook (numbers stay numeric). `?format=xlsx` selects Excel, otherwise
// CSV. Gated on registrations VIEW, since exporting is a read: read-only admins
// can pull the sheet too.

type Row = {
  edition_year: number;
  status: string;
  contact_email: string | null;
  contact_name: string | null;
  reps: unknown;
  details: Record<string, string> | null;
  schools: { name: string | null; lga: string | null } | null;
  profiles: { email: string | null; full_name: string | null } | null;
};

const HEADERS = [
  "School",
  "School category",
  "LGA",
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
  "Rep 3 guardian number"
];

// Columns holding phone numbers. Spreadsheets parse "+234…"/"0803…" in a plain
// CSV as numbers (scientific notation, dropped leading zero), so these cells are
// emitted as the ="…" formula, which Excel and Sheets both render as literal
// text. The XLSX path doesn't need this — strings there are typed text cells.
const PHONE_COLUMNS = new Set(
  HEADERS.flatMap((h, i) => (/phone|guardian number/i.test(h) ? [i] : [])),
);

function csvCell(value: XlsxCell, column: number): string {
  const s = value == null ? "" : String(value);
  if (PHONE_COLUMNS.has(column) && s !== "") {
    return `"=""${s.replace(/"/g, "")}"""`;
  }
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  if (!(await canViewModule("registrations"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const editionParam = request.nextUrl.searchParams.get("edition");
  const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  const supabase = await createClient();
  let query = supabase
    .from("registrations")
    .select(
      "edition_year, status, contact_email, contact_name, reps, details, schools(name, lga), profiles(email, full_name)",
    )
    .order("edition_year", { ascending: false })
    .order("created_at", { ascending: false });
  if (editionParam && editionParam !== "all" && /^\d{4}$/.test(editionParam)) {
    query = query.eq("edition_year", Number(editionParam));
  }

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  // Build a typed matrix once; the two formats serialise it differently.
  const matrix: XlsxCell[][] = [HEADERS];
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

    matrix.push([
      r.schools?.name ?? "",
      r?.details?.[`School Category`] ?? r.details?.[`School category`] ?? "",
      r.schools?.lga ?? "",
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

  const stamp = new Date().toISOString().slice(0, 10);
  const scope = editionParam && editionParam !== "all" ? editionParam : "all";
  const filename = `registrations-${scope}-${stamp}.${format}`;

  if (format === "xlsx") {
    const buf = buildXlsx(matrix, "Registrations");
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Prepend a UTF-8 BOM so Sheets/Excel detect encoding and non-ASCII names render.
  const csv =
    "﻿" +
    matrix
      .map((row, r) =>
        row.map((value, c) => csvCell(value, r === 0 ? -1 : c)).join(","),
      )
      .join("\r\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/supabase/server";
import { canViewModule } from "@/supabase/auth";
import { toCsv } from "@/lib/csv";
import {
  REGISTRATION_EXPORT_PHONE_COLUMNS,
  registrationExportMatrix,
  type RegistrationExportRow,
} from "@/lib/registration-export";
import { buildXlsx } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

// Export of registrations — one row per school, with its exam centre and each
// rep's name, class, and age. CSV opens straight into Google Sheets; XLSX is a
// real Excel workbook (numbers stay numeric). `?format=xlsx` selects Excel,
// otherwise CSV. Gated on registrations VIEW, since exporting is a read:
// read-only admins can pull the sheet too. The rows themselves are shaped in
// src/lib/registration-export.ts, where they are tested.

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
      "edition_year, status, contact_email, contact_name, reps, details, qualification_zone, schools(name, lga), profiles(email, full_name)",
    )
    .order("edition_year", { ascending: false })
    .order("created_at", { ascending: false });
  if (editionParam && editionParam !== "all" && /^\d{4}$/.test(editionParam)) {
    query = query.eq("edition_year", Number(editionParam));
  }

  const { data, error } = await query;
  // A half-built sheet is worse than no download: it looks complete.
  if (error) {
    return new NextResponse(`Could not build the export: ${error.message}`, { status: 500 });
  }

  const matrix = registrationExportMatrix((data ?? []) as unknown as RegistrationExportRow[]);

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

  const csv = toCsv(matrix, {
    bom: true,
    formulaGuardColumns: REGISTRATION_EXPORT_PHONE_COLUMNS,
  });
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

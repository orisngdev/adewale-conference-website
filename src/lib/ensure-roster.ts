// Materialise a registration's reps as students rows, so every approved school
// has a stable, addressable roster. Per-student stage results and per-student
// certificates key on students.id, which reps-as-JSON can't provide — this turns
// each rep into a real row the moment its school is approved.
//
// Idempotent by construction: provisionStudent reuses an existing row by
// (school, name), so this reconciles with the coordinator's own later
// login-provisioning instead of duplicating. Safe to call on every approval and
// re-runnable as a backfill ("Sync roster").
import { createAdminClient } from "@/supabase/admin";
import { provisionStudent } from "@/lib/provision-student";
import type { Rep } from "@/supabase/types";

export async function ensureRoster(reg: {
  school_id: string | null;
  edition_year: number;
  reps: unknown;
}): Promise<{ provisioned: number; errors: number }> {
  const admin = createAdminClient();
  if (!admin || !reg.school_id) return { provisioned: 0, errors: 0 };

  const reps = Array.isArray(reg.reps) ? (reg.reps as Rep[]) : [];
  let provisioned = 0;
  let errors = 0;
  for (const rep of reps) {
    const name = (rep?.name ?? "").trim();
    if (!name) continue;
    const res = await provisionStudent(admin, {
      schoolId: reg.school_id,
      editionYear: reg.edition_year,
      name,
      level: rep.level ?? null,
    });
    if (res.error) errors++;
    else provisioned++;
  }
  return { provisioned, errors };
}

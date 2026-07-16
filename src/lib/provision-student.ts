// No "server-only" marker: this module is also used by the Airtable sync,
// which runs from standalone scripts. The service-role admin client parameter
// is the actual server gate — it can't be constructed in the browser.
import { randomBytes } from "crypto";
import { createAdminClient } from "@/supabase/admin";

// Core student-provisioning shared by the coordinator's Students page and the
// public-registration onboarding: a Supabase auth user with a synthetic email +
// the access code as password (students sign in with just the code, no email).
// Reuse rule (registration-onboarding plan): a returning name within the school
// keeps its existing code and is re-tagged to the current edition; a new name
// gets a new student row + code, stamped with the edition.

export type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export type ProvisionResult = { code?: string; error?: string; created?: boolean };

export function makeAccessCode() {
  return randomBytes(5)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();
}

export async function provisionStudent(
  admin: AdminClient,
  {
    schoolId,
    editionYear,
    name,
    level,
  }: { schoolId: string; editionYear: number; name: string; level: string | null },
): Promise<ProvisionResult> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Enter the student's name." };

  // Returning student (same name, same school): keep the code, re-tag to the
  // current edition so this edition's plans/exams reach them. Deactivated rows
  // are skipped — a swapped-out student neither gets re-tagged nor blocks a
  // genuinely new rep who happens to share the name.
  const { data: existingRows } = await admin
    .from("students")
    .select("id, access_code")
    .eq("school_id", schoolId)
    .ilike("name", trimmed)
    .is("deactivated_at", null)
    .limit(1);
  const existing = existingRows?.[0];
  if (existing?.access_code) {
    await admin
      .from("students")
      .update({ edition_year: editionYear, level: level || null })
      .eq("id", existing.id);
    return { code: existing.access_code as string, created: false };
  }

  const code = makeAccessCode();
  const authEmail = `student.${code.toLowerCase()}@students.adewaleconference.local`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: authEmail,
    password: code,
    email_confirm: true,
    user_metadata: { full_name: trimmed },
  });
  if (cErr || !created.user) {
    console.error("provisionStudent: createUser failed:", cErr?.message);
    return { error: `Could not create access: ${cErr?.message ?? "unknown error"}` };
  }

  const { error: sErr } = await admin.from("students").insert({
    school_id: schoolId,
    name: trimmed,
    level: level || null,
    access_code: code,
    auth_email: authEmail,
    auth_user_id: created.user.id,
    edition_year: editionYear,
  });
  if (sErr) {
    // Lost a race to another provisioning path (teacher + principal onboarding
    // provision the same roster) — the (school, lower(name)) unique index fired.
    // Reuse the winning row's code and clean up this orphan auth user, so the
    // outcome is identical to reuse-by-name instead of a duplicate.
    if (sErr.code === "23505") {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
      const { data: winnerRows } = await admin
        .from("students")
        .select("id, access_code")
        .eq("school_id", schoolId)
        .ilike("name", trimmed)
        .is("deactivated_at", null)
        .limit(1);
      const winner = winnerRows?.[0];
      if (winner?.access_code) {
        await admin
          .from("students")
          .update({ edition_year: editionYear, level: level || null })
          .eq("id", winner.id);
        return { code: winner.access_code as string, created: false };
      }
    }
    console.error("provisionStudent: students insert failed:", sErr.message);
    return { error: `Could not save student: ${sErr.message}` };
  }

  return { code, created: true };
}

// Retire a student when they're replaced on a registration. Bans the auth user
// (so the access code stops working) and stamps deactivated_at, but keeps the
// row and its assessment/plan history for audit — never a hard delete. The old
// code is retained on the row for reference; it no longer logs in.
export async function deactivateStudent(
  admin: AdminClient,
  studentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: student, error: readErr } = await admin
    .from("students")
    .select("id, auth_user_id, deactivated_at")
    .eq("id", studentId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!student) return { ok: false, error: "Student not found." };

  if (student.auth_user_id) {
    // ~100 years — effectively permanent. Preserves the row (unlike deleteUser),
    // so the student's history and access_code stay intact for audit.
    const { error: banErr } = await admin.auth.admin.updateUserById(
      student.auth_user_id as string,
      { ban_duration: "876000h" },
    );
    if (banErr) {
      console.error("deactivateStudent: ban failed:", banErr.message);
      return { ok: false, error: `Could not revoke access: ${banErr.message}` };
    }
  }

  const { error: updErr } = await admin
    .from("students")
    .update({ deactivated_at: new Date().toISOString() })
    .eq("id", studentId);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true };
}

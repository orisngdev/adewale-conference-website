import "server-only";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/supabase/admin";

// Core student-provisioning shared by the coordinator's Students page and the
// public-registration onboarding: a Supabase auth user with a synthetic email +
// the access code as password (students sign in with just the code, no email).
// Reuse rule (registration-onboarding plan): a returning name within the school
// keeps its existing code and is re-tagged to the current edition; a new name
// gets a new student row + code, stamped with the edition.

export type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export type ProvisionResult = { code?: string; error?: string };

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
  // current edition so this edition's plans/exams reach them.
  const { data: existing } = await admin
    .from("students")
    .select("id, access_code")
    .eq("school_id", schoolId)
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing?.access_code) {
    await admin
      .from("students")
      .update({ edition_year: editionYear, level: level || null })
      .eq("id", existing.id);
    return { code: existing.access_code as string };
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
    console.error("provisionStudent: students insert failed:", sErr.message);
    return { error: `Could not save student: ${sErr.message}` };
  }

  return { code };
}

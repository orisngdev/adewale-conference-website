// No "server-only" marker: this module is also used by the Airtable sync,
// which runs from standalone scripts. The service-role admin client parameter
// is the actual server gate — it can't be constructed in the browser.
import { randomBytes } from "crypto";
import { createAdminClient } from "@/supabase/admin";
import { studentAuthEmail } from "@/lib/student-accounts";
import { personNameKey } from "@/lib/person-identity";

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

  // Returning student (same person, same school): keep the code, re-tag to the
  // current edition. Matched on personNameKey, not `ilike` — that only caught
  // case, so a re-ordered name provisioned a second row for the same child.
  // The whole roster is read (a few rows) since the key has no SQL counterpart.
  const key = personNameKey(trimmed);
  const { data: rosterRows } = await admin
    .from("students")
    .select("id, name, access_code, auth_user_id, edition_year, deactivated_at")
    .eq("school_id", schoolId);
  const roster = (rosterRows ?? []) as {
    id: string;
    name: string;
    access_code: string | null;
    auth_user_id: string | null;
    edition_year: number | null;
    deactivated_at: string | null;
  }[];
  const sameName = roster.filter((s) => personNameKey(s.name) === key);
  const existing = sameName.find((s) => !s.deactivated_at);

  // A rep retired in THIS edition was replaced; re-provisioning the name used
  // to mint a parallel active row beside them. Retired in an earlier edition is
  // a returning student, and falls through to normal provisioning.
  if (!existing) {
    const replaced = sameName.find(
      (s) => s.deactivated_at && s.edition_year === editionYear,
    );
    if (replaced) {
      return {
        error: `${replaced.name} was replaced and retired for ${editionYear}. Use the replacement flow to bring them back.`,
      };
    }
  }
  // Only a row that can actually sign in counts as a returning student. A
  // history-only row (imported for the record, no auth user) matches by name
  // too, and handing back its code would mint a login that never works.
  if (existing?.access_code && existing.auth_user_id) {
    // Carry the current spelling onto the row: a re-ordered name is a rename.
    await admin
      .from("students")
      .update({ name: trimmed, edition_year: editionYear, level: level || null })
      .eq("id", existing.id);
    return { code: existing.access_code as string, created: false };
  }

  const code = makeAccessCode();
  const authEmail = studentAuthEmail(code);
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

  // Adopt the history-only row rather than inserting beside it: the unique
  // (school, lower(name)) index would reject a second row anyway, and the
  // student keeps one identity. It gets a real code, address and login.
  if (existing) {
    const { error: adoptErr } = await admin
      .from("students")
      .update({
        name: trimmed,
        access_code: code,
        auth_email: authEmail,
        auth_user_id: created.user.id,
        edition_year: editionYear,
        level: level || null,
      })
      .eq("id", existing.id);
    if (adoptErr) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
      console.error("provisionStudent: adopt failed:", adoptErr.message);
      return { error: `Could not save student: ${adoptErr.message}` };
    }
    return { code, created: true };
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
    // The row never landed, so clean up the auth user on EVERY failure, not
    // just the race below — students_roster_cap (20260913090400) rejects a
    // fourth rep, and an orphaned login with a live code is the worst residue.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});

    // Lost a race to another provisioning path (teacher + principal onboarding
    // provision the same roster). Reuse the winning row's code.
    if (sErr.code === "23505") {
      const { data: winnerRows } = await admin
        .from("students")
        .select("id, name, access_code, deactivated_at")
        .eq("school_id", schoolId);
      const winner = ((winnerRows ?? []) as typeof roster).find(
        (s) => !s.deactivated_at && personNameKey(s.name) === key,
      );
      if (winner?.access_code) {
        await admin
          .from("students")
          .update({ name: trimmed, edition_year: editionYear, level: level || null })
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

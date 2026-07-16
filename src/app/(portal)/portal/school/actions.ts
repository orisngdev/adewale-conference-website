"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { createAdminClient } from "@/supabase/admin";
import { provisionStudent, type ProvisionResult } from "@/lib/provision-student";
import type { Rep, ReplacementResult } from "@/supabase/types";

// Provision a student for the coordinator's school: a Supabase auth user with a
// synthetic email + the access code as password (so they log in with just the
// code). Returns the access code on success (or the existing one), or an error.
async function createStudentRecord(
  name: string,
  level: string,
): Promise<ProvisionResult> {
  if (!name) return { error: "Enter the student's name." };

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  // The coordinator's school — from any registration they can access (owner OR
  // approved member). Works even when their membership is still pending.
  // The coordinator's school + the edition they most recently registered for, so
  // provisioned students carry that edition — edition-scoped plans/exams match on
  // students.edition_year (untagged students are silently skipped).
  const { data: regs } = await supabase
    .from("registrations")
    .select("school_id, edition_year")
    .order("edition_year", { ascending: false });
  const reg = (
    (regs ?? []) as { school_id: string | null; edition_year: number | null }[]
  ).find((r) => r.school_id);
  const schoolId = reg?.school_id;
  if (!schoolId)
    return { error: "Register or link your school first." };
  const editionYear = reg?.edition_year ?? (Number(process.env.ASC_EDITION_YEAR) || 2026);

  const admin = createAdminClient();
  if (!admin) return { error: "Student access isn't configured on the server." };

  const result = await provisionStudent(admin, {
    schoolId,
    editionYear,
    name,
    level: level || null,
  });
  if (result.code) revalidatePath("/portal/school", "layout");
  return result;
}

// Provision a rep → returns the code (or error) for inline display (useActionState).
export async function provisionRep(
  _prev: ProvisionResult | null,
  formData: FormData,
): Promise<ProvisionResult> {
  return createStudentRecord(
    String(formData.get("name") ?? "").trim(),
    String(formData.get("level") ?? "").trim(),
  );
}

// Representatives are locked in after submission — corrections and swaps both go
// through the replacement flow (requestReplacement) so an admin reviews the
// change and access codes stay in sync. There is deliberately no edit-in-place.

// File a request to replace a rep (student A leaves, B takes the slot). This is
// deliberately separate from updateReps (which is for typo corrections on the
// same person): a replacement swaps one human for another, so it needs admin
// approval to deactivate the outgoing student and provision the incoming one.
// Allowed any time — no registration-open gate. RLS (sr_insert) gates to members.
export async function requestReplacement(
  registrationId: string,
  _prev: ReplacementResult | null,
  formData: FormData,
): Promise<ReplacementResult> {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated." };

  const oldName = String(formData.get("old_name") ?? "").trim();
  const oldLevel = String(formData.get("old_level") ?? "").trim();
  const newName = String(formData.get("new_name") ?? "").trim();
  const newLevel = String(formData.get("new_level") ?? "").trim();
  if (!oldName) return { error: "Missing the student being replaced." };
  if (!newName) return { error: "Enter the replacement student's name." };

  // Incoming rep's extra attributes — kept so Airtable stays complete after the
  // swap. Neutral keys here; the admin approval maps them onto "Student Rep N …".
  const newDetails: Record<string, string> = {};
  for (const [field, key] of [
    ["dob", "dob"],
    ["gender", "gender"],
    ["guardian_name", "guardianName"],
    ["guardian_number", "guardianNumber"],
  ] as const) {
    const value = String(formData.get(field) ?? "").trim();
    if (value) newDetails[key] = value;
  }

  const { data: reg } = await supabase
    .from("registrations")
    .select("id, school_id, details, reps")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg?.school_id) return { error: "Registration not found." };

  // Resolve the Airtable "Student Rep N" slot so approval writes the swap back
  // to the right field. Prefer a details name-match; fall back to reps order.
  const details = (reg.details ?? {}) as Record<string, string>;
  let repSlot: number | null = null;
  for (let n = 1; n <= 3; n++) {
    if (
      (details[`Student Rep ${n} Full Name`] ?? "").trim().toLowerCase() ===
      oldName.toLowerCase()
    ) {
      repSlot = n;
      break;
    }
  }
  if (repSlot === null) {
    const reps = Array.isArray(reg.reps) ? (reg.reps as Rep[]) : [];
    const idx = reps.findIndex(
      (r) => r.name.trim().toLowerCase() === oldName.toLowerCase(),
    );
    if (idx >= 0) repSlot = idx + 1;
  }

  // The outgoing student's provisioned row, if any (active only).
  const { data: existing } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", reg.school_id)
    .ilike("name", oldName)
    .is("deactivated_at", null)
    .limit(1);
  const oldStudentId = (existing?.[0]?.id as string | undefined) ?? null;

  // Don't stack duplicate pending requests for the same rep.
  const { data: dupe } = await supabase
    .from("student_replacements")
    .select("id")
    .eq("registration_id", registrationId)
    .eq("old_name", oldName)
    .eq("status", "pending")
    .limit(1);
  if (dupe && dupe.length) {
    return { error: "A replacement for this student is already awaiting review." };
  }

  const { error } = await supabase.from("student_replacements").insert({
    registration_id: registrationId,
    school_id: reg.school_id,
    rep_slot: repSlot,
    old_student_id: oldStudentId,
    old_name: oldName,
    old_level: oldLevel || null,
    new_name: newName,
    new_level: newLevel || null,
    new_details: newDetails,
    reason: String(formData.get("reason") ?? "").trim() || null,
    requested_by: user.id,
    status: "pending",
  });
  if (error) return { error: `Could not submit: ${error.message}` };

  revalidatePath("/portal/school/students");
  revalidatePath("/portal/school");
  return { ok: true };
}

// Register the coordinator's school for an open edition — created owned by them,
// so there's nothing to claim. Returns an error string for the UI, or null on success.
export async function registerForEdition(
  year: number,
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const school = String(formData.get("school") ?? "").trim();
  const lga = String(formData.get("lga") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const reps = [1, 2, 3]
    .map((i) => ({
      name: String(formData.get(`rep${i}`) ?? "").trim(),
      level: String(formData.get(`rep${i}_level`) ?? "").trim() || undefined,
    }))
    .filter((r) => r.name);

  if (!school) return "Enter your school name.";

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_school_for_edition", {
    p_year: year,
    p_school: school,
    p_lga: lga || null,
    p_category: category || null,
    p_reps: reps,
  });
  if (error) return "Could not register — registration may have closed. Try again.";

  // Auto-provision each representative into a student login + access code, so the
  // coordinator sees the codes to hand out immediately — no separate step. Best-effort:
  // if the service key isn't configured this is skipped and reps can be provisioned
  // manually later from the Students page.
  for (const rep of reps) {
    await createStudentRecord(rep.name, rep.level ?? "");
  }

  revalidatePath("/portal/school");
  revalidatePath("/portal");
  return null;
}

// Redeem a claim code → become the registration's owner + coordinator.
// Returns an error string for the UI, or null on success.
export async function claimRegistration(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return "Enter your claim code.";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_registration", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) return `Could not claim: ${error.message}`;
  if (!data) return "That code is invalid.";

  revalidatePath("/portal/school");
  revalidatePath("/portal");
  redirect("/portal/school");
}

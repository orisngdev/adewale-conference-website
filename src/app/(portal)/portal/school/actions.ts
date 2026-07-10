"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { createAdminClient } from "@/supabase/admin";
import { provisionStudent, type ProvisionResult } from "@/lib/provision-student";
import type { Rep } from "@/supabase/types";

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

// Update existing representatives in place (edit names/class) — coordinators can
// correct details but not add or remove reps after submission. `count` is the
// number of rep rows the form rendered.
export async function updateReps(registrationId: string, formData: FormData) {
  const supabase = await createClient();

  // Reps are only editable while that edition's registration is open — past /
  // closed editions are locked.
  const { data: reg } = await supabase
    .from("registrations")
    .select("edition_year")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return;
  const { data: ed } = await supabase
    .from("editions")
    .select("registration_open")
    .eq("year", reg.edition_year)
    .maybeSingle();
  if (!ed?.registration_open) return;

  const count = Number(formData.get("count") ?? 0);
  const reps: Rep[] = [];
  for (let i = 0; i < count; i++) {
    const name = String(formData.get(`rep${i}_name`) ?? "").trim();
    const level = String(formData.get(`rep${i}_level`) ?? "").trim();
    if (name) reps.push(level ? { name, level } : { name });
  }

  // RLS (reg_owner_update / member) ensures only an authorised user can write.
  await supabase.from("registrations").update({ reps }).eq("id", registrationId);
  revalidatePath("/portal/school");
  revalidatePath("/portal/school/registrations");
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

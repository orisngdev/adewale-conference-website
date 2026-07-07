"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { createAdminClient } from "@/supabase/admin";
import type { Rep } from "@/supabase/types";

function makeAccessCode() {
  return randomBytes(5)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();
}

export type ProvisionResult = { code?: string; error?: string };

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
  const { data: regs } = await supabase
    .from("registrations")
    .select("school_id")
    .order("edition_year", { ascending: false });
  const schoolId = ((regs ?? []) as { school_id: string | null }[]).find(
    (r) => r.school_id,
  )?.school_id;
  if (!schoolId)
    return { error: "Register or link your school first." };

  const admin = createAdminClient();
  if (!admin) return { error: "Student access isn't configured on the server." };

  // Reuse the existing code for this name (no duplicate accounts).
  const { data: existing } = await admin
    .from("students")
    .select("access_code")
    .eq("school_id", schoolId)
    .ilike("name", name)
    .maybeSingle();
  if (existing?.access_code) return { code: existing.access_code as string };

  const code = makeAccessCode();
  const authEmail = `student.${code.toLowerCase()}@students.adewaleconference.local`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: authEmail,
    password: code,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (cErr || !created.user) {
    console.error("createStudentRecord: createUser failed:", cErr?.message);
    return { error: `Could not create access: ${cErr?.message ?? "unknown error"}` };
  }

  const { error: sErr } = await admin.from("students").insert({
    school_id: schoolId,
    name,
    level: level || null,
    access_code: code,
    auth_email: authEmail,
    auth_user_id: created.user.id,
  });
  if (sErr) {
    console.error("createStudentRecord: students insert failed:", sErr.message);
    return { error: `Could not save student: ${sErr.message}` };
  }

  revalidatePath("/portal/school", "layout");
  return { code };
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

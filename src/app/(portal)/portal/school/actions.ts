"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { createAdminClient } from "@/supabase/admin";
import type { Rep } from "@/supabase/types";

function makeAccessCode() {
  return randomBytes(5)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toUpperCase();
}

// Provision a student for the coordinator's school: a Supabase auth user with a
// synthetic email + the access code as password (so they log in with just the
// code). Returns an error string for the UI, or null on success.
export async function addStudent(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  const level = String(formData.get("level") ?? "").trim();
  if (!name) return "Enter the student's name.";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated.";

  // The coordinator's school (their approved membership; RLS scopes to own rows).
  const { data: memberships } = await supabase
    .from("school_members")
    .select("school_id")
    .eq("status", "approved");
  const schoolId = (memberships ?? [])[0]?.school_id as string | undefined;
  if (!schoolId) return "Link your school first before adding students.";

  const admin = createAdminClient();
  if (!admin) return "Student access isn't configured on the server.";

  const code = makeAccessCode();
  const authEmail = `student.${code.toLowerCase()}@students.adewaleconference.local`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: authEmail,
    password: code,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (cErr || !created.user) return "Could not create student access — try again.";

  const { error: sErr } = await admin.from("students").insert({
    school_id: schoolId,
    name,
    level: level || null,
    access_code: code,
    auth_email: authEmail,
    auth_user_id: created.user.id,
  });
  if (sErr) return "Could not save the student.";

  revalidatePath("/portal/school");
  return null;
}

// Update existing representatives in place (edit names/class) — coordinators can
// correct details but not add or remove reps after submission. `count` is the
// number of rep rows the form rendered.
export async function updateReps(registrationId: string, formData: FormData) {
  const count = Number(formData.get("count") ?? 0);
  const reps: Rep[] = [];
  for (let i = 0; i < count; i++) {
    const name = String(formData.get(`rep${i}_name`) ?? "").trim();
    const level = String(formData.get(`rep${i}_level`) ?? "").trim();
    if (name) reps.push(level ? { name, level } : { name });
  }

  const supabase = await createClient();
  // RLS (reg_owner_update / member) ensures only an authorised user can write.
  await supabase.from("registrations").update({ reps }).eq("id", registrationId);
  revalidatePath("/portal/school");
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

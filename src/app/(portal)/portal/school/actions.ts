"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import type { Rep } from "@/supabase/types";

async function loadReps(registrationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("registrations")
    .select("reps")
    .eq("id", registrationId)
    .maybeSingle();
  const reps = Array.isArray(data?.reps) ? (data!.reps as Rep[]) : [];
  return { supabase, reps };
}

export async function addRep(registrationId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const level = String(formData.get("level") ?? "").trim();
  if (!name) return;

  const { supabase, reps } = await loadReps(registrationId);
  reps.push(level ? { name, level } : { name });
  // RLS (reg_owner_update) ensures only the registration's owner can write.
  await supabase.from("registrations").update({ reps }).eq("id", registrationId);
  revalidatePath("/portal/school");
}

export async function removeRep(registrationId: string, index: number) {
  const { supabase, reps } = await loadReps(registrationId);
  if (index < 0 || index >= reps.length) return;
  reps.splice(index, 1);
  await supabase.from("registrations").update({ reps }).eq("id", registrationId);
  revalidatePath("/portal/school");
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
    p_code: code,
  });
  if (error) return "Could not claim — please try again.";
  if (!data) return "That code is invalid or already claimed.";

  revalidatePath("/portal/school");
  revalidatePath("/portal");
  return null;
}

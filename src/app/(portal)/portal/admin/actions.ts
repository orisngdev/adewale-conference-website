"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import type { RegistrationStatus, UserRole } from "@/supabase/types";

const STATUSES: RegistrationStatus[] = [
  "submitted",
  "verified",
  "qualified",
  "finalist",
];

const ROLES: UserRole[] = ["student", "coordinator", "admin"];

export async function setUserRole(userId: string, formData: FormData) {
  const role = String(formData.get("role") ?? "");
  if (!ROLES.includes(role as UserRole)) return;

  const supabase = await createClient();
  const user = await getSessionUser();

  // Guard: an admin can't strip their own admin role (prevents self-lockout).
  if (user?.id === userId && role !== "admin") return;

  // RLS (profiles_admin_update with is_admin()) restricts this to admins.
  await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/portal/admin/users");
}

export async function setRegistrationStatus(
  registrationId: string,
  formData: FormData,
) {
  const status = String(formData.get("status") ?? "");
  if (!STATUSES.includes(status as RegistrationStatus)) return;

  const supabase = await createClient();
  // RLS (reg_owner_update with is_admin()) restricts this to admins.
  await supabase
    .from("registrations")
    .update({ status })
    .eq("id", registrationId);
  revalidatePath("/portal/admin");
}

export async function issueCertificate(
  registrationId: string,
  formData: FormData,
) {
  const type = String(formData.get("type") ?? "").trim();
  const assetUrl = String(formData.get("asset_url") ?? "").trim();
  if (!type) return;

  const supabase = await createClient();
  // RLS (cert_admin_write) restricts inserts to admins.
  await supabase.from("certificates").insert({
    registration_id: registrationId,
    type,
    asset_url: assetUrl || null,
  });

  // Notify the registration owner.
  const { data: reg } = await supabase
    .from("registrations")
    .select("owner_id")
    .eq("id", registrationId)
    .maybeSingle();
  const owner = (reg?.owner_id as string | null) ?? null;
  if (owner) {
    await supabase.from("notifications").insert({
      profile_id: owner,
      title: "Certificate issued",
      body: `A "${type}" certificate is now available to download.`,
      link: "/portal",
    });
  }
  revalidatePath("/portal/admin");
  revalidatePath("/portal/admin/registrations");
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { canManageModule, getSessionUser } from "@/supabase/auth";
import type { InfoChangeRequestRow } from "@/supabase/types";

// Approve a contact-detail correction: apply the new name/phone to the
// registration (details + contact columns) and the school_members full_name,
// mark it approved, and notify the requester. Admin-gated; RLS also restricts the
// registration/member/request writes to admins.
export async function approveInfoChange(id: string) {
  if (!(await canManageModule("registrations"))) return;
  const reviewer = await getSessionUser();
  const supabase = await createClient();

  const { data: rRow } = await supabase
    .from("info_change_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const r = rRow as InfoChangeRequestRow | null;
  if (!r || r.status !== "pending") return;

  const { data: reg } = await supabase
    .from("registrations")
    .select("id, school_id, contact_name, contact_email, details")
    .eq("id", r.registration_id)
    .maybeSingle();
  if (!reg) return;

  const details = { ...((reg.details as Record<string, string> | null) ?? {}) };
  const nameKey = r.target === "teacher" ? "Teacher Full Name" : "Principal Full Name";
  const phoneKey = r.target === "teacher" ? "Teacher Number" : "Principal Number";
  const emailKey = r.target === "teacher" ? "Teacher Email Address" : "Principal Email Address";

  if (r.new_name) details[nameKey] = r.new_name;
  if (r.new_phone) details[phoneKey] = r.new_phone;

  const patch: Record<string, unknown> = { details };
  if (r.target === "teacher" && r.new_name) patch.contact_name = r.new_name;
  await supabase.from("registrations").update(patch).eq("id", reg.id);

  // Keep the linked membership's name in sync so the portal shows the fix too.
  const contactEmail =
    (typeof details[emailKey] === "string" && details[emailKey].trim()) ||
    (r.target === "teacher" ? ((reg.contact_email as string | null) ?? "") : "");
  if (r.new_name && reg.school_id && contactEmail) {
    await supabase
      .from("school_members")
      .update({ full_name: r.new_name })
      .eq("school_id", reg.school_id)
      .ilike("email", contactEmail);
  }

  await supabase
    .from("info_change_requests")
    .update({
      status: "approved",
      reviewed_by: reviewer?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (r.requested_by) {
    await supabase.from("notifications").insert({
      profile_id: r.requested_by,
      title: "Correction applied",
      body: `Your requested change to the ${r.target} details was approved and applied.`,
      link: "/portal/school/registrations",
    });
  }

  revalidatePath("/portal/admin/info-changes");
  revalidatePath(`/portal/admin/registrations/${r.registration_id}`);
  revalidatePath("/portal/school/registrations");
}

export async function declineInfoChange(id: string, formData: FormData) {
  if (!(await canManageModule("registrations"))) return;
  const reviewer = await getSessionUser();
  const supabase = await createClient();

  const note = String(formData.get("note") ?? "").trim() || null;

  const { data: r } = await supabase
    .from("info_change_requests")
    .update({
      status: "declined",
      admin_note: note,
      reviewed_by: reviewer?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("requested_by, target")
    .maybeSingle();

  if (r?.requested_by) {
    await supabase.from("notifications").insert({
      profile_id: r.requested_by as string,
      title: "Correction declined",
      body: `Your requested change to the ${r.target} details was declined.${note ? ` Note: ${note}` : ""}`,
      link: "/portal/school/registrations",
    });
  }

  revalidatePath("/portal/admin/info-changes");
}

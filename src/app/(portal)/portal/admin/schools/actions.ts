"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { requireManage } from "@/supabase/auth";

export async function approveMembership(memberId: string) {
  if (!(await requireManage("registrations"))) return;
  const supabase = await createClient();
  // RLS (members_admin_all) restricts this to admins.
  await supabase
    .from("school_members")
    .update({ status: "approved" })
    .eq("id", memberId);

  // Notify the coordinator (if they already have an account).
  const { data: m } = await supabase
    .from("school_members")
    .select("profile_id, schools(name)")
    .eq("id", memberId)
    .maybeSingle();
  const pid = (m?.profile_id as string | null) ?? null;
  if (pid) {
    // Approved members are coordinators — same promotion the claim-code flow
    // does (profiles_admin_update RLS lets admins do this).
    await supabase
      .from("profiles")
      .update({ role: "coordinator" })
      .eq("id", pid)
      .eq("role", "student");
    const schoolName =
      (m?.schools as unknown as { name: string | null } | null)?.name ??
      "your school";
    await supabase.from("notifications").insert({
      profile_id: pid,
      title: "School access approved",
      body: `You can now manage ${schoolName} in the portal.`,
      link: "/portal/school",
    });
  }
  revalidatePath("/portal/admin/schools");
}

export async function rejectMembership(memberId: string) {
  if (!(await requireManage("registrations"))) return;
  const supabase = await createClient();
  await supabase.from("school_members").delete().eq("id", memberId);
  revalidatePath("/portal/admin/schools");
}

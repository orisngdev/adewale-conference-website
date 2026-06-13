"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";

export async function approveMembership(memberId: string) {
  const supabase = await createClient();
  // RLS (members_admin_all) restricts this to admins.
  await supabase
    .from("school_members")
    .update({ status: "approved" })
    .eq("id", memberId);
  revalidatePath("/portal/admin/schools");
}

export async function rejectMembership(memberId: string) {
  const supabase = await createClient();
  await supabase.from("school_members").delete().eq("id", memberId);
  revalidatePath("/portal/admin/schools");
}

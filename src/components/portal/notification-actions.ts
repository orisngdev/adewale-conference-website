"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("profile_id", user.id)
    .eq("read", false);

  revalidatePath("/portal/school");
  revalidatePath("/portal/student");
  revalidatePath("/portal");
}

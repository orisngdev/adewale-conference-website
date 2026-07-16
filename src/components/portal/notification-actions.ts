"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("profile_id", user.id);

  revalidatePath("/portal/notifications");
  revalidatePath("/portal");
}

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

  revalidatePath("/portal/notifications");
  revalidatePath("/portal");
}

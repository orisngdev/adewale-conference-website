"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { requireManage } from "@/supabase/auth";
import { extractYouTubeId } from "@/lib/youtube";

export async function setHomeVideo(formData: FormData) {
  const raw = String(formData.get("url") ?? "").trim();

  const admin = await requireManage("team");
  if (!admin) return;
  const supabase = await createClient();
  const user = admin.user;

  // RLS (site_settings_admin_write with is_admin()) restricts writes to admins.
  if (!raw) {
    await supabase.from("site_settings").delete().eq("key", "home_video_url");
  } else {
    if (!extractYouTubeId(raw)) return;
    await supabase.from("site_settings").upsert({
      key: "home_video_url",
      value: raw,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });
  }

  revalidatePath("/portal");
  revalidatePath("/portal/admin/settings");
}

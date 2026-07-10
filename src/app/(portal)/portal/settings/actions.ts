"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";

export async function updateName(formData: FormData) {
  const name = String(formData.get("full_name") ?? "").trim();
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ full_name: name || null })
    .eq("id", user.id);
  revalidatePath("/portal/admin/settings");
  revalidatePath("/portal/school/settings");
  revalidatePath("/portal/student/settings");
  revalidatePath("/portal");
}

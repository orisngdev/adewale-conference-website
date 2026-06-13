"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";

export async function toggleRegistration(year: number, open: boolean) {
  const supabase = await createClient();
  // RLS (editions_admin_write) restricts this to admins.
  await supabase
    .from("editions")
    .update({ registration_open: open })
    .eq("year", year);
  revalidatePath("/portal/admin/editions");
}

export async function setEditionStage(year: number, formData: FormData) {
  const stage = String(formData.get("stage") ?? "").trim();
  if (!stage) return;
  const supabase = await createClient();
  await supabase
    .from("editions")
    .update({ current_stage: stage })
    .eq("year", year);
  // Notify everyone tied to this edition (in-portal alert).
  await supabase.rpc("notify_edition_stage", { p_year: year });
  revalidatePath("/portal/admin/editions");
  revalidatePath("/portal");
}

export async function createEdition(formData: FormData) {
  const year = Number(formData.get("year"));
  const title = String(formData.get("title") ?? "").trim();
  if (!Number.isInteger(year) || year < 2000) return;
  const supabase = await createClient();
  await supabase
    .from("editions")
    .upsert({ year, title: title || null }, { onConflict: "year" });
  revalidatePath("/portal/admin/editions");
}

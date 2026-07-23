"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { requireManage } from "@/supabase/auth";

export async function toggleRegistration(year: number, open: boolean) {
  if (!(await requireManage("registrations"))) return;
  const supabase = await createClient();
  // RLS (editions_admin_write) restricts this to admins.
  await supabase
    .from("editions")
    .update({ registration_open: open })
    .eq("year", year);
  revalidatePath("/portal/admin/editions");
}

export async function setEditionStage(year: number, formData: FormData) {
  if (!(await requireManage("registrations"))) return;
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

// One-click "advance to the next stage" — derives the next stage server-side so
// the common path never needs the dropdown. Fans out the same notification.
export async function advanceEditionStage(year: number) {
  if (!(await requireManage("registrations"))) return;
  const supabase = await createClient();
  const { data: edition } = await supabase
    .from("editions")
    .select("stages, current_stage")
    .eq("year", year)
    .maybeSingle();
  if (!edition) return;
  const stages = (edition.stages ?? []) as string[];
  const idx = stages.indexOf(edition.current_stage as string);
  const next = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null;
  if (!next) return;
  await supabase.from("editions").update({ current_stage: next }).eq("year", year);
  await supabase.rpc("notify_edition_stage", { p_year: year });
  revalidatePath("/portal/admin/editions");
  revalidatePath("/portal");
}

export async function createEdition(formData: FormData) {
  if (!(await requireManage("registrations"))) return;
  const year = Number(formData.get("year"));
  const title = String(formData.get("title") ?? "").trim();
  if (!Number.isInteger(year) || year < 2000) return;
  const supabase = await createClient();
  await supabase
    .from("editions")
    .upsert({ year, title: title || null }, { onConflict: "year" });
  revalidatePath("/portal/admin/editions");
}

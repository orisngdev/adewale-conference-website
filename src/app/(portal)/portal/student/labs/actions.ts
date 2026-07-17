"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";

// Tick a lesson for the current student and advance to the next lesson by sort.
// RLS (lab_progress_self) is the gate — the upsert can only touch the caller's
// own row.
export async function markLessonDone(labId: string, slug: string, stepKey: string) {
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  const supabase = await createClient();

  await supabase.from("lab_progress").upsert(
    { lab_id: labId, student_user_id: user.id, step_key: stepKey },
    { onConflict: "lab_id,student_user_id,step_key" },
  );

  const { data: steps } = await supabase
    .from("lab_steps")
    .select("key, sort")
    .eq("lab_id", labId)
    .order("sort");
  const ordered = (steps ?? []) as { key: string; sort: number }[];
  const idx = ordered.findIndex((s) => s.key === stepKey);
  // Advance to the next lesson; on the last lesson, stay put so the student
  // sees the completed state + unlocked certificate.
  const target = idx >= 0 && idx + 1 < ordered.length ? ordered[idx + 1].key : stepKey;

  revalidatePath(`/portal/student/labs/${slug}`);
  redirect(`/portal/student/labs/${slug}?lesson=${encodeURIComponent(target)}`);
}

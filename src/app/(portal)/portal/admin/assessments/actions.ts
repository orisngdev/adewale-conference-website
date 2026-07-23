"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { requireManage } from "@/supabase/auth";

type Db = Awaited<ReturnType<typeof createClient>>;

// Bump content_version so offline practice caches know to refetch the bank.
async function bumpVersion(supabase: Db, id: string) {
  const { data } = await supabase
    .from("assessments")
    .select("content_version")
    .eq("id", id)
    .maybeSingle();
  await supabase
    .from("assessments")
    .update({ content_version: ((data?.content_version as number) ?? 1) + 1 })
    .eq("id", id);
}

export async function createAssessment(formData: FormData) {
  if (!(await requireManage("content"))) return;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const level = String(formData.get("level") ?? "").trim() || null;
  const mode = String(formData.get("mode") ?? "exam") === "practice" ? "practice" : "exam";

  const supabase = await createClient();
  const { data } = await supabase
    .from("assessments")
    .insert({ title, subject, level, mode })
    .select("id")
    .single();
  revalidatePath("/portal/admin/assessments");
  if (data?.id) redirect(`/portal/admin/assessments/${data.id}`);
}

export async function toggleAssessmentPublished(id: string, published: boolean) {
  if (!(await requireManage("content"))) return;
  const supabase = await createClient();
  await supabase.from("assessments").update({ published }).eq("id", id);
  revalidatePath("/portal/admin/assessments");
  revalidatePath(`/portal/admin/assessments/${id}`);
}

export async function updateAssessmentSettings(id: string, formData: FormData) {
  if (!(await requireManage("content"))) return;
  const maxAttempts = Math.max(1, Number(formData.get("max_attempts") ?? 1));
  const rawLimit = String(formData.get("time_limit_minutes") ?? "").trim();
  const timeLimit = rawLimit ? Math.max(1, Number(rawLimit)) : null;

  const supabase = await createClient();
  await supabase
    .from("assessments")
    .update({ max_attempts: maxAttempts, time_limit_minutes: timeLimit })
    .eq("id", id);
  revalidatePath(`/portal/admin/assessments/${id}`);
}

export async function deleteAssessment(id: string) {
  if (!(await requireManage("content"))) return;
  const supabase = await createClient();
  await supabase.from("assessments").delete().eq("id", id);
  revalidatePath("/portal/admin/assessments");
  redirect("/portal/admin/assessments");
}

export async function addQuestion(assessmentId: string, formData: FormData) {
  if (!(await requireManage("content"))) return;
  const prompt = String(formData.get("prompt") ?? "").trim();
  const options = [1, 2, 3, 4]
    .map((i) => String(formData.get(`opt${i}`) ?? "").trim())
    .filter(Boolean);
  const correct = Number(formData.get("correct") ?? 1) - 1;
  const explanation = String(formData.get("explanation") ?? "").trim() || null;
  if (!prompt || options.length < 2) return;

  const supabase = await createClient();
  // Tag the new bank question with this assessment's pool + subject/level.
  const { data: a } = await supabase
    .from("assessments")
    .select("mode, subject, level")
    .eq("id", assessmentId)
    .maybeSingle();

  const { data: q } = await supabase
    .from("question_bank")
    .insert({
      prompt,
      options,
      correct_index: Math.min(Math.max(correct, 0), options.length - 1),
      explanation,
      mode: (a?.mode as string) ?? "exam",
      subject: a?.subject ?? null,
      level: a?.level ?? null,
    })
    .select("id")
    .single();
  if (!q?.id) return;

  const { count } = await supabase
    .from("assessment_questions")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId);

  await supabase.from("assessment_questions").insert({
    assessment_id: assessmentId,
    question_id: q.id,
    position: count ?? 0,
  });
  await bumpVersion(supabase, assessmentId);
  revalidatePath(`/portal/admin/assessments/${assessmentId}`);
}

export async function deleteQuestion(questionId: string, assessmentId: string) {
  if (!(await requireManage("content"))) return;
  const supabase = await createClient();
  await supabase.from("question_bank").delete().eq("id", questionId);
  await bumpVersion(supabase, assessmentId);
  revalidatePath(`/portal/admin/assessments/${assessmentId}`);
}

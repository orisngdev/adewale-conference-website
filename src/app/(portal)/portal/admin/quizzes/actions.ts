"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";

export async function createQuiz(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const level = String(formData.get("level") ?? "").trim() || null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("quizzes")
    .insert({ title, subject, level })
    .select("id")
    .single();
  revalidatePath("/portal/admin/quizzes");
  if (data?.id) redirect(`/portal/admin/quizzes/${data.id}`);
}

export async function toggleQuizPublished(quizId: string, published: boolean) {
  const supabase = await createClient();
  await supabase.from("quizzes").update({ published }).eq("id", quizId);
  revalidatePath("/portal/admin/quizzes");
  revalidatePath(`/portal/admin/quizzes/${quizId}`);
}

export async function updateQuizSettings(quizId: string, formData: FormData) {
  const maxAttempts = Math.max(1, Number(formData.get("max_attempts") ?? 1));
  const rawLimit = String(formData.get("time_limit_minutes") ?? "").trim();
  const timeLimit = rawLimit ? Math.max(1, Number(rawLimit)) : null;

  const supabase = await createClient();
  await supabase
    .from("quizzes")
    .update({ max_attempts: maxAttempts, time_limit_minutes: timeLimit })
    .eq("id", quizId);
  revalidatePath(`/portal/admin/quizzes/${quizId}`);
}

export async function deleteQuiz(quizId: string) {
  const supabase = await createClient();
  await supabase.from("quizzes").delete().eq("id", quizId);
  revalidatePath("/portal/admin/quizzes");
  redirect("/portal/admin/quizzes");
}

export async function addQuestion(quizId: string, formData: FormData) {
  const prompt = String(formData.get("prompt") ?? "").trim();
  const options = [1, 2, 3, 4]
    .map((i) => String(formData.get(`opt${i}`) ?? "").trim())
    .filter(Boolean);
  const correct = Number(formData.get("correct") ?? 1) - 1;
  if (!prompt || options.length < 2) return;

  const supabase = await createClient();
  const { count } = await supabase
    .from("quiz_questions")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", quizId);

  await supabase.from("quiz_questions").insert({
    quiz_id: quizId,
    prompt,
    options,
    correct_index: Math.min(Math.max(correct, 0), options.length - 1),
    position: count ?? 0,
  });
  revalidatePath(`/portal/admin/quizzes/${quizId}`);
}

export async function deleteQuestion(questionId: string, quizId: string) {
  const supabase = await createClient();
  await supabase.from("quiz_questions").delete().eq("id", questionId);
  revalidatePath(`/portal/admin/quizzes/${quizId}`);
}

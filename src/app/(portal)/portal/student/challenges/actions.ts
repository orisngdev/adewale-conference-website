"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isPastDeadline, type ChallengeType, type EntryPayload } from "@/lib/challenges";

// Student entry submit / resubmit. Uses the RLS client with the student's own
// session — the database is the gate (self insert/update, and update is blocked
// once status flips to 'reviewed'). Deadline + published are enforced here.

function back(id: string, error?: string): never {
  redirect(`/portal/student/challenges/${id}${error ? `?e=${error}` : ""}`);
}

async function saveEntry(
  challengeId: string,
  expectedType: ChallengeType,
  payload: EntryPayload,
) {
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, type, published, deadline")
    .eq("id", challengeId)
    .maybeSingle();
  if (!challenge || !challenge.published || challenge.type !== expectedType) {
    back(challengeId, "closed");
  }
  if (isPastDeadline((challenge as { deadline: string | null }).deadline)) {
    back(challengeId, "deadline");
  }

  const { data: existing } = await supabase
    .from("challenge_entries")
    .select("id, status")
    .eq("challenge_id", challengeId)
    .eq("student_user_id", user.id)
    .maybeSingle();

  if (existing?.status === "reviewed") back(challengeId, "reviewed");

  if (existing) {
    await supabase
      .from("challenge_entries")
      .update({ payload, submitted_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("challenge_entries")
      .insert({ challenge_id: challengeId, student_user_id: user.id, payload });
  }

  revalidatePath(`/portal/student/challenges/${challengeId}`);
  revalidatePath("/portal/student/challenges");
  back(challengeId);
}

export async function submitPitchEntry(challengeId: string) {
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  const supabase = await createClient();

  const { data: canvas } = await supabase
    .from("pitch_canvas")
    .select("data")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  const data = (canvas?.data ?? {}) as Record<string, { id?: string; text: string }[]>;
  const hasContent = Object.values(data).some((notes) =>
    Array.isArray(notes) && notes.some((n) => n?.text?.trim()),
  );
  if (!hasContent) back(challengeId, "empty");

  await saveEntry(challengeId, "pitch", { canvas: data });
}

export async function submitTextEntry(challengeId: string, formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();
  if (!text) back(challengeId, "empty");
  await saveEntry(challengeId, "text", { text });
}

export async function submitLinkEntry(challengeId: string, formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || null;
  if (!/^https?:\/\/.+/i.test(url)) back(challengeId, "url");
  await saveEntry(challengeId, "link", { url, label });
}

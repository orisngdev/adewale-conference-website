"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { requireAdmin } from "@/supabase/auth";
import { AUTHORABLE_TYPES, type ChallengeType } from "@/lib/challenges";

// Admin challenge authoring + review. RLS already restricts writes to admins;
// the explicit requireAdmin() gates make that intent obvious and guard the
// service-role-free cross-user reads (notifications).

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function uniqueSlug(base: string, existing: Set<string>) {
  const root = base || "challenge";
  if (!existing.has(root)) return root;
  let n = 2;
  while (existing.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}

function readType(formData: FormData): ChallengeType | null {
  const t = String(formData.get("type") ?? "");
  return (AUTHORABLE_TYPES as string[]).includes(t) ? (t as ChallengeType) : null;
}

// datetime-local ("2026-08-30T23:59") → ISO, or null. Invalid input → null.
function readDeadline(formData: FormData): string | null {
  const raw = String(formData.get("deadline") ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function readYear(formData: FormData): number | null {
  const raw = String(formData.get("edition_year") ?? "").trim();
  const n = Number(raw);
  return Number.isInteger(n) && n > 2000 && n < 2100 ? n : null;
}

// Shared editable fields (all authorable types share the same authoring form).
function challengeFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    description_md: String(formData.get("brief") ?? "").trim() || null,
    deadline: readDeadline(formData),
    edition_year: readYear(formData),
  };
}

export async function createChallenge(formData: FormData) {
  if (!(await requireAdmin())) return;
  const type = readType(formData);
  const fields = challengeFields(formData);
  if (!type || !fields.title) return;
  const published = formData.get("published") === "on";

  const supabase = await createClient();
  const { data: existing } = await supabase.from("challenges").select("slug");
  const slugs = new Set(((existing ?? []) as { slug: string }[]).map((c) => c.slug));
  const slug = uniqueSlug(slugify(fields.title), slugs);

  const { data: inserted } = await supabase
    .from("challenges")
    .insert({ slug, type, published, ...fields })
    .select("id")
    .single();

  revalidatePath("/portal/admin/challenges");
  revalidatePath("/portal/student/challenges");
  redirect(inserted ? `/portal/admin/challenges/${inserted.id}` : "/portal/admin/challenges");
}

export async function updateChallenge(challengeId: string, formData: FormData) {
  if (!(await requireAdmin())) return;
  const type = readType(formData);
  const fields = challengeFields(formData);
  if (!type || !fields.title) return;

  const supabase = await createClient();
  await supabase.from("challenges").update({ type, ...fields }).eq("id", challengeId);
  revalidatePath("/portal/admin/challenges");
  revalidatePath(`/portal/admin/challenges/${challengeId}`);
  revalidatePath("/portal/student/challenges");
  revalidatePath(`/portal/student/challenges/${challengeId}`);
}

export async function toggleChallengePublished(challengeId: string, published: boolean) {
  if (!(await requireAdmin())) return;
  const supabase = await createClient();
  await supabase.from("challenges").update({ published }).eq("id", challengeId);
  revalidatePath("/portal/admin/challenges");
  revalidatePath(`/portal/admin/challenges/${challengeId}`);
  revalidatePath("/portal/student/challenges");
}

export async function deleteChallenge(challengeId: string) {
  if (!(await requireAdmin())) return;
  const supabase = await createClient();
  await supabase.from("challenges").delete().eq("id", challengeId);
  revalidatePath("/portal/admin/challenges");
  revalidatePath("/portal/student/challenges");
  redirect("/portal/admin/challenges");
}

// Score + feedback an entry, lock it, and notify the student (once).
export async function reviewEntry(challengeId: string, entryId: string, formData: FormData) {
  if (!(await requireAdmin())) return;
  const score = Number(String(formData.get("score") ?? "").trim());
  if (!Number.isInteger(score) || score < 0 || score > 100) return;
  const feedback = String(formData.get("feedback") ?? "").trim() || null;

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("challenge_entries")
    .select("id, student_user_id, status")
    .eq("id", entryId)
    .eq("challenge_id", challengeId)
    .maybeSingle();
  if (!entry) return;

  await supabase
    .from("challenge_entries")
    .update({ status: "reviewed", score, feedback, reviewed_at: new Date().toISOString() })
    .eq("id", entryId);

  // Only notify on the first review, not on later edits to the score.
  if ((entry as { status: string }).status === "submitted") {
    const { data: challenge } = await supabase
      .from("challenges")
      .select("title")
      .eq("id", challengeId)
      .maybeSingle();
    await supabase.from("notifications").insert({
      profile_id: (entry as { student_user_id: string }).student_user_id,
      title: "Your challenge entry was reviewed",
      body: `${challenge?.title ?? "Your challenge"} — you scored ${score}/100.`,
      link: `/portal/student/challenges/${challengeId}`,
    });
  }

  revalidatePath(`/portal/admin/challenges/${challengeId}`);
  revalidatePath(`/portal/student/challenges/${challengeId}`);
}

"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { requireManage } from "@/supabase/auth";
import { resourceStorage } from "@/lib/storage";
import { LAB_KINDS, type LabStepKind } from "@/lib/labs";

const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB per lab PDF.

// Admin-only lab authoring. RLS already restricts writes to admins; these
// explicit requireAdmin() gates make that intent obvious at the call site.

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Make `base` unique against `existing` by appending -2, -3, … as needed.
function uniqueSlug(base: string, existing: Set<string>) {
  const root = base || "item";
  if (!existing.has(root)) return root;
  let n = 2;
  while (existing.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}

function readKind(formData: FormData): LabStepKind {
  const k = String(formData.get("kind") ?? "lesson");
  return (LAB_KINDS as string[]).includes(k) ? (k as LabStepKind) : "lesson";
}

// Keep only the fields relevant to the chosen kind (so switching type doesn't
// leave stale media/link/quiz data behind).
function stepFields(formData: FormData) {
  const kind = readKind(formData);
  const title = String(formData.get("title") ?? "").trim();
  const bodyRaw = String(formData.get("body_md") ?? "").trim();
  const body_md = bodyRaw || null;
  const duration = String(formData.get("duration_label") ?? "").trim() || null;
  const mediaRaw = String(formData.get("media_url") ?? "").trim() || null;
  const linkLabel = String(formData.get("link_label") ?? "").trim() || null;
  const assessmentRaw = String(formData.get("assessment_id") ?? "").trim();
  const assessment_id = assessmentRaw || null;

  return {
    kind,
    title,
    body_md,
    duration_label: duration,
    media_url: kind === "video" || kind === "link" ? mediaRaw : null,
    link_label: kind === "link" ? linkLabel : null,
    assessment_id: kind === "quiz" ? assessment_id : null,
  };
}

// Resolve the stored PDF for a step. On a "pdf" kind with a new upload we push it
// to object storage and drop any previous file; with no new upload we keep the
// existing one. Any other kind clears (and deletes) a leftover PDF. Invalid files
// are ignored (kept as-is) — matching the rest of these void form actions.
async function resolveStepFile(
  formData: FormData,
  kind: LabStepKind,
  existing: { storage_key: string | null; file_name: string | null } | null,
): Promise<{ storage_key: string | null; file_name: string | null }> {
  const prevKey = existing?.storage_key ?? null;
  const keep = { storage_key: prevKey, file_name: existing?.file_name ?? null };

  const removePrev = async () => {
    if (prevKey && resourceStorage.configured) {
      try {
        await resourceStorage.remove(prevKey);
      } catch {
        /* best-effort */
      }
    }
  };

  if (kind !== "pdf") {
    await removePrev();
    return { storage_key: null, file_name: null };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return keep; // no new upload

  if (!resourceStorage.configured) return keep;
  if (file.type && file.type !== "application/pdf") return keep;
  if (file.size > MAX_PDF_BYTES) return keep;

  const safeName = (file.name || "document.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `labs/${randomUUID()}/${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    await resourceStorage.put(key, bytes, "application/pdf");
  } catch {
    return keep; // upload failed — don't lose the existing file
  }
  await removePrev();
  return { storage_key: key, file_name: file.name || safeName };
}

// ── Labs ──────────────────────────────────────────────────────────────────────
export async function createLab(formData: FormData) {
  if (!(await requireManage("labs"))) return;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const track = String(formData.get("track") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const workbench_url = String(formData.get("workbench_url") ?? "").trim() || null;

  const supabase = await createClient();
  const { data: labs } = await supabase.from("labs").select("slug, sort");
  const slugs = new Set(((labs ?? []) as { slug: string }[]).map((l) => l.slug));
  const slug = uniqueSlug(slugify(title), slugs);
  const maxSort = ((labs ?? []) as { sort: number }[]).reduce((m, l) => Math.max(m, l.sort), -1);

  await supabase.from("labs").insert({ slug, title, track, summary, workbench_url, sort: maxSort + 1 });
  revalidatePath("/portal/admin/labs");
  redirect(`/portal/admin/labs?lab=${slug}`);
}

export async function updateLab(labId: string, slug: string, formData: FormData) {
  if (!(await requireManage("labs"))) return;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const track = String(formData.get("track") ?? "").trim() || null;
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const workbench_url = String(formData.get("workbench_url") ?? "").trim() || null;

  const supabase = await createClient();
  await supabase.from("labs").update({ title, track, summary, workbench_url }).eq("id", labId);
  revalidatePath("/portal/admin/labs");
  revalidatePath(`/portal/student/labs/${slug}`);
}

export async function toggleLabPublished(labId: string, slug: string, published: boolean) {
  if (!(await requireManage("labs"))) return;
  const supabase = await createClient();
  await supabase.from("labs").update({ published }).eq("id", labId);
  revalidatePath("/portal/admin/labs");
  revalidatePath("/portal/student/labs");
  revalidatePath(`/portal/student/labs/${slug}`);
}

export async function deleteLab(labId: string) {
  if (!(await requireManage("labs"))) return;
  const supabase = await createClient();
  await supabase.from("labs").delete().eq("id", labId);
  revalidatePath("/portal/admin/labs");
  revalidatePath("/portal/student/labs");
  redirect("/portal/admin/labs");
}

// ── Lessons (lab_steps) ─────────────────────────────────────────────────────────
export async function addStep(labId: string, slug: string, formData: FormData) {
  if (!(await requireManage("labs"))) return;
  const fields = stepFields(formData);
  if (!fields.title) return;

  const supabase = await createClient();
  const { data: existing } = await supabase.from("lab_steps").select("key, sort").eq("lab_id", labId);
  const keys = new Set(((existing ?? []) as { key: string }[]).map((s) => s.key));
  const key = uniqueSlug(slugify(fields.title), keys);
  const maxSort = ((existing ?? []) as { sort: number }[]).reduce((m, s) => Math.max(m, s.sort), -1);
  const fileFields = await resolveStepFile(formData, fields.kind, null);

  await supabase
    .from("lab_steps")
    .insert({ lab_id: labId, key, sort: maxSort + 1, ...fields, ...fileFields });
  revalidatePath("/portal/admin/labs");
  revalidatePath(`/portal/student/labs/${slug}`);
}

export async function updateStep(stepId: string, labId: string, slug: string, formData: FormData) {
  if (!(await requireManage("labs"))) return;
  const fields = stepFields(formData);
  if (!fields.title) return;

  const supabase = await createClient();
  const { data: prev } = await supabase
    .from("lab_steps")
    .select("storage_key, file_name")
    .eq("id", stepId)
    .eq("lab_id", labId)
    .maybeSingle();
  const fileFields = await resolveStepFile(
    formData,
    fields.kind,
    (prev as { storage_key: string | null; file_name: string | null } | null) ?? null,
  );

  await supabase
    .from("lab_steps")
    .update({ ...fields, ...fileFields })
    .eq("id", stepId)
    .eq("lab_id", labId);
  revalidatePath("/portal/admin/labs");
  revalidatePath(`/portal/student/labs/${slug}`);
}

export async function deleteStep(stepId: string, labId: string, slug: string) {
  if (!(await requireManage("labs"))) return;
  const supabase = await createClient();
  // Drop the uploaded PDF (if any) before the row so storage doesn't leak.
  const { data: prev } = await supabase
    .from("lab_steps")
    .select("storage_key")
    .eq("id", stepId)
    .eq("lab_id", labId)
    .maybeSingle();
  const storageKey = (prev as { storage_key: string | null } | null)?.storage_key ?? null;
  if (storageKey && resourceStorage.configured) {
    try {
      await resourceStorage.remove(storageKey);
    } catch {
      /* best-effort — still delete the row */
    }
  }
  await supabase.from("lab_steps").delete().eq("id", stepId).eq("lab_id", labId);
  revalidatePath("/portal/admin/labs");
  revalidatePath(`/portal/student/labs/${slug}`);
}

// Swap a lesson with its neighbour, then renumber sort sequentially so the
// order is always dense and unambiguous.
export async function moveStep(stepId: string, labId: string, slug: string, dir: "up" | "down") {
  if (!(await requireManage("labs"))) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("lab_steps")
    .select("id, sort")
    .eq("lab_id", labId)
    .order("sort");
  const ordered = (data ?? []) as { id: string; sort: number }[];
  const idx = ordered.findIndex((s) => s.id === stepId);
  if (idx < 0) return;
  const target = dir === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= ordered.length) return;

  [ordered[idx], ordered[target]] = [ordered[target], ordered[idx]];
  await Promise.all(
    ordered.map((s, i) => (s.sort === i ? null : supabase.from("lab_steps").update({ sort: i }).eq("id", s.id))),
  );
  revalidatePath("/portal/admin/labs");
  revalidatePath(`/portal/student/labs/${slug}`);
}

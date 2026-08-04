"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { requireManage } from "@/supabase/auth";
import { resourceStorage } from "@/lib/storage";
import { slugifyResource, isAllowedResourceFile } from "@/lib/resources";
import { accessRank } from "@/lib/resource-access";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per resource file.

function revalidateResourceViews() {
  revalidatePath("/portal/admin/resources");
  revalidatePath("/portal/student/resources");
  revalidatePath("/portal/school/resources");
}

// Create a resource from the admin form. Accepts an uploaded file OR an external
// URL (or neither, for a page-only entry). The file goes to object storage; only
// its key is stored in the row.
export async function createResource(formData: FormData) {
  const admin = await requireManage("content");
  if (!admin) return;
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const type = String(formData.get("type") ?? "").trim() || null;
  const subject = String(formData.get("subject") ?? "").trim() || null;
  const level = String(formData.get("level") ?? "").trim() || null;
  const accessRaw = String(formData.get("access") ?? "public").trim();
  const access = accessRank(accessRaw) >= 0 ? accessRaw : "public";
  const audienceRaw = String(formData.get("audience") ?? "both").trim();
  const audience = ["student", "coordinator", "both"].includes(audienceRaw) ? audienceRaw : "both";
  const editionYearRaw = String(formData.get("edition_year") ?? "").trim();
  const editionYear = editionYearRaw && /^\d{4}$/.test(editionYearRaw) ? Number(editionYearRaw) : null;
  const externalUrl = String(formData.get("external_url") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim() || null;
  const published = formData.get("published") != null;
  // Checkbox: present (checked) → downloadable; unchecked → preview-only.
  const downloadable = formData.get("downloadable") != null;

  let storageKey: string | null = null;
  let fileName: string | null = null;
  let contentType: string | null = null;

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    // A file was chosen but storage isn't wired — refuse rather than create a
    // row pointing at nothing.
    if (!resourceStorage.configured) return;
    if (file.size > MAX_FILE_BYTES) return;
    // Documents only — the client `accept` is a hint, so re-check here.
    if (!isAllowedResourceFile(file.name || "", file.type || "")) return;

    const safeName = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    storageKey = `${randomUUID()}/${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      await resourceStorage.put(storageKey, bytes, file.type || undefined);
    } catch {
      return; // upload failed — don't insert a dangling row.
    }
    fileName = file.name || safeName;
    contentType = file.type || null;
  }

  // RLS (resources_admin_write) also gates this to admins.
  await supabase.from("resources").insert({
    title,
    slug: slugifyResource(title, randomUUID().slice(0, 6)),
    type,
    subject,
    level,
    edition_year: editionYear,
    access,
    audience,
    storage_key: storageKey,
    file_name: fileName,
    content_type: contentType,
    external_url: externalUrl,
    body,
    published,
    downloadable,
    created_by: admin.user.id,
  });

  revalidateResourceViews();
}

export async function setResourcePublished(id: string, published: boolean) {
  const admin = await requireManage("content");
  if (!admin) return;
  const supabase = await createClient();
  await supabase
    .from("resources")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateResourceViews();
}

export async function deleteResource(id: string) {
  const admin = await requireManage("content");
  if (!admin) return;
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("resources")
    .select("storage_key")
    .eq("id", id)
    .maybeSingle();
  const storageKey = (row?.storage_key as string | null) ?? null;
  if (storageKey && resourceStorage.configured) {
    try {
      await resourceStorage.remove(storageKey);
    } catch {
      /* best-effort — still drop the metadata row below */
    }
  }
  await supabase.from("resources").delete().eq("id", id);
  revalidateResourceViews();
}

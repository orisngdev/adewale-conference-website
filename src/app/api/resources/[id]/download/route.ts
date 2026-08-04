import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { resourceStorage } from "@/lib/storage";
import { authorizeResource } from "@/lib/resource-serve";

export const runtime = "nodejs";

// Download a portal resource. Tier gating lives in authorizeResource; the file
// itself stays private behind a short-lived signed URL. Resources marked
// preview-only (downloadable = false) never hand over an attachment — the
// request is redirected to the inline preview route instead.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await authorizeResource(id, request);
  if ("response" in gate) return gate.response;
  const { resource, user } = gate;

  // Preview-only → send them to the inline viewer, never a download.
  if (!resource.downloadable) {
    return NextResponse.redirect(new URL(`/api/resources/${id}/view`, request.url));
  }

  // Best-effort download log — only for signed-in viewers (powers Progress).
  if (user) {
    const supabase = await createClient();
    await supabase
      .from("resource_downloads")
      .insert({ resource_id: id, student_user_id: user.id, event: "download" });
  }

  if (resource.storage_key) {
    const url = await resourceStorage.signedDownloadUrl(resource.storage_key, {
      filename: resource.file_name ?? undefined,
    });
    return NextResponse.redirect(url);
  }
  if (resource.external_url) {
    return NextResponse.redirect(resource.external_url);
  }
  return NextResponse.json({ error: "No file" }, { status: 404 });
}

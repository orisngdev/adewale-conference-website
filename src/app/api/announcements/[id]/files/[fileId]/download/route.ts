import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { resourceStorage } from "@/lib/storage";

export const runtime = "nodejs";

// Download a file attached to an announcement.
//
// Unlike the resource routes, this deliberately does NOT use the service-role
// client. authorizeResource needs it because public-tier resources serve to
// anonymous visitors; announcement attachments are never public, so the caller's
// own session is the right lens: ann_attachments_read (has_module_view for
// admins, can_read_announcement for educators) resolves every case — not signed
// in, wrong school, wrong edition year, announcement still a draft, unknown id —
// into a single "no row". If the row comes back, the caller may have it.
//
// The file id is nested under the announcement id so the check is one scoped read.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("announcement_attachments")
    .select("id, storage_key, file_name")
    .eq("id", fileId)
    .eq("announcement_id", id)
    .maybeSingle();
  const attachment = data as {
    id: string;
    storage_key: string;
    file_name: string | null;
  } | null;

  if (!attachment) {
    // Signed out → send them to log in and come back. Signed in → 404, never
    // 403: don't confirm an announcement exists to someone not targeted by it.
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.redirect(
        new URL(
          `/portal/login?redirectTo=${encodeURIComponent(`/portal/announcements/${id}`)}`,
          request.url,
        ),
      );
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!resourceStorage.configured) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  const url = await resourceStorage.signedDownloadUrl(attachment.storage_key, {
    filename: attachment.file_name ?? undefined,
    disposition: "attachment",
  });
  return NextResponse.redirect(url);
}

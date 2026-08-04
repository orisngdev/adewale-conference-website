import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { resourceStorage } from "@/lib/storage";
import { authorizeResource } from "@/lib/resource-serve";

export const runtime = "nodejs";

// Inline preview of a portal resource file. Same tier gate as /download, but the
// bytes are streamed same-origin with Content-Disposition: inline — so the
// client PdfReader can fetch a PDF without a cross-origin/S3 link, and other
// document types open in the browser rather than force a save.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await authorizeResource(id, request);
  if ("response" in gate) return gate.response;
  const { resource, user } = gate;

  // Best-effort preview log — mirrors the download route.
  if (user) {
    const supabase = await createClient();
    await supabase
      .from("resource_downloads")
      .insert({ resource_id: id, student_user_id: user.id, event: "view" });
  }

  if (!resource.storage_key) {
    if (resource.external_url) return NextResponse.redirect(resource.external_url);
    return NextResponse.json({ error: "No file" }, { status: 404 });
  }
  if (!resourceStorage.configured) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  let bytes: Buffer;
  try {
    bytes = await resourceStorage.read(resource.storage_key);
  } catch {
    return NextResponse.json({ error: "Could not read the file" }, { status: 502 });
  }

  const fileName = (resource.file_name ?? "document").replace(/"/g, "");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": resource.content_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

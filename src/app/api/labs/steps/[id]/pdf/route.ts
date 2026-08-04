import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { resourceStorage } from "@/lib/storage";

export const runtime = "nodejs";

// Stream a lab lesson's uploaded PDF inline (preview-only). Gated to signed-in
// users and proxied same-origin so the client PdfReader never sees a public/S3
// link and there's no attachment disposition to trigger a download. RLS on
// lab_steps already limits reads to authenticated viewers.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: step } = await supabase
    .from("lab_steps")
    .select("storage_key, file_name")
    .eq("id", id)
    .maybeSingle();

  const storageKey = (step?.storage_key as string | null) ?? null;
  if (!storageKey) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!resourceStorage.configured) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  let bytes: Buffer;
  try {
    bytes = await resourceStorage.read(storageKey);
  } catch {
    return NextResponse.json({ error: "Could not read the document" }, { status: 502 });
  }

  const fileName = ((step?.file_name as string | null) ?? "document.pdf").replace(/"/g, "");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";
import { createAdminClient } from "@/supabase/admin";
import { getSessionUser, getUserRole } from "@/supabase/auth";
import { resourceStorage } from "@/lib/storage";
import { canAccess, tierRank } from "@/lib/resource-access";

export const runtime = "nodejs";

// Download a portal resource.
//   • Public-tier resources are free (ADR-0006 keeps study packs public) — served
//     to anyone, no login. The file is read via the service role so an anonymous
//     visitor (who can't pass RLS) still gets it.
//   • Gated resources require a signed-in viewer whose school has reached the tier
//     (admins bypass). Locked → 403.
// Either way the file itself stays private behind a short-lived signed URL.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }

  const { data: resource } = await admin
    .from("resources")
    .select("id, access, storage_key, file_name, external_url, published")
    .eq("id", id)
    .maybeSingle();
  if (!resource || !resource.published) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isPublic = (resource.access as string | null ?? "public") === "public";
  const user = await getSessionUser();

  if (!isPublic) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/portal/login?redirectTo=/portal`, request.url),
      );
    }
    // Admins bypass the tier gate; everyone else must have reached the tier.
    if ((await getUserRole()) !== "admin") {
      const supabase = await createClient();
      const { data: school } = await supabase.rpc("get_my_school");
      const reg =
        (school as {
          registration?: {
            status?: string;
            stage_results?: { stage: string; outcome: string | null }[];
          } | null;
        } | null)?.registration ?? null;
      // Tier is derived from stage advancement, not the status flag.
      const tier = tierRank(reg?.status ?? null, reg?.stage_results);
      if (!canAccess(resource.access as string, tier)) {
        return NextResponse.json({ error: "Locked" }, { status: 403 });
      }
    }
  }

  // Best-effort download log — only for signed-in viewers (powers Progress).
  if (user) {
    const supabase = await createClient();
    await supabase
      .from("resource_downloads")
      .insert({ resource_id: id, student_user_id: user.id, event: "download" });
  }

  if (resource.storage_key) {
    const url = await resourceStorage.signedDownloadUrl(resource.storage_key as string, {
      filename: (resource.file_name as string | null) ?? undefined,
    });
    return NextResponse.redirect(url);
  }
  if (resource.external_url) {
    return NextResponse.redirect(resource.external_url as string);
  }
  return NextResponse.json({ error: "No file" }, { status: 404 });
}

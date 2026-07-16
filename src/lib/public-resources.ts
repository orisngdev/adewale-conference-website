import "server-only";
import { createAdminClient } from "@/supabase/admin";
import {
  RESOURCE_COLUMNS,
  STUDENT_VISIBLE_AUDIENCE,
  mapResource,
  type PortalResource,
  type ResourceRow,
} from "./resources";

// Server-only readers for the PUBLIC (unauthenticated) resource library. The
// resources table is RLS-gated to authenticated users, so anon reads go through
// the service role — restricted here to published, public-tier, student-facing
// rows so nothing gated or coordinator-only leaks onto the marketing site.
export async function listPublicResources(): Promise<PortalResource[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("resources")
    .select(RESOURCE_COLUMNS)
    .eq("published", true)
    .eq("access", "public")
    .in("audience", [...STUDENT_VISIBLE_AUDIENCE])
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as ResourceRow[]).map(mapResource);
}

// A single resource by slug for the public detail page. Any published,
// student-facing row (gated ones render a "for participating schools" card
// instead of a download — their file is never served here).
export async function getPublicResourceBySlug(
  slug: string,
): Promise<PortalResource | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("resources")
    .select(RESOURCE_COLUMNS)
    .eq("slug", slug)
    .eq("published", true)
    .in("audience", [...STUDENT_VISIBLE_AUDIENCE])
    .maybeSingle();
  return data ? mapResource(data as unknown as ResourceRow) : null;
}

export async function listPublicResourceSlugs(): Promise<string[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("resources")
    .select("slug")
    .eq("published", true)
    .not("slug", "is", null);
  return ((data ?? []) as { slug: string | null }[])
    .map((r) => r.slug)
    .filter((s): s is string => Boolean(s));
}

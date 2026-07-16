// Netlify Background Function (the `-background` suffix): Netlify returns 202 to
// the caller immediately and then runs this for up to 15 minutes — long enough
// for the full Airtable → portal sync, which blows past the normal ~10-26s
// function timeout (that was the 504 on the admin "Sync from Airtable" button).
// The admin action triggers this and returns instantly; this posts a
// notification to the admin who started it when the sync finishes.
//
// Guarded by SYNC_SECRET (same shared secret as the /api/sync-airtable route).
import { syncAirtableToPortal, describeSyncSummary } from "@/lib/airtable-sync";
import { createAdminClient } from "@/supabase/admin";

export default async (req: Request) => {
  const url = new URL(req.url);
  const secret = process.env.SYNC_SECRET;
  const provided = req.headers.get("x-sync-secret") ?? url.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  const profileId = url.searchParams.get("profile") ?? "";
  let title = "Airtable sync complete";
  let body = "";
  try {
    body = describeSyncSummary(await syncAirtableToPortal());
  } catch (error) {
    title = "Airtable sync failed";
    body = error instanceof Error ? error.message : String(error);
  }

  // Let the admin who triggered it know the outcome, in-portal.
  const admin = createAdminClient();
  if (admin && profileId) {
    await admin.from("notifications").insert({
      profile_id: profileId,
      title,
      body,
      link: "/portal/admin/registrations",
    });
  }

  return new Response(JSON.stringify({ title, body }), {
    headers: { "content-type": "application/json" },
  });
};

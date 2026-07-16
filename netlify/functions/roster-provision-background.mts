// Netlify Background Function: provisions each approved school's reps as student
// rows — one auth-user create per rep. Doing this inline in the approve action
// 504'd on a bulk approve, so the action triggers this instead. Netlify returns
// 202 at once and this runs for up to 15 minutes. Idempotent (ensureRoster
// reuses students by school + name). Guarded by SYNC_SECRET.
import { ensureRoster } from "@/lib/ensure-roster";
import { createAdminClient } from "@/supabase/admin";

export default async (req: Request) => {
  const url = new URL(req.url);
  const secret = process.env.SYNC_SECRET;
  const provided = req.headers.get("x-sync-secret") ?? url.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  let ids: string[] = [];
  try {
    const text = await req.text();
    if (text) ids = (JSON.parse(text).ids ?? []) as string[];
  } catch {
    // fall back to the query param below
  }
  if (ids.length === 0) {
    const q = url.searchParams.get("ids");
    if (q) ids = q.split(",");
  }
  ids = [...new Set(ids.filter(Boolean))];
  if (ids.length === 0) {
    return new Response(JSON.stringify({ ok: true, provisioned: 0 }));
  }

  const admin = createAdminClient();
  if (!admin) return new Response("supabase-not-configured", { status: 503 });

  const { data } = await admin
    .from("registrations")
    .select("id, school_id, edition_year, reps, status")
    .in("id", ids);
  const rows = (data ?? []) as {
    id: string;
    school_id: string | null;
    edition_year: number;
    reps: unknown;
    status: string;
  }[];

  let provisioned = 0;
  for (const r of rows) {
    if (r.status !== "verified") continue; // only approved schools get a roster
    await ensureRoster({ school_id: r.school_id, edition_year: r.edition_year, reps: r.reps });
    provisioned++;
  }

  return new Response(JSON.stringify({ ok: true, provisioned }), {
    headers: { "content-type": "application/json" },
  });
};

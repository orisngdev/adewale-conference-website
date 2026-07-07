import { NextResponse } from "next/server";
import { createAdminClient } from "@/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight DB-touching endpoint. A scheduled ping (Netlify function / GitHub
// Action) hits this every few days so the free-tier Supabase project doesn't
// auto-pause — internal pg_cron doesn't count as activity, an external request
// does. Also handy as a health check.
export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "supabase-not-configured" });
  }
  const { error } = await supabase.from("editions").select("year").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}

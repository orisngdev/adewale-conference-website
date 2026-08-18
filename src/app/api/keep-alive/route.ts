import { NextResponse } from "next/server";
import { createAdminClient } from "@/supabase/admin";
import { supabaseUrl } from "@/supabase/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight DB-touching endpoint. A scheduled ping (Netlify function / GitHub
// Action) hits this every few days so the free-tier Supabase project doesn't
// auto-pause — internal pg_cron doesn't count as activity, an external request
// does. Also handy as a health check.
export async function GET() {
  const startedAt = Date.now();

  try {
    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json(
        {
          ok: false,
          reason: "supabase-not-configured",
          checks: {
            url: Boolean(supabaseUrl),
            secretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
          },
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { count, error } = await supabase
      .from("editions")
      .select("year", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          reason: "supabase-query-failed",
          table: "editions",
          error: error.message,
          elapsedMs: Date.now() - startedAt,
        },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        table: "editions",
        count,
        elapsedMs: Date.now() - startedAt,
        ts: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reason: "keep-alive-failed",
        error: error instanceof Error ? error.message : "Unknown error",
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function HEAD() {
  const response = await GET();
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}

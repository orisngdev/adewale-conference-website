import { NextResponse } from "next/server";
import { syncAirtableToPortal } from "@/lib/airtable-sync";

export const runtime = "nodejs";

// Scheduled Airtable → portal sync. Same idempotent sync as the admin button,
// exposed for a cron caller (Netlify scheduled function, cron-job.org, …).
// Guarded by a shared secret — no session in a cron context.
async function handle(request: Request) {
  const secret = process.env.SYNC_SECRET;
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(request.url).searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncAirtableToPortal();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("Airtable sync failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 },
    );
  }
}

export { handle as GET, handle as POST };

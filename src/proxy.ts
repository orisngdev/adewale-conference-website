import { type NextRequest } from "next/server";
import { updateSession } from "@/supabase/middleware";

// Next.js 16 renamed the "middleware" convention to "proxy" (same behavior).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only run auth on the portal — public pages skip the Supabase round-trip.
  matcher: ["/portal/:path*"],
};

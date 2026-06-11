import { type NextRequest } from "next/server";
import { updateSession } from "@/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only run auth on the portal — public pages skip the Supabase round-trip.
  matcher: ["/portal/:path*"],
};

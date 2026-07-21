import { NextResponse } from "next/server";
import { createClient } from "@/supabase/server";

// Exchanges the magic-link code for a session, then forwards to the dashboard.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") || "/portal";
  const loginUrl = new URL("/portal/login", origin);
  loginUrl.searchParams.set("redirectTo", redirectTo);

  if (!code) {
    loginUrl.searchParams.set(
      "authError",
      "That email link is invalid or has expired. Request a fresh code to continue.",
    );
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    loginUrl.searchParams.set(
      "authError",
      "That email link is invalid or has expired. Request a fresh code to continue.",
    );
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}

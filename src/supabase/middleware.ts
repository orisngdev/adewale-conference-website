import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./env";

const PUBLIC_PORTAL_PATHS = [
  "/portal/login",
  "/portal/student-login",
  "/portal/auth",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Until Supabase is configured, leave every request untouched.
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getClaims() verifies the JWT locally (ES256 + module-cached JWKS) instead of a
  // ~500ms /auth/v1/user round-trip on every /portal request, and still refreshes
  // the session (getSession under the hood) so the auth cookies rotate.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;

  const path = request.nextUrl.pathname;
  const isPortal = path.startsWith("/portal");
  const isPublicPortal = PUBLIC_PORTAL_PATHS.some((p) => path.startsWith(p));

  if (isPortal && !isPublicPortal && !user) {
    // Preserve the full target (path + query, e.g. ?code=…) so the claim flow
    // returns the user to exactly where they were headed.
    const target = request.nextUrl.pathname + request.nextUrl.search;
    const url = request.nextUrl.clone();
    url.pathname = "/portal/login";
    url.search = "";
    url.searchParams.set("redirectTo", target);
    return NextResponse.redirect(url);
  }

  return response;
}

import "server-only";
import { cache } from "react";
import { createClient } from "@/supabase/server";

export type SessionUser = { id: string; email: string | null };

// Request-scoped memoization. Nested layouts + pages all call getSessionUser, but
// React `cache()` ensures it runs at most once per request.
//
// Uses `getClaims()` rather than `getUser()`: with the project's asymmetric (ES256)
// signing keys, getClaims verifies the JWT signature LOCALLY against the JWKS
// (cached module-globally across requests) — no /auth/v1/user round-trip. That
// turns a ~500ms network validation into a ~0ms local one on every layout/page.
// getClaims still refreshes the session via getSession() first, so cookie rotation
// (handled in middleware) is unaffected.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

export const getUserRole = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.role as string | undefined) ?? null;
});

export type AdminContext = { user: SessionUser };

// The single admin gate. Server code that BYPASSES RLS — service-role writes,
// the Airtable sync, cross-user reads — must call this, because RLS can't
// protect those paths. Returns the admin's session user, or null when the caller
// isn't a signed-in admin. (RLS-backed writes don't need it; the database is
// already the gate there.) Cached, so it's free to call more than once a request.
export const requireAdmin = cache(async (): Promise<AdminContext | null> => {
  const user = await getSessionUser();
  if (!user || (await getUserRole()) !== "admin") return null;
  return { user };
});

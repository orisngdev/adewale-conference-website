import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import {
  DEFAULT_EMPTY_PERMISSIONS,
  DEFAULT_SUPER_ADMIN_PERMISSIONS,
  type AdminPermissionsMap,
  type PermissionModule,
} from "@/supabase/types";
import { canManage as canManageMap, canView as canViewMap } from "@/lib/admin-permissions";

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

// ── Two-tier admin permissions (view vs. manage, per module) ──────────────────
// Every teammate invited to the console is role="admin" in the DB, so RLS's
// is_admin() gate treats them all the same. The finer view/manage split is a
// pure application-layer concern — enforced here (server actions + page gates)
// and mirrored in the UI. Backward-compatible: an admin with permissions=NULL,
// or admin_role="super_admin", gets full manage access to every module.
export const getAdminPermissions = cache(
  async (): Promise<AdminPermissionsMap> => {
    const user = await getSessionUser();
    if (!user) return DEFAULT_EMPTY_PERMISSIONS;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("role, admin_role, permissions")
      .eq("id", user.id)
      .maybeSingle();

    // Resilience for a code-before-migration deploy: if the admin_role/permissions
    // columns don't exist yet, this select errors. Rather than lock every admin
    // out of the console, fall back to the pre-permissions behaviour — a plain
    // admin gets full access. (Once the migration lands this branch never runs.)
    if (error) {
      return (await getUserRole()) === "admin"
        ? DEFAULT_SUPER_ADMIN_PERMISSIONS
        : DEFAULT_EMPTY_PERMISSIONS;
    }

    if (data?.role !== "admin") return DEFAULT_EMPTY_PERMISSIONS;
    if (!data.permissions || data.admin_role === "super_admin") {
      return DEFAULT_SUPER_ADMIN_PERMISSIONS;
    }
    // A partial/legacy map is filled in with "none" for any missing module.
    return { ...DEFAULT_EMPTY_PERMISSIONS, ...(data.permissions as AdminPermissionsMap) };
  },
);

/** At-least-view access to a module (view or manage). */
export async function canViewModule(module: PermissionModule): Promise<boolean> {
  return canViewMap(await getAdminPermissions(), module);
}

/** Full manage (write) access to a module. */
export async function canManageModule(module: PermissionModule): Promise<boolean> {
  return canManageMap(await getAdminPermissions(), module);
}

/**
 * Page gate: redirect to the admin overview unless the caller can at least view
 * `module`. Drop at the top of a module's page/layout so a "None" level blocks
 * direct URL access, not just the hidden nav link.
 */
export async function requireModuleView(module: PermissionModule): Promise<void> {
  if (!(await canViewModule(module))) redirect("/portal/admin");
}

/**
 * Server-action gate: returns the admin context only when the caller can manage
 * `module`, else null. Mirrors requireAdmin() but adds the manage check, so a
 * read-only admin's direct action invocation is rejected at the backend.
 */
export async function requireManage(
  module: PermissionModule,
): Promise<AdminContext | null> {
  const admin = await requireAdmin();
  if (!admin) return null;
  if (!(await canManageModule(module))) return null;
  return admin;
}

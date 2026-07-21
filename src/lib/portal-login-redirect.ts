import { safePortalRedirect } from "./portal-redirect";

export type PortalRole = "admin" | "coordinator" | "student";

export function roleDashboardPath(role: string | null | undefined) {
  if (role === "admin") return "/portal/admin";
  if (role === "coordinator") return "/portal/school";
  return "/portal/student";
}

export function authenticatedLoginRedirect(
  user: { id: string } | null | undefined,
  redirectTo: string | string[] | null | undefined,
  role?: string | null,
) {
  if (!user) return null;
  const target = Array.isArray(redirectTo) ? redirectTo[0] : redirectTo;
  const safeTarget = safePortalRedirect(target, roleDashboardPath(role));
  return safeTarget === "/portal" ? roleDashboardPath(role) : safeTarget;
}

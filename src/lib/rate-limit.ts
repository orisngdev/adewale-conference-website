import "server-only";

// Minimal in-memory sliding-window rate limiter for public endpoints that now
// create accounts / send email (registration, onboarding). Best-effort: state is
// per server instance, which is fine as a first line of defence — a shared-store
// limiter (or a captcha, which needs provider keys) is the upgrade path noted in
// docs/registration-onboarding-plan.md.

const windows = new Map<string, number[]>();

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): boolean {
  const now = Date.now();
  const hits = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    windows.set(key, hits);
    return false;
  }
  hits.push(now);
  windows.set(key, hits);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (windows.size > 5000) {
    for (const [k, v] of windows) {
      if (v.every((t) => now - t >= windowMs)) windows.delete(k);
    }
  }
  return true;
}

/** Client IP from proxy headers (Netlify/Vercel set x-forwarded-for). */
export function requestIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

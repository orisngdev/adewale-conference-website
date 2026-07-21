const DEFAULT_BLOCKED_PREFIXES = ["/portal/auth", "/portal/login"];

export function safePortalRedirect(
  value: string | null | undefined,
  fallback = "/portal",
  blockedPrefixes = DEFAULT_BLOCKED_PREFIXES,
) {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(trimmed, "https://portal.local");
    if (url.origin !== "https://portal.local" || !url.pathname.startsWith("/portal")) {
      return fallback;
    }
    if (blockedPrefixes.some((prefix) => url.pathname.startsWith(prefix))) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

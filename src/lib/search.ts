export function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function searchTokens(query: unknown) {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

export function searchHaystackMatches(haystack: unknown[], query: unknown) {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;

  return haystack.some((value) => {
    const normalized = normalizeSearchText(value);
    return tokens.every((token) => normalized.includes(token));
  });
}

export function escapeLikePattern(value: string) {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}

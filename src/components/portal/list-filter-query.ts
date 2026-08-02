/** Query string from a filter form, dropping empty values and always resetting page. */
export function filterFormQuery(formData: FormData) {
  const search = new URLSearchParams();
  for (const [key, value] of formData.entries()) {
    if (key === "page" || typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    search.set(key, trimmed);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

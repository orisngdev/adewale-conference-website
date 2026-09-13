// Shared by paper-sheet matching, roster provisioning and the replacement flow.
// Import it; don't fork it — five divergent copies of school_norm_name are what
// turned 538 schools into 741 rows. No SQL counterpart: nothing indexes on it.

/** Diacritics folded, case and punctuation dropped, whitespace collapsed. */
export function normalizePersonName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Order-insensitive, so "BRIGHT, ADA" and "Ada Bright" agree — registration
 *  forms collect "Firstname Surname", result sheets come back "SURNAME, First". */
export function personNameKey(value: string): string {
  return normalizePersonName(value).split(" ").filter(Boolean).sort().join(" ");
}

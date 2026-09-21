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

const INSTRUCTION = /\b(change|replace|remove|swap|update|correct|delete|add|kindly|please|pls|instead)\b/i;

/**
 * Is this a name, or a message to whoever reads it? A coordinator asked for a
 * rep swap by typing "Change Akubo Faith to Lawal rodiat" into the educator's
 * name box; approving it overwrote the teacher's name, and the sentence then
 * printed on the school's answer-sheet packs.
 *
 * Deliberately narrow. Real entries in this data include "Mr&Mrs Oyewole
 * Olamide", "Talabi, O. A(Mr)" and "Adelabu Adekunle 3", so punctuation,
 * titles and digits all have to pass.
 *
 * @returns why it is not a name, or null if it is fine.
 */
export function personNameProblem(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 60) return "That looks too long for a name.";
  if (trimmed.split(/\s+/).length > 8) return "That looks too long for a name.";
  if (INSTRUCTION.test(trimmed)) {
    return "Enter the corrected name only, not an instruction. To swap a representative, use Replace on the Students page.";
  }
  return null;
}

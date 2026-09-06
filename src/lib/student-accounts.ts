// Code-login student accounts: a provisioned Rep has no address of their own,
// so provisioning mints a synthetic one and sets the access code AS the account
// password. Nothing re-syncs the two, so changing that password permanently
// breaks code sign-in — these accounts must never be offered a password form.

export const STUDENT_EMAIL_DOMAIN = "@students.adewaleconference.local";

export function studentAuthEmail(code: string): string {
  return `student.${code.toLowerCase()}${STUDENT_EMAIL_DOMAIN}`;
}

/** True when this account signs in with an access code, not a password. */
export function isCodeLoginEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  return normalized.endsWith(STUDENT_EMAIL_DOMAIN);
}

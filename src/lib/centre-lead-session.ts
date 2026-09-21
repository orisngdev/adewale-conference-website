import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The centre lead's session, as a signed cookie value rather than a session row.
 *
 * A lead has no auth user — they identify by an email an admin registered — so
 * none of Supabase's session machinery applies. The signature is what stops the
 * cookie being edited into another lead's id; everything else about the request
 * is re-derived and re-checked server-side on each use.
 */

export const CENTRE_LEAD_COOKIE = "asc_centre_lead";

/** Long enough to cover 6:30am setup through the last script being collected. */
export const CENTRE_LEAD_SESSION_HOURS = 16;

/** Domain separation. The secret behind this is FELLOWS_SHEET_SECRET, which is
 *  also a bearer token sent to the Fellows sheet webhook, so the cookie is
 *  signed with a key derived from it rather than with the token itself. */
function deriveKey(secret: string) {
  return createHmac("sha256", secret).update("centre-lead-session-v1").digest();
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", deriveKey(secret)).update(payload).digest("base64url");
}

export function signSession(leadId: string, expiresAtMs: number, secret: string): string {
  if (!secret) throw new Error("FELLOWS_SHEET_SECRET is not set");
  const payload = `${leadId}.${expiresAtMs}`;
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * The lead id a cookie carries, or null for anything that is not a live,
 * correctly-signed session. Never throws and never says which check failed — the
 * caller has one branch, "sign in again".
 */
export function readSession(
  value: string | undefined | null,
  secret: string,
  now: number = Date.now(),
): string | null {
  if (!value || !secret) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [leadId, expiresAt, signature] = parts;

  const expected = sign(`${leadId}.${expiresAt}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which is itself an answer.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now) return null;
  return leadId || null;
}

export function sessionExpiry(now: number = Date.now()): number {
  return now + CENTRE_LEAD_SESSION_HOURS * 60 * 60 * 1000;
}

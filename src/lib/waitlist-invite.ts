import type { SupabaseClient } from "@supabase/supabase-js";

// A single-use pass that lets ONE school register while registration is closed.
// The /register page and /api/registration both validate through here, so
// "is this token good?" has one answer. Service-role reads only.

/** Offered expiries — the admin picks one per school. */
export const INVITE_TOKEN_DAY_OPTIONS = [3, 7, 14, 30, 60, 90] as const;
export const INVITE_TOKEN_DAYS = 30;

/** Unknown values fall back to the default rather than minting an open-ended pass. */
export function resolveInviteDays(value: unknown) {
  const days = Number(value);
  return (INVITE_TOKEN_DAY_OPTIONS as readonly number[]).includes(days)
    ? days
    : INVITE_TOKEN_DAYS;
}

/** Why a token isn't usable — drives the copy on /register. */
export type InviteRejection = "missing" | "unknown" | "expired" | "used";

export interface WaitlistInvite {
  id: string;
  school_name: string;
  lga: string | null;
  category: string | null;
  contact_name: string;
  contact_email: string;
  phone: string | null;
  invited_edition_year: number | null;
  invite_token_expires_at: string | null;
  converted_at: string | null;
  registration_id: string | null;
}

const INVITE_COLUMNS =
  "id, school_name, lga, category, contact_name, contact_email, phone, invited_edition_year, invite_token_expires_at, converted_at, registration_id";

export type InviteLookup =
  | { ok: true; invite: WaitlistInvite }
  | { ok: false; reason: InviteRejection };

/** Rejections are distinguished so the page can explain itself; callers gating a
 * mutation should treat every `ok: false` the same. */
export async function lookupWaitlistInvite(
  db: SupabaseClient,
  token: string | null | undefined,
): Promise<InviteLookup> {
  const trimmed = typeof token === "string" ? token.trim() : "";
  if (!trimmed) return { ok: false, reason: "missing" };

  const { data } = await db
    .from("waitlist")
    .select(INVITE_COLUMNS)
    .eq("invite_token", trimmed)
    .maybeSingle();

  if (!data) return { ok: false, reason: "unknown" };
  const invite = data as WaitlistInvite;

  // "Already registered" beats "expired" when both apply.
  if (invite.converted_at) return { ok: false, reason: "used" };
  if (
    !invite.invite_token_expires_at ||
    new Date(invite.invite_token_expires_at).getTime() <= Date.now()
  ) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, invite };
}

/** Burn the pass and record what it produced. Only after the mirror succeeded —
 * burning on a failure would strand the school with a dead link. */
export async function markInviteConverted(
  db: SupabaseClient,
  inviteId: string,
  registrationId: string,
) {
  const { error } = await db
    .from("waitlist")
    .update({
      converted_at: new Date().toISOString(),
      registration_id: registrationId,
      invite_token: null,
      invite_token_expires_at: null,
    })
    .eq("id", inviteId);
  if (error) {
    // Non-fatal: the registration exists. An un-burned token stays live until it
    // expires, and the duplicate-school guard stops it being used twice.
    console.error("waitlist invite conversion stamp failed:", error.message);
  }
}

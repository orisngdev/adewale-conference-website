"use server";

import { createAdminClient } from "@/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

// Completes a team invitation from the emailed single-use link: the invitee
// sets their password and the admin account is created pre-verified (clicking
// the link proves address ownership — same pattern as coordinator onboarding).
// The handle_new_user trigger consumes the pending invite and assigns the role.

export type TeamInviteState =
  | { ok: true; email: string }
  | { ok: false; error: string }
  | null;

export async function completeTeamInvite(
  _prev: TeamInviteState,
  formData: FormData,
): Promise<TeamInviteState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { ok: false, error: "This invitation link is invalid." };
  if (password.length < 8)
    return { ok: false, error: "Choose a password of at least 8 characters." };
  if (password !== confirm)
    return { ok: false, error: "The passwords don't match." };

  // The 256-bit token is the real guard; this just caps mistake/abuse loops.
  if (!rateLimit(`team-invite:${token}`, { limit: 10, windowMs: 60_000 * 10 })) {
    return { ok: false, error: "Too many attempts — wait a few minutes and try again." };
  }

  const admin = createAdminClient();
  if (!admin)
    return { ok: false, error: "Invitations aren't configured on the server." };

  const { data: invite } = await admin
    .from("team_invites")
    .select("id, email, role, accepted_at, expires_at")
    .eq("verify_token", token)
    .maybeSingle();
  if (!invite)
    return { ok: false, error: "This invitation link is invalid or has already been used." };
  if (invite.accepted_at)
    return { ok: false, error: "This invitation was already accepted — sign in instead." };
  if (invite.expires_at && new Date(invite.expires_at) < new Date())
    return {
      ok: false,
      error: "This invitation has expired — ask the team to resend it.",
    };

  const email = (invite.email as string).toLowerCase();

  // Create the account confirmed. The signup trigger sees the pending invite
  // and assigns the invited role + marks it accepted.
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr) {
    const exists =
      createErr.code === "email_exists" ||
      /already.*(registered|exists)/i.test(createErr.message ?? "");
    if (!exists) {
      console.error("completeTeamInvite: createUser failed:", createErr.message);
      return { ok: false, error: "Could not create your account — try again." };
    }
    // The email already has an account (their password is untouched): just make
    // sure it has the invited role, and record the acceptance.
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("email", email)
      .maybeSingle();
    if (!profile)
      return { ok: false, error: "This email already has an account — sign in with it instead." };
    if (profile.role !== invite.role) {
      await admin.from("profiles").update({ role: invite.role }).eq("id", profile.id);
    }
    await admin
      .from("team_invites")
      .update({
        verify_token: null,
        accepted_at: new Date().toISOString(),
        accepted_by: profile.id,
      })
      .eq("id", invite.id);
    return { ok: false, error: "This email already has an account — sign in with your existing password; admin access is now active." };
  }

  // Burn the token (single-use). The trigger already stamped accepted_at/-by.
  await admin.from("team_invites").update({ verify_token: null }).eq("id", invite.id);

  return { ok: true, email };
}

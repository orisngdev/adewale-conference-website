"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import {
  buildAcceptedEmail,
  buildActivationEmail,
  buildDeclinedEmail,
  buildTeamInviteEmail,
  sendEmailSafely,
} from "@/lib/email";
import type { RegistrationStatus, UserRole } from "@/supabase/types";

const STATUSES: RegistrationStatus[] = [
  "submitted",
  "verified",
  "qualified",
  "finalist",
  "declined",
];

// ── Team invitations ─────────────────────────────────────────────────────────
// An admin invites a teammate (always as an admin — educators and students have
// their own onboarding flows). If the email already has a profile we promote it
// on the spot; otherwise we store a pending invite (consumed by the signup
// trigger when they create an account with that email) and send the invitation
// email. No token flow — email ownership is proven by Supabase auth.
export async function inviteTeamMember(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role: UserRole = "admin";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) return;

  // Already signed up? Promote directly instead of inviting.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role")
    .ilike("email", email)
    .maybeSingle();
  if (existing) {
    if (existing.id !== user.id && existing.role !== role) {
      // RLS (profiles_admin_update with is_admin()) restricts this to admins.
      await supabase.from("profiles").update({ role }).eq("id", existing.id);
      await supabase.from("notifications").insert({
        profile_id: existing.id,
        title: "You've been added to the team",
        body: `Your portal access was upgraded to ${role}.`,
        link: "/portal",
      });
    }
    revalidatePath("/portal/admin/settings");
    revalidatePath("/portal/admin/users");
    return;
  }

  // RLS (team_invites_admin_all with is_admin()) restricts this to admins.
  // Refresh any pending invite for the same email (new role, new 30-day window).
  const { data: pending } = await supabase
    .from("team_invites")
    .select("id")
    .ilike("email", email)
    .is("accepted_at", null)
    .maybeSingle();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = pending
    ? await supabase
        .from("team_invites")
        .update({ role, invited_by: user.id, expires_at: expires })
        .eq("id", pending.id)
    : await supabase
        .from("team_invites")
        .insert({ email, role, invited_by: user.id, expires_at: expires });
  if (error) return;

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  await sendEmailSafely(
    buildTeamInviteEmail({
      email,
      role,
      invitedBy: me?.full_name ?? me?.email ?? "The ASC team",
    }),
  );
  revalidatePath("/portal/admin/settings");
}

export async function revokeTeamInvite(inviteId: string) {
  const supabase = await createClient();
  // RLS (team_invites_admin_all) restricts this to admins.
  await supabase.from("team_invites").delete().eq("id", inviteId).is("accepted_at", null);
  revalidatePath("/portal/admin/settings");
}

export async function setRegistrationStatus(
  registrationId: string,
  formData: FormData,
) {
  const status = String(formData.get("status") ?? "");
  if (!STATUSES.includes(status as RegistrationStatus)) return;

  const supabase = await createClient();
  // RLS (reg_owner_update with is_admin()) restricts this to admins.
  await supabase
    .from("registrations")
    .update({ status })
    .eq("id", registrationId);
  revalidatePath("/portal/admin");
}

// ── Close-of-registration review: bulk approve / decline ─────────────────────
// Competition selection, not an access gate — schools keep portal/prep access
// either way. Approve → verified + the official guidelines email; Decline →
// declined + a polite email. Idempotent: rows already in the target state (or,
// for approve, already past it) are skipped, so re-running never re-sends.
export async function bulkRegistrationDecision(formData: FormData) {
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "approve" && decision !== "decline") return;
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return;

  const supabase = await createClient();
  // RLS (reg_owner_update with is_admin()) restricts the writes to admins.
  const { data } = await supabase
    .from("registrations")
    .select("id, status, edition_year, contact_email, contact_name, owner_id, schools(name)")
    .in("id", ids);
  const rows = (data ?? []) as unknown as {
    id: string;
    status: RegistrationStatus;
    edition_year: number;
    contact_email: string | null;
    contact_name: string | null;
    owner_id: string | null;
    schools: { name: string | null } | null;
  }[];

  for (const row of rows) {
    const skip =
      decision === "approve"
        ? row.status !== "submitted" // already reviewed (or further along)
        : row.status === "declined";
    if (skip) continue;

    const status: RegistrationStatus = decision === "approve" ? "verified" : "declined";
    const { error } = await supabase
      .from("registrations")
      .update({ status })
      .eq("id", row.id);
    if (error) continue;

    const schoolName = row.schools?.name ?? "Your school";
    if (row.contact_email) {
      await sendEmailSafely(
        decision === "approve"
          ? buildAcceptedEmail({
              email: row.contact_email,
              name: row.contact_name,
              schoolFullName: schoolName,
              editionYear: row.edition_year,
            })
          : buildDeclinedEmail({
              email: row.contact_email,
              name: row.contact_name,
              schoolFullName: schoolName,
              editionYear: row.edition_year,
            }),
      );
    }
    if (row.owner_id) {
      await supabase.from("notifications").insert({
        profile_id: row.owner_id,
        title: decision === "approve" ? "Entry confirmed" : "Entry update",
        body:
          decision === "approve"
            ? `${schoolName} is confirmed for the ${row.edition_year} competition — guidelines are in your email.`
            : `${schoolName} wasn't selected for the ${row.edition_year} competition. Portal access stays open.`,
        link: "/portal/school",
      });
    }
  }

  revalidatePath("/portal/admin/registrations");
  revalidatePath("/portal/admin");
}

// ── Resend / change-email for the activation link ────────────────────────────
// Regenerates the 30-day token (updating the contact email first if the admin
// corrected it) and re-sends the branded activation email. Only for
// not-yet-onboarded registrations.
export async function resendActivation(registrationId: string, formData: FormData) {
  const newEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return;

  const supabase = await createClient();
  const { data: reg } = await supabase
    .from("registrations")
    .select("id, owner_id, onboarded_at, contact_name, claim_code, schools(name)")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg || reg.owner_id || reg.onboarded_at) return;

  const verifyToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  // RLS restricts this update to admins.
  const { error } = await supabase
    .from("registrations")
    .update({
      contact_email: newEmail,
      verify_token: verifyToken,
      verify_token_expires_at: expires,
    })
    .eq("id", registrationId);
  if (error) return;

  await sendEmailSafely(
    buildActivationEmail({
      email: newEmail,
      name: (reg.contact_name as string | null) ?? null,
      schoolFullName:
        ((reg.schools as unknown as { name: string | null } | null)?.name) ?? "your school",
      verifyToken,
      claimCode: (reg.claim_code as string | null) ?? null,
    }),
  );
  revalidatePath("/portal/admin/registrations");
}

export async function issueCertificate(
  registrationId: string,
  formData: FormData,
) {
  const type = String(formData.get("type") ?? "").trim();
  const assetUrl = String(formData.get("asset_url") ?? "").trim();
  if (!type) return;

  const supabase = await createClient();
  // RLS (cert_admin_write) restricts inserts to admins.
  await supabase.from("certificates").insert({
    registration_id: registrationId,
    type,
    asset_url: assetUrl || null,
  });

  // Notify the registration owner.
  const { data: reg } = await supabase
    .from("registrations")
    .select("owner_id")
    .eq("id", registrationId)
    .maybeSingle();
  const owner = (reg?.owner_id as string | null) ?? null;
  if (owner) {
    await supabase.from("notifications").insert({
      profile_id: owner,
      title: "Certificate issued",
      body: `A "${type}" certificate is now available to download.`,
      link: "/portal",
    });
  }
  revalidatePath("/portal/admin");
  revalidatePath("/portal/admin/registrations");
}

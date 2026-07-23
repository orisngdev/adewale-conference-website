"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { requireManage } from "@/supabase/auth";
import {
  buildActivationEmail,
  buildTeamInviteEmail,
  buildWaitlistOpenEmail,
  sendEmailSafely,
} from "@/lib/email";
import { notifySchool, notifySchoolDecision } from "@/lib/school-notify";
import { ensureRoster } from "@/lib/ensure-roster";
import type { RegistrationStatus, UserRole } from "@/supabase/types";
import { permissionsFromForm } from "@/lib/admin-permissions";
import { describeSyncSummary, syncAirtableToPortal } from "@/lib/airtable-sync";

const STATUSES: RegistrationStatus[] = ["submitted", "verified", "declined"];

// Provision each approved school's reps as student rows. Each rep is an
// auth-user create, so a large bulk approve can run long. Runs inline on Vercel
// for now — idempotent (ensureRoster reuses students by school + name), and the
// per-school "Sync roster" button on the Participants hub is the manual backstop
// if a very large batch ever exceeds the function budget.
async function triggerRosterProvision(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("registrations")
    .select("school_id, edition_year, reps")
    .in("id", unique);
  for (const r of (data ?? []) as {
    school_id: string | null;
    edition_year: number;
    reps: unknown;
  }[]) {
    await ensureRoster({ school_id: r.school_id, edition_year: r.edition_year, reps: r.reps });
  }
}

// ── Team invitations ─────────────────────────────────────────────────────────
// An admin invites a teammate (always as an admin — educators and students have
// their own onboarding flows). If the email already has a profile we promote it
// on the spot; otherwise we store a pending invite with a single-use 256-bit
// token and email a link to /portal/team-invite where the invitee sets their
// password — the account is created pre-verified. The signup trigger remains a
// fallback (signing up normally with the invited email still grants the role).
export async function inviteTeamMember(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role: UserRole = "admin";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

  // Only a teammate who can MANAGE the team may add admins or set their access.
  const admin = await requireManage("team");
  if (!admin) return;
  const user = admin.user;
  const supabase = await createClient();

  // The invite carries an access profile (preset or custom per-module levels);
  // the handle_new_user trigger copies admin_role + permissions onto the account.
  const { adminRole, permissions } = permissionsFromForm(formData);

  // Already signed up? Promote directly (and apply the chosen access) instead of inviting.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role")
    .ilike("email", email)
    .maybeSingle();
  if (existing) {
    if (existing.id !== user.id) {
      // RLS (profiles_admin_update with is_admin()) restricts this to admins.
      await supabase
        .from("profiles")
        .update({ role, admin_role: adminRole, permissions })
        .eq("id", existing.id);
      if (existing.role !== role) {
        await supabase.from("notifications").insert({
          profile_id: existing.id,
          title: "You've been added to the team",
          body: `Your portal access was upgraded to ${role}.`,
          link: "/portal",
        });
      }
    }
    revalidatePath("/portal/admin/settings");
    revalidatePath("/portal/admin/users");
    return;
  }

  // RLS (team_invites_admin_all with is_admin()) restricts this to admins.
  // Refresh any pending invite for the same email (fresh token, new 30-day window).
  const { data: pending } = await supabase
    .from("team_invites")
    .select("id")
    .ilike("email", email)
    .is("accepted_at", null)
    .maybeSingle();
  const verifyToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const invitePayload = {
    role,
    admin_role: adminRole,
    permissions,
    invited_by: user.id,
    expires_at: expires,
    verify_token: verifyToken,
  };
  const { error } = pending
    ? await supabase.from("team_invites").update(invitePayload).eq("id", pending.id)
    : await supabase.from("team_invites").insert({ email, ...invitePayload });
  if (error) return;

  await sendEmailSafely(
    buildTeamInviteEmail({
      email,
      invitedBy: await inviterName(user.id),
      verifyToken,
    }),
  );
  revalidatePath("/portal/admin/settings");
}

// Regenerates the token (fresh 30-day window) and re-sends the invitation email.
export async function resendTeamInvite(inviteId: string) {
  const admin = await requireManage("team");
  if (!admin) return;
  const supabase = await createClient();
  const user = admin.user;

  const { data: invite } = await supabase
    .from("team_invites")
    .select("id, email")
    .eq("id", inviteId)
    .is("accepted_at", null)
    .maybeSingle();
  if (!invite) return;

  const verifyToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  // RLS (team_invites_admin_all) restricts this to admins.
  const { error } = await supabase
    .from("team_invites")
    .update({ verify_token: verifyToken, expires_at: expires, invited_by: user.id })
    .eq("id", invite.id);
  if (error) return;

  await sendEmailSafely(
    buildTeamInviteEmail({
      email: invite.email,
      invitedBy: await inviterName(user.id),
      verifyToken,
    }),
  );
  revalidatePath("/portal/admin/settings");
}

async function inviterName(userId: string) {
  const supabase = await createClient();
  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  return me?.full_name ?? me?.email ?? "The ASC team";
}

export async function revokeTeamInvite(inviteId: string) {
  if (!(await requireManage("team"))) return;
  const supabase = await createClient();
  // RLS (team_invites_admin_all) restricts this to admins.
  await supabase.from("team_invites").delete().eq("id", inviteId).is("accepted_at", null);
  revalidatePath("/portal/admin/settings");
}

// Update an existing admin's access profile (preset or custom per-module levels).
// Team-manage only; you can't demote your own access (avoids self-lockout).
export async function updateTeamMemberPermissions(profileId: string, formData: FormData) {
  const admin = await requireManage("team");
  if (!admin) return;
  if (!profileId || profileId === admin.user.id) return;

  const { adminRole, permissions } = permissionsFromForm(formData);
  const supabase = await createClient();
  // RLS (profiles_admin_update with is_admin()) restricts this to admins.
  const { error } = await supabase
    .from("profiles")
    .update({ admin_role: adminRole, permissions })
    .eq("id", profileId)
    .eq("role", "admin");
  if (error) return;

  await supabase.from("notifications").insert({
    profile_id: profileId,
    title: "Your admin access was updated",
    body: "A team manager changed the sections you can see and manage.",
    link: "/portal/admin",
  });
  revalidatePath("/portal/admin/settings");
}

// ── Waitlist ─────────────────────────────────────────────────────────────────
// Emails every un-notified waitlist entry that registration is open, then
// stamps notified_at so re-running never double-sends. Uses the session client,
// so RLS (waitlist is admin-only) is the permission gate.
export async function inviteWaitlist() {
  const admin = await requireManage("registrations");
  if (!admin) return;
  const user = admin.user;
  const supabase = await createClient();

  const { data: openEdition } = await supabase
    .from("editions")
    .select("year")
    .eq("registration_open", true)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();

  let title = "Waitlist invited";
  let body: string;
  if (!openEdition) {
    title = "Waitlist not invited";
    body = "Open registration for an edition first (Editions page), then invite the waitlist.";
  } else {
    const { data: entries } = await supabase
      .from("waitlist")
      .select("id, school_name, contact_name, contact_email")
      .is("notified_at", null);
    const rows = entries ?? [];
    for (const entry of rows) {
      await sendEmailSafely(
        buildWaitlistOpenEmail({
          email: entry.contact_email,
          name: entry.contact_name,
          schoolName: entry.school_name,
          editionYear: openEdition.year as number,
        }),
      );
    }
    if (rows.length > 0) {
      await supabase
        .from("waitlist")
        .update({ notified_at: new Date().toISOString() })
        .in("id", rows.map((r) => r.id));
    }
    body = rows.length
      ? `${rows.length} school${rows.length === 1 ? "" : "s"} emailed the ASC ${openEdition.year} registration link.`
      : "Every waitlist entry has already been notified.";
  }

  await supabase.from("notifications").insert({
    profile_id: user.id,
    title,
    body,
    link: "/portal/admin/waitlist",
  });
  revalidatePath("/portal/admin/waitlist");
}

// ── Airtable sync ────────────────────────────────────────────────────────────
// Pulls every school + registration from Airtable (source of truth) into the
// portal mirror — idempotent, sends no email. The sync runs with the service
// role (RLS can't gate it), so the caller's admin role is checked explicitly.
// The outcome lands as a notification for the acting admin.
export async function syncAirtableRegistrations() {
  const admin = await requireManage("registrations");
  if (!admin) return;
  const supabase = await createClient();

  // Runs inline on Vercel for now. A very large manual pull can approach the
  // function budget, but the scheduled GitHub Action (.github/workflows/
  // sync-airtable.yml) runs the same idempotent sync directly against Supabase
  // every 6 hours, so anything a manual run doesn't finish is picked up out of
  // band. The outcome lands as a notification for the admin who triggered it.
  let title = "Airtable sync complete";
  let body: string;
  try {
    body = describeSyncSummary(await syncAirtableToPortal());
  } catch (error) {
    title = "Airtable sync failed";
    body = error instanceof Error ? error.message : String(error);
  }
  await supabase.from("notifications").insert({
    profile_id: admin.user.id,
    title,
    body,
    link: "/portal/admin/registrations",
  });
  revalidatePath("/portal/admin/registrations");
}

export async function setRegistrationStatus(
  registrationId: string,
  formData: FormData,
) {
  if (!(await requireManage("registrations"))) return;
  const status = String(formData.get("status") ?? "");
  if (!STATUSES.includes(status as RegistrationStatus)) return;

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("registrations")
    .select("status, edition_year, contact_email, contact_name, owner_id, school_id, reps, schools(name)")
    .eq("id", registrationId)
    .maybeSingle();

  // RLS (reg_owner_update with is_admin()) restricts this to admins.
  const { error } = await supabase
    .from("registrations")
    .update({ status })
    .eq("id", registrationId);

  // First transition into verified materialises the roster (same as bulk
  // approve), off-request so the action returns fast. Idempotent.
  if (!error && status === "verified" && before && before.status !== "verified") {
    await triggerRosterProvision([registrationId]);
  }

  // Same emails as the bulk review, but only on an actual TRANSITION into
  // verified/declined — re-saving the same status never re-sends.
  const notify =
    !error &&
    before &&
    before.status !== status &&
    (status === "verified" || status === "declined");
  if (notify) {
    const schoolName =
      ((before.schools as unknown as { name: string | null } | null)?.name) ?? "Your school";
    // One audience → email + in-portal notification for every educator, not just
    // the owner.
    await notifySchoolDecision(supabase, {
      schoolId: (before.school_id as string | null) ?? null,
      schoolName,
      editionYear: before.edition_year,
      decision: status === "verified" ? "approve" : "decline",
      ownerId: before.owner_id,
      fallbackEmail: before.contact_email,
      fallbackName: before.contact_name,
    });
  }
  revalidatePath("/portal/admin");
  revalidatePath("/portal/admin/registrations");
}

// ── Close-of-registration review: bulk approve / decline ─────────────────────
// Competition selection, not an access gate — schools keep portal/prep access
// either way. Approve → verified + the official guidelines email; Decline →
// declined + a polite email. Idempotent: rows already in the target state (or,
// for approve, already past it) are skipped, so re-running never re-sends.
export async function bulkRegistrationDecision(formData: FormData) {
  const decision = String(formData.get("decision") ?? "");
  // Deduped because "select all matching" injects hidden ids that can overlap
  // the ticked page rows — the DB fetch would collapse them anyway, but keep
  // the notification loop honest.
  const ids = [...new Set(formData.getAll("ids").map(String).filter(Boolean))];
  if (ids.length === 0) return;

  // Stage marking (advance / not-advanced at a chosen stage) shares this
  // selection form but is a different flow from acceptance (approve / decline) —
  // and belongs to the Participants module, so it's gated separately.
  if (decision === "advance" || decision === "eliminate") {
    if (!(await requireManage("participants"))) return;
    await bulkStageOutcome(
      ids,
      decision === "advance" ? "advanced" : "eliminated",
      String(formData.get("stage") ?? "").trim(),
    );
    return;
  }

  if (decision !== "approve" && decision !== "decline") return;
  if (!(await requireManage("registrations"))) return;

  const supabase = await createClient();
  // RLS (reg_owner_update with is_admin()) restricts the writes to admins.
  const { data } = await supabase
    .from("registrations")
    .select("id, status, edition_year, contact_email, contact_name, owner_id, school_id, reps, schools(name)")
    .in("id", ids);
  const rows = (data ?? []) as unknown as {
    id: string;
    status: RegistrationStatus;
    edition_year: number;
    contact_email: string | null;
    contact_name: string | null;
    owner_id: string | null;
    school_id: string | null;
    reps: unknown;
    schools: { name: string | null } | null;
  }[];

  const approvedIds: string[] = [];
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

    // Roster provisioning (one auth user per rep) is deferred to a background
    // function after the loop — doing it inline here 504'd a bulk approve.
    if (decision === "approve") approvedIds.push(row.id);

    const schoolName = row.schools?.name ?? "Your school";
    // Every educator (teacher + principal + any approved member) gets both the
    // email and the in-portal notification — same audience, both channels.
    await notifySchoolDecision(supabase, {
      schoolId: row.school_id,
      schoolName,
      editionYear: row.edition_year,
      decision,
      ownerId: row.owner_id,
      fallbackEmail: row.contact_email,
      fallbackName: row.contact_name,
    });
  }

  await triggerRosterProvision(approvedIds);

  revalidatePath("/portal/admin/registrations");
  revalidatePath("/portal/admin");
}

// ── Per-stage results: mark selected schools advanced / not-advanced ─────────
// The edition moves everyone through one shared stage; this records how each
// school fared at a given stage so a school can advance at the Zonal Stage yet
// not at the Grand Finale. Upsert keyed on (registration_id, stage), so
// re-marking corrects rather than duplicates. Notifies each owner.
async function bulkStageOutcome(
  ids: string[],
  outcome: "advanced" | "eliminated",
  stage: string,
) {
  if (!stage || ids.length === 0) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("registrations")
    .select("id, edition_year, owner_id, school_id, schools(name)")
    .in("id", ids);
  const rows = (data ?? []) as unknown as {
    id: string;
    edition_year: number;
    owner_id: string | null;
    school_id: string | null;
    schools: { name: string | null } | null;
  }[];
  if (rows.length === 0) return;

  const now = new Date().toISOString();
  // RLS (stage_results_admin_write) restricts the upsert to admins.
  const { error } = await supabase.from("registration_stage_results").upsert(
    rows.map((r) => ({
      registration_id: r.id,
      stage,
      outcome,
      updated_at: now,
    })),
    { onConflict: "registration_id,stage" },
  );
  if (!error) {
    for (const r of rows) {
      const schoolName = r.schools?.name ?? "Your school";
      // Notify every educator on the school, not just the owner.
      await notifySchool(supabase, r.school_id, r.owner_id, {
        title: outcome === "advanced" ? `Advanced past ${stage}` : `${stage} result`,
        body:
          outcome === "advanced"
            ? `${schoolName} advanced past the ${stage} in the ${r.edition_year} competition.`
            : `${schoolName} did not advance past the ${stage} in the ${r.edition_year} competition. The prep portal stays open.`,
        link: "/portal/school",
      });
    }
  }

  revalidatePath("/portal/admin/participants");
  revalidatePath("/portal/admin");
  revalidatePath("/portal/school");
  revalidatePath("/portal");
}

// ── Resend / change-email for the activation link ────────────────────────────
// Regenerates the 30-day token (updating the contact email first if the admin
// corrected it) and re-sends the branded activation email. Only for
// not-yet-onboarded registrations.
export async function resendActivation(registrationId: string, formData: FormData) {
  if (!(await requireManage("registrations"))) return;
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

// Backfill the roster for an already-approved school — for schools verified
// before roster-at-approval existed, or after reps were edited. ensureRoster
// uses the service-role client (bypasses RLS), so gate explicitly on admin.
export async function syncRoster(registrationId: string) {
  if (!(await requireManage("participants"))) return;
  const supabase = await createClient();
  const { data: reg } = await supabase
    .from("registrations")
    .select("school_id, edition_year, reps, status")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg || reg.status !== "verified") return;
  await ensureRoster({
    school_id: (reg.school_id as string | null) ?? null,
    edition_year: reg.edition_year as number,
    reps: reg.reps,
  });
  revalidatePath("/portal/admin/participants");
}

// Issue a certificate from the participant hub. A blank student_id = a
// school-wide certificate (the original behaviour); a student_id = an
// individual rep's certificate. Notifies the coordinator either way.
export async function issueCertificate(
  registrationId: string,
  formData: FormData,
) {
  if (!(await requireManage("participants"))) return;
  const type = String(formData.get("type") ?? "").trim();
  const assetUrl = String(formData.get("asset_url") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "").trim() || null;
  if (!type) return;

  const supabase = await createClient();
  // RLS (cert_admin_write) restricts inserts to admins.
  await supabase.from("certificates").insert({
    registration_id: registrationId,
    student_id: studentId,
    type,
    asset_url: assetUrl || null,
  });

  // Name the student on a per-student cert so the coordinator's notice is clear.
  let who = "";
  if (studentId) {
    const { data: st } = await supabase
      .from("students")
      .select("name")
      .eq("id", studentId)
      .maybeSingle();
    who = st?.name ? ` for ${st.name}` : "";
  }
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
      body: `A "${type}" certificate${who} is now available to download.`,
      link: "/portal",
    });
  }
  revalidatePath("/portal/admin/participants");
  revalidatePath("/portal/student");
  revalidatePath("/portal/school");
}

// ── Participant hub: per-student advancement ────────────────────────────────
// Mirror of bulkStageOutcome, one level down. Records a single rep's outcome +
// optional score/note at a stage. RLS (student_stage_results_admin_write) limits
// the upsert to admins. No per-student notification (visible on dashboards) —
// coordinators are notified on the school-level milestones instead.
export async function advanceStudent(studentId: string, formData: FormData) {
  if (!(await requireManage("participants"))) return;
  const stage = String(formData.get("stage") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "");
  if (!stage || !["advanced", "eliminated", "pending"].includes(outcome)) return;
  const scoreRaw = String(formData.get("score") ?? "").trim();
  const scoreNum = scoreRaw === "" ? null : Number(scoreRaw);
  const note = String(formData.get("note") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("student_stage_results").upsert(
    {
      student_id: studentId,
      stage,
      outcome,
      score: scoreNum != null && !Number.isNaN(scoreNum) ? scoreNum : null,
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,stage" },
  );
  if (error) return;
  revalidatePath("/portal/admin/participants");
  revalidatePath("/portal/student");
  revalidatePath("/portal/school");
}

// ── Participant hub: cascade advancement ────────────────────────────────────
// "Advance school + all reps" (includeSchool=true) marks the school AND every
// active rep at a stage; "Advance all reps" (false) sweeps just the roster. The
// school-level upsert also drives resource-tier unlocks (see resource-access.ts).
// Both notify the school once. Individual overrides afterwards via advanceStudent.
async function cascadeAdvance(
  registrationId: string,
  stage: string,
  outcome: "advanced" | "eliminated",
  includeSchool: boolean,
) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: reg } = await supabase
    .from("registrations")
    .select("id, edition_year, owner_id, school_id, schools(name)")
    .eq("id", registrationId)
    .maybeSingle();
  const schoolId = (reg?.school_id as string | null) ?? null;
  if (!reg || !schoolId) return;

  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", schoolId)
    .is("deactivated_at", null);
  const studentIds = ((students ?? []) as { id: string }[]).map((s) => s.id);

  if (includeSchool) {
    await supabase.from("registration_stage_results").upsert(
      { registration_id: reg.id, stage, outcome, updated_at: now },
      { onConflict: "registration_id,stage" },
    );
  }
  if (studentIds.length) {
    await supabase.from("student_stage_results").upsert(
      studentIds.map((sid) => ({ student_id: sid, stage, outcome, updated_at: now })),
      { onConflict: "student_id,stage" },
    );
  }

  const schoolName =
    ((reg.schools as unknown as { name: string | null } | null)?.name) ?? "Your school";
  const past = outcome === "advanced" ? "advanced past" : "did not advance past";
  await notifySchool(supabase, schoolId, (reg.owner_id as string | null) ?? null, {
    title: outcome === "advanced" ? `Advanced past ${stage}` : `${stage} result`,
    body: includeSchool
      ? `${schoolName} and its reps ${past} the ${stage} in the ${reg.edition_year} competition.`
      : `The reps of ${schoolName} ${past} the ${stage} in the ${reg.edition_year} competition.`,
    link: "/portal/school",
  });

  revalidatePath("/portal/admin/participants");
  revalidatePath("/portal/school");
  revalidatePath("/portal/student");
  revalidatePath("/portal");
}

// Cascade advancement, driven by a single `op` from a confirming button:
//   advance-all / eliminate-all   → the school AND every rep
//   advance-reps / eliminate-reps → the reps only (school standing unchanged)
export async function cascadeAdvanceAction(registrationId: string, formData: FormData) {
  if (!(await requireManage("participants"))) return;
  const stage = String(formData.get("stage") ?? "").trim();
  const op = String(formData.get("op") ?? "");
  const outcome = op.startsWith("advance")
    ? "advanced"
    : op.startsWith("eliminate")
      ? "eliminated"
      : null;
  if (!stage || !outcome) return;
  await cascadeAdvance(registrationId, stage, outcome, op.endsWith("-all"));
}

// Undo an advancement — "bring a school back". Clears the school's (and its
// reps') stage results at `from_stage` and every stage after it, so the school
// returns to be re-decided at that stage. Fixes a mistaken advance without
// leaving stale downstream results. RLS (admin_write, for all) gates the deletes.
export async function sendSchoolBack(registrationId: string, formData: FormData) {
  if (!(await requireManage("participants"))) return;
  const fromStage = String(formData.get("from_stage") ?? "").trim();
  if (!fromStage) return;

  const supabase = await createClient();
  const { data: reg } = await supabase
    .from("registrations")
    .select("id, edition_year, school_id")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return;

  const { data: ed } = await supabase
    .from("editions")
    .select("stages")
    .eq("year", reg.edition_year)
    .maybeSingle();
  const stages = (ed?.stages as string[] | null) ?? [];
  const fromIdx = stages.indexOf(fromStage);
  if (fromIdx < 0) return;
  const toClear = stages.slice(fromIdx); // from_stage and everything after it

  await supabase
    .from("registration_stage_results")
    .delete()
    .eq("registration_id", registrationId)
    .in("stage", toClear);

  // Bring the reps back too (a no-op for stages they were never marked at).
  const schoolId = (reg.school_id as string | null) ?? null;
  if (schoolId) {
    const { data: sts } = await supabase
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .is("deactivated_at", null);
    const ids = ((sts ?? []) as { id: string }[]).map((s) => s.id);
    if (ids.length) {
      await supabase
        .from("student_stage_results")
        .delete()
        .in("student_id", ids)
        .in("stage", toClear);
    }
  }

  revalidatePath("/portal/admin/participants");
  revalidatePath("/portal/school");
  revalidatePath("/portal/student");
  revalidatePath("/portal");
}

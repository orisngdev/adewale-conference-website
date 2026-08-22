import { randomBytes } from "crypto";
import { createAdminClient } from "@/supabase/admin";
import {
  buildActivationEmail,
  buildAdminNewRegistrationEmail,
  sendEmailSafely,
} from "@/lib/email";
import { mapRegistrationFields, ZONAL_FINALS_OPTIONS, type RegistrationFormData } from "@/lib/forms";
import { repLabel } from "@/lib/age";
import { resolveSchool } from "@/lib/school-identity";
import { canView, resolveStoredPermissions } from "@/lib/admin-permissions";
import type { AdminPermissionsMap } from "@/supabase/types";

const EDITION_YEAR =
  Number(process.env.ASC_EDITION_YEAR) || new Date().getFullYear();

export interface MirrorRegistrationResult {
  /** Fallback for coordinators who sign up with a different email. */
  claimCode: string;
  /** Single-use, 30-day self-service onboarding link token. */
  verifyToken: string;
}

const VERIFY_TOKEN_DAYS = 30;

function makeClaimCode() {
  return randomBytes(6)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
}

// Mirrors a public registration into Supabase (thin copy; Airtable stays the
// source of truth). Returns the onboarding tokens, or null when the bridge is off.
export async function mirrorRegistrationToSupabase(
  input: RegistrationFormData,
  airtableSchoolId?: string | null,
  editionYear?: number,
): Promise<MirrorRegistrationResult | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;
  // The route resolves the OPEN edition and passes it; env is only a fallback.
  const edition = editionYear ?? EDITION_YEAR;

  // Find-or-create through the shared resolver, which normalizes the name exactly
  // as schools_norm_name_key does. This used to match on an exact name string plus
  // lga and category, which is one of the paths that fragmented this table: any
  // difference in spacing, punctuation or LGA minted a second row for one school.
  const resolved = await resolveSchool(supabase, {
    name: input.schoolFullName,
    lga: input.schoolLGA,
    category: input.schoolCategory,
    address: input.schoolAddress || null,
    email: input.schoolEmail || null,
    airtableId: airtableSchoolId ?? null,
  });
  const schoolId: string | null = resolved?.id ?? null;

  const repEntries = [
    { name: input.studentRep1FullName, level: input.studentRep1Class, dob: input.studentRep1DOB },
    { name: input.studentRep2FullName, level: input.studentRep2Class, dob: input.studentRep2DOB },
    { name: input.studentRep3FullName, level: input.studentRep3Class, dob: input.studentRep3DOB },
  ].filter((r) => r.name);
  // Stored reps stay name+level; DOB lives in `details`. The admin heads-up email
  // gets the richer "Name (Class, age N)" label computed from each DOB.
  const reps = repEntries.map((r) => ({ name: r.name, level: r.level }));

  // The coordinating teacher is the intended portal user.
  const contactEmail =
    input.teacherEmail || input.principalEmail || input.schoolEmail || null;

  const claimCode = makeClaimCode();
  // Self-service onboarding token (256-bit, single-use): the confirmation email
  // carries a link that lets the coordinator set a password and activate — valid
  // for 30 days. Only ever read server-side with the service role.
  const verifyToken = randomBytes(32).toString("hex");
  const verifyExpires = new Date(
    Date.now() + VERIFY_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error: regError } = await supabase.from("registrations").insert({
    school_id: schoolId,
    owner_id: null,
    edition_year: edition,
    status: "submitted",
    reps,
    // Full entry (gender, DOB, guardians, principal + teacher contacts) keyed by
    // the same Airtable field names the sync uses, so the admin review sees rich
    // detail immediately — before the first Airtable sync refreshes it.
    details: mapRegistrationFields(input),
    // The school's own choice IS the allocation, unless an admin moves it. The
    // registration form validates this field against ZONAL_FINALS_OPTIONS, so it can
    // only ever be one of the eight real centres — which is what makes defaulting
    // safe here and unsafe for the LGA fallback that corrupted this column
    // historically. Re-checked rather than assumed, because the guarantee lives in
    // another file. An admin then only has to touch the exceptions.
    qualification_zone: (ZONAL_FINALS_OPTIONS as readonly string[]).includes(
      input.zonalFinalsLocation,
    )
      ? input.zonalFinalsLocation
      : null,
    contact_email: contactEmail,
    contact_name: input.teacherFullName || null,
    claim_code: claimCode,
    verify_token: verifyToken,
    verify_token_expires_at: verifyExpires,
  });
  // Fail loudly — a silent failure here is what produced orphaned claim codes.
  if (regError) {
    throw new Error(`registration mirror insert failed: ${regError.message}`);
  }

  // Stage school memberships by email — the coordinating teacher AND the
  // principal are both educators for the school. Registration contacts are
  // trusted by definition (they submitted the entry), so both are approved
  // outright; the manual admin-approval queue is only for outsiders asking to
  // join a school they didn't register. Access activates when either email
  // signs in (my_school_ids matches by email, and handle_new_user grants the
  // coordinator role on a membership match).
  const teacherLower = contactEmail?.toLowerCase() ?? null;
  const principalLower = input.principalEmail?.toLowerCase() || null;
  const members = [
    teacherLower ? { email: teacherLower, full_name: input.teacherFullName || null } : null,
    principalLower && principalLower !== teacherLower
      ? { email: principalLower, full_name: input.principalFullName || null }
      : null,
  ].filter((m): m is { email: string; full_name: string | null } => !!m);

  if (schoolId && members.length > 0) {
    const { error: memberError } = await supabase.from("school_members").upsert(
      members.map((m) => ({
        school_id: schoolId,
        email: m.email,
        full_name: m.full_name,
        status: "approved",
      })),
      { onConflict: "school_id,email", ignoreDuplicates: true },
    );
    if (memberError) {
      console.error("school_members upsert failed:", memberError.message);
    }

    // The principal gets their OWN activation link (the registration token is the
    // teacher's). Minted via a targeted update so a re-registration refreshes the
    // token even when the membership row already existed; skipped once the
    // membership is linked to a live account or already activated.
    if (principalLower && principalLower !== teacherLower) {
      try {
        const memberToken = randomBytes(32).toString("hex");
        const { data: tokenRow } = await supabase
          .from("school_members")
          .update({
            verify_token: memberToken,
            verify_token_expires_at: verifyExpires,
          })
          .eq("school_id", schoolId)
          .eq("email", principalLower)
          .is("profile_id", null)
          .is("onboarded_at", null)
          .select("id")
          .maybeSingle();
        if (tokenRow) {
          await sendEmailSafely(
            buildActivationEmail({
              email: principalLower,
              name: input.principalFullName || null,
              schoolFullName: input.schoolFullName,
              verifyToken: memberToken,
            }),
          );
        }
      } catch (principalError) {
        console.error("principal activation send failed (non-fatal):", principalError);
      }
    }
  }

  // Heads-up to the conference team (awareness only — never a gate, never fatal):
  // an in-portal notification for every admin, plus an email to each admin who can
  // actually SEE registrations (no point paging someone with no registrations
  // access). Reps carry each student's age, computed from their DOB.
  try {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id, email, admin_role, permissions")
      .eq("role", "admin");
    const adminRows = (admins ?? []) as {
      id: string;
      email: string | null;
      admin_role: string | null;
      permissions: AdminPermissionsMap | null;
    }[];
    if (adminRows.length > 0) {
      await supabase.from("notifications").insert(
        adminRows.map((a) => ({
          profile_id: a.id,
          title: "New registration",
          body: `${input.schoolFullName} registered for the ${edition} edition.`,
          link: "/portal/admin/registrations",
        })),
      );
      const recipients = adminRows
        .filter((a) => a.email)
        .filter((a) => canView(resolveStoredPermissions(a.admin_role, a.permissions), "registrations"))
        .map((a) => ({ email: a.email as string }));
      if (recipients.length > 0) {
        await sendEmailSafely(
          buildAdminNewRegistrationEmail({
            recipients,
            schoolFullName: input.schoolFullName,
            schoolLGA: input.schoolLGA,
            teacherFullName: input.teacherFullName,
            contactEmail: contactEmail ?? "—",
            editionYear: edition,
            reps: repEntries.map((r) => repLabel(r.name, r.level, r.dob)).join(", "),
          }),
        );
      }
    }
  } catch (notifyError) {
    console.error("admin registration notify failed (non-fatal):", notifyError);
  }

  return { claimCode, verifyToken };
}

"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/supabase/admin";
import { buildActivationEmail, sendEmailSafely } from "@/lib/email";
import { provisionStudent } from "@/lib/provision-student";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import type { Rep } from "@/supabase/types";

// Completes self-service coordinator onboarding from the emailed 30-day link:
// sets their password (creating the auth user — the handle_new_user trigger then
// links the registration + coordinator role by contact_email), provisions the
// student roster (edition-tagged), and burns the token. Idempotent-ish: an
// already-used token or already-owned registration short-circuits gracefully.

export type OnboardState =
  | { ok: true; mode: "created" | "existing"; email: string }
  | { ok: false; error: string }
  | null;

const FALLBACK_EDITION = Number(process.env.ASC_EDITION_YEAR) || 2026;

export async function completeOnboarding(
  _prev: OnboardState,
  formData: FormData,
): Promise<OnboardState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { ok: false, error: "This activation link is invalid." };
  if (password.length < 8)
    return { ok: false, error: "Choose a password of at least 8 characters." };
  if (password !== confirm)
    return { ok: false, error: "The passwords don't match." };

  // The 256-bit token is the real guard; this just caps mistake/abuse loops.
  if (!rateLimit(`onboard:${token}`, { limit: 10, windowMs: 60_000 * 10 })) {
    return { ok: false, error: "Too many attempts — wait a few minutes and try again." };
  }

  const admin = createAdminClient();
  if (!admin)
    return { ok: false, error: "Onboarding isn't configured on the server." };

  const { data: reg } = await admin
    .from("registrations")
    .select(
      "id, school_id, edition_year, contact_email, contact_name, reps, owner_id, onboarded_at, verify_token_expires_at",
    )
    .eq("verify_token", token)
    .maybeSingle();

  // Not a registration (teacher) token — it may be a per-educator member token
  // (e.g. the principal's own activation link).
  if (!reg) return completeMemberOnboarding(admin, token, password);
  if (reg.verify_token_expires_at && new Date(reg.verify_token_expires_at) < new Date())
    return {
      ok: false,
      error: "This activation link has expired — contact the organisers for a new one.",
    };
  const email = (reg.contact_email as string | null)?.toLowerCase();
  if (!email)
    return { ok: false, error: "No coordinator email is on this registration — contact the organisers." };

  // Create the coordinator's account. Clicking the emailed link proves ownership
  // of the address, so the account is created confirmed. The handle_new_user
  // trigger links every unclaimed registration with this contact_email and sets
  // the coordinator role.
  let mode: "created" | "existing" = "created";
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: (reg.contact_name as string | null) ?? undefined },
  });

  if (createErr) {
    const exists =
      createErr.code === "email_exists" ||
      /already.*(registered|exists)/i.test(createErr.message ?? "");
    if (!exists) {
      console.error("completeOnboarding: createUser failed:", createErr.message);
      return { ok: false, error: "Could not create your account — try again." };
    }
    // The email already has an account (their password is untouched): link the
    // registration to it and make sure they're a coordinator.
    mode = "existing";
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("email", email)
      .maybeSingle();
    if (!profile)
      return { ok: false, error: "This email already has an account — sign in with it instead." };
    await admin
      .from("registrations")
      .update({ owner_id: profile.id })
      .eq("id", reg.id)
      .is("owner_id", null);
    if (profile.role === "student") {
      await admin.from("profiles").update({ role: "coordinator" }).eq("id", profile.id);
    }
  }

  // Provision the student roster (Phase 3): create-or-reuse each rep's login +
  // access code, stamped with the registration's edition.
  const reps = (Array.isArray(reg.reps) ? reg.reps : []) as Rep[];
  const editionYear = (reg.edition_year as number | null) ?? FALLBACK_EDITION;
  let provisioned = 0;
  if (reg.school_id) {
    for (const rep of reps) {
      if (!rep?.name) continue;
      const result = await provisionStudent(admin, {
        schoolId: reg.school_id as string,
        editionYear,
        name: rep.name,
        level: rep.level ?? null,
      });
      if (result.code) provisioned++;
      else console.error("completeOnboarding: provision failed:", result.error);
    }
  }

  // Burn the token (single-use) and record the outcome.
  await admin
    .from("registrations")
    .update({
      verify_token: null,
      verify_token_expires_at: null,
      onboarded_at: new Date().toISOString(),
      provisioned_count: provisioned,
    })
    .eq("id", reg.id);

  return { ok: true, mode, email };
}

// Per-educator activation (school_members token — the principal's link). Same
// contract as the teacher path: create-or-link the account, provision the
// school's roster (idempotent by name), burn the token.
async function completeMemberOnboarding(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  token: string,
  password: string,
): Promise<OnboardState> {
  const { data: member } = await admin
    .from("school_members")
    .select("id, school_id, email, full_name, profile_id, onboarded_at, verify_token_expires_at")
    .eq("verify_token", token)
    .maybeSingle();

  if (!member)
    return { ok: false, error: "This activation link is invalid or has already been used." };
  if (member.profile_id || member.onboarded_at)
    return { ok: false, error: "This account is already active — sign in instead." };
  if (member.verify_token_expires_at && new Date(member.verify_token_expires_at) < new Date())
    return {
      ok: false,
      error: "This activation link has expired — request a fresh one below.",
    };

  const email = (member.email as string).toLowerCase();
  let mode: "created" | "existing" = "created";
  let profileId: string | null = null;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: (member.full_name as string | null) ?? undefined },
  });
  if (createErr) {
    const exists =
      createErr.code === "email_exists" ||
      /already.*(registered|exists)/i.test(createErr.message ?? "");
    if (!exists) {
      console.error("completeMemberOnboarding: createUser failed:", createErr.message);
      return { ok: false, error: "Could not create your account — try again." };
    }
    mode = "existing";
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("email", email)
      .maybeSingle();
    if (!profile)
      return { ok: false, error: "This email already has an account — sign in with it instead." };
    profileId = profile.id as string;
    if (profile.role === "student") {
      await admin.from("profiles").update({ role: "coordinator" }).eq("id", profileId);
    }
  } else {
    profileId = created.user?.id ?? null;
  }

  // Make sure the school's roster exists (the teacher may not have activated
  // yet). provisionStudent is reuse-by-name, so this never duplicates.
  const { data: latestReg } = await admin
    .from("registrations")
    .select("id, edition_year, reps, provisioned_count")
    .eq("school_id", member.school_id)
    .order("edition_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestReg) {
    const reps = (Array.isArray(latestReg.reps) ? latestReg.reps : []) as Rep[];
    const editionYear = (latestReg.edition_year as number | null) ?? FALLBACK_EDITION;
    let provisioned = 0;
    for (const rep of reps) {
      if (!rep?.name) continue;
      const result = await provisionStudent(admin, {
        schoolId: member.school_id as string,
        editionYear,
        name: rep.name,
        level: rep.level ?? null,
      });
      if (result.code) provisioned++;
    }
    if (latestReg.provisioned_count == null && provisioned > 0) {
      await admin
        .from("registrations")
        .update({ provisioned_count: provisioned })
        .eq("id", latestReg.id);
    }
  }

  await admin
    .from("school_members")
    .update({
      verify_token: null,
      verify_token_expires_at: null,
      onboarded_at: new Date().toISOString(),
      profile_id: profileId,
    })
    .eq("id", member.id);

  return { ok: true, mode, email };
}

// ── Public "lost your activation link?" resend ────────────────────────────────
// Regenerates a fresh 30-day token and re-sends the branded activation email —
// but ONLY to the contact email already on file (never to caller-supplied
// addresses of other schools), and the response never reveals whether the email
// was found (no enumeration).

export type ResendState = { done: true } | { done: false; error: string } | null;

export async function requestActivationResend(
  _prev: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { done: false, error: "Enter the email you registered with." };

  const ip = requestIp(await headers());
  if (
    !rateLimit(`resend:${ip}`, { limit: 5, windowMs: 60_000 * 10 }) ||
    !rateLimit(`resend:${email}`, { limit: 3, windowMs: 60_000 * 60 })
  ) {
    return { done: false, error: "Too many requests — try again later." };
  }

  const admin = createAdminClient();
  // Always report success beyond this point — no enumeration.
  if (!admin) return { done: true };

  const { data: reg } = await admin
    .from("registrations")
    .select("id, contact_name, claim_code, schools(name)")
    .eq("contact_email", email)
    .is("owner_id", null)
    .is("onboarded_at", null)
    .order("edition_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const verifyToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  if (reg) {
    const { error } = await admin
      .from("registrations")
      .update({ verify_token: verifyToken, verify_token_expires_at: expires })
      .eq("id", reg.id);
    if (!error) {
      await sendEmailSafely(
        buildActivationEmail({
          email,
          name: (reg.contact_name as string | null) ?? null,
          schoolFullName:
            ((reg.schools as unknown as { name: string | null } | null)?.name) ?? "your school",
          verifyToken,
          claimCode: (reg.claim_code as string | null) ?? null,
        }),
      );
    }
    return { done: true };
  }

  // Not a registration contact — maybe a staged educator (e.g. the principal).
  const { data: member } = await admin
    .from("school_members")
    .select("id, full_name, schools(name)")
    .eq("email", email)
    .is("profile_id", null)
    .is("onboarded_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (member) {
    const { error } = await admin
      .from("school_members")
      .update({ verify_token: verifyToken, verify_token_expires_at: expires })
      .eq("id", member.id);
    if (!error) {
      await sendEmailSafely(
        buildActivationEmail({
          email,
          name: (member.full_name as string | null) ?? null,
          schoolFullName:
            ((member.schools as unknown as { name: string | null } | null)?.name) ?? "your school",
          verifyToken,
        }),
      );
    }
  }
  return { done: true };
}

"use server";

import { headers } from "next/headers";
import { buildMagicAccessEmail, sendEmailSafely } from "@/lib/email";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { safePortalRedirect } from "@/lib/portal-redirect";
import { createAdminClient } from "@/supabase/admin";

export type MagicAccessState =
  | { done: true }
  | { done: false; error: string };

function passwordSetupPath(redirectTo: string) {
  const next =
    redirectTo === "/portal" || redirectTo.startsWith("/portal/reset")
      ? ""
      : `&next=${encodeURIComponent(redirectTo)}`;
  return `/portal/reset?welcome=1${next}`;
}

export async function requestTrustedMagicAccessLink(
  email: string,
  redirectTo: string,
): Promise<MagicAccessState> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { done: false, error: "Enter a valid email address." };
  }

  const headerStore = await headers();
  const ip = requestIp(headerStore);
  if (
    !rateLimit(`trusted-magic:${ip}`, { limit: 8, windowMs: 60_000 * 10 }) ||
    !rateLimit(`trusted-magic:${normalizedEmail}`, {
      limit: 4,
      windowMs: 60_000 * 60,
    })
  ) {
    return { done: false, error: "Too many requests — try again later." };
  }

  const admin = createAdminClient();
  // Enumeration-safe: from the UI's perspective, a non-match still "sends" no
  // details. Only trusted registration/member emails get an actual auth link.
  if (!admin) return { done: true };

  const { data: reg } = await admin
    .from("registrations")
    .select("id, contact_name, contact_email, schools(name)")
    .eq("contact_email", normalizedEmail)
    .order("edition_year", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: member } = await admin
    .from("school_members")
    .select("id, full_name, email, schools(name)")
    .eq("email", normalizedEmail)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!reg && !member) return { done: true };

  const name =
    ((reg?.contact_name ?? member?.full_name) as string | null) ?? undefined;
  const schoolFullName =
    (((reg?.schools ?? member?.schools) as unknown as { name: string | null } | null)
      ?.name as string | null) ?? "your school";
  const target = passwordSetupPath(safePortalRedirect(redirectTo));
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const callbackUrl = `${origin}/portal/auth/callback?redirectTo=${encodeURIComponent(target)}`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: normalizedEmail,
    options: {
      data: { full_name: name },
      redirectTo: callbackUrl,
    },
  });

  const actionLink = data.properties?.action_link;
  if (error || !data.user || !actionLink) {
    console.error(
      "requestTrustedMagicAccessLink: generateLink failed:",
      error?.message ?? "missing action link",
    );
    return { done: false, error: "Could not send an access link — try again." };
  }

  await admin.from("profiles").upsert(
    {
      id: data.user.id,
      email: normalizedEmail,
      full_name: name ?? null,
      role: "coordinator",
    },
    { onConflict: "id" },
  );
  await admin
    .from("registrations")
    .update({ owner_id: data.user.id })
    .eq("contact_email", normalizedEmail)
    .is("owner_id", null);
  await admin
    .from("school_members")
    .update({ profile_id: data.user.id })
    .eq("email", normalizedEmail)
    .is("profile_id", null);

  await sendEmailSafely(
    buildMagicAccessEmail({
      email: normalizedEmail,
      name,
      schoolFullName,
      actionLink,
      code: data.properties.email_otp,
    }),
  );

  return { done: true };
}

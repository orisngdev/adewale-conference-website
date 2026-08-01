"use server";

import { revalidatePath } from "next/cache";
import { buildRegistrationStatusEmail, sendEmailSafely } from "@/lib/email";
import { createClient } from "@/supabase/server";
import { requireManage } from "@/supabase/auth";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
export type RegistrationAnnouncementState = { ok: boolean; message: string } | null;

type AudienceEmail = { email: string; name: string | null };

async function insertSelfNotification(
  supabase: SupabaseClient,
  profileId: string,
  title: string,
  body: string,
) {
  await supabase.from("notifications").insert({
    profile_id: profileId,
    title,
    body,
    link: "/portal/admin/editions",
  });
}

async function latestEditionYear(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("editions")
    .select("year")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  const year = Number(data?.year);
  return Number.isInteger(year) ? year : null;
}

async function isCurrentEdition(supabase: SupabaseClient, year: number) {
  const latest = await latestEditionYear(supabase);
  return latest != null && year === latest;
}

export async function toggleRegistration(year: number, open: boolean) {
  if (!(await requireManage("registrations"))) return;
  const supabase = await createClient();
  if (!(await isCurrentEdition(supabase, year))) return;
  // RLS (editions_admin_write) restricts this to admins.
  await supabase
    .from("editions")
    .update({ registration_open: open })
    .eq("year", year);
  revalidatePath("/portal/admin/editions");
}

async function registrationAnnouncementAudience(supabase: SupabaseClient, year: number) {
  const { data: regData } = await supabase
    .from("registrations")
    .select("id, school_id, contact_email, contact_name, owner_id, profiles(email, full_name)")
    .eq("edition_year", year);
  const registrations = (regData ?? []) as unknown as {
    id: string;
    school_id: string | null;
    contact_email: string | null;
    contact_name: string | null;
    owner_id: string | null;
    profiles: { email: string | null; full_name: string | null } | null;
  }[];

  const schoolIds = [
    ...new Set(registrations.map((r) => r.school_id).filter((id): id is string => !!id)),
  ];
  const { data: memberData } = schoolIds.length
    ? await supabase
        .from("school_members")
        .select("school_id, email, full_name, profile_id")
        .in("school_id", schoolIds)
        .eq("status", "approved")
    : { data: [] };
  const members = (memberData ?? []) as {
    school_id: string;
    email: string | null;
    full_name: string | null;
    profile_id: string | null;
  }[];

  const emails = new Map<string, AudienceEmail>();
  const profileIds = new Set<string>();
  const recipientKeys = new Set<string>();
  const profiledEmails = new Set<string>();
  const schoolsWithMemberEmail = new Set<string>();

  function addEmail(email: string | null | undefined, name: string | null | undefined) {
    const normalized = email?.trim().toLowerCase();
    if (!normalized) return null;
    if (!emails.has(normalized)) emails.set(normalized, { email: email as string, name: name ?? null });
    return normalized;
  }

  function addPerson(
    email: string | null | undefined,
    name: string | null | undefined,
    profileId?: string | null,
  ) {
    const normalized = addEmail(email, name);
    if (profileId) {
      profileIds.add(profileId);
      recipientKeys.add(`profile:${profileId}`);
      if (normalized) {
        profiledEmails.add(normalized);
        recipientKeys.delete(`email:${normalized}`);
      }
    } else if (normalized && !profiledEmails.has(normalized)) {
      recipientKeys.add(`email:${normalized}`);
    }
  }

  for (const member of members) {
    addPerson(member.email, member.full_name, member.profile_id);
    if (member.email) schoolsWithMemberEmail.add(member.school_id);
  }

  for (const registration of registrations) {
    addPerson(registration.profiles?.email, registration.profiles?.full_name, registration.owner_id);
    if (!registration.school_id || !schoolsWithMemberEmail.has(registration.school_id)) {
      addPerson(registration.contact_email, registration.contact_name);
    }
  }

  return {
    emails: [...emails.values()],
    profileIds: [...profileIds],
    recipientCount: recipientKeys.size,
  };
}

export async function sendRegistrationStatusAnnouncement(
  year: number,
  _prevState: RegistrationAnnouncementState,
  _formData: FormData,
): Promise<RegistrationAnnouncementState> {
  const admin = await requireManage("registrations");
  if (!admin) return { ok: false, message: "You do not have permission to announce registration status." };

  const supabase = await createClient();
  if (!(await isCurrentEdition(supabase, year))) {
    return { ok: false, message: "Only the current edition can be announced from here." };
  }

  const { data: edition } = await supabase
    .from("editions")
    .select("year, registration_open")
    .eq("year", year)
    .maybeSingle();
  if (!edition) return { ok: false, message: "Edition not found." };

  const registrationOpen = Boolean(edition.registration_open);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("edition_registration_announcements")
    .select("sent_at")
    .eq("edition_year", year)
    .eq("registration_open", registrationOpen)
    .gte("sent_at", cutoff)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const statusLabel = registrationOpen ? "open" : "closed";
  if (recent?.sent_at) {
    const sentAt = new Date(recent.sent_at as string).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return {
      ok: false,
      message: `Already announced as ${statusLabel} on ${sentAt}. Try again after 24 hours.`,
    };
  }

  const audience = await registrationAnnouncementAudience(supabase, year);
  for (const person of audience.emails) {
    await sendEmailSafely(
      buildRegistrationStatusEmail({
        email: person.email,
        name: person.name,
        editionYear: year,
        registrationOpen,
      }),
    );
  }

  const notificationRows = audience.profileIds.map((profileId) => ({
    profile_id: profileId,
    title: `Registration ${statusLabel}`,
    body: registrationOpen
      ? `Registration for ASC ${year} is open. Schools can submit through the portal while the window remains open.`
      : `Registration for ASC ${year} is closed. New school registrations are no longer being accepted.`,
    link: "/portal/school",
  }));
  if (notificationRows.length) {
    await supabase.from("notifications").insert(notificationRows);
  }

  const { error: logError } = await supabase.from("edition_registration_announcements").insert({
    edition_year: year,
    registration_open: registrationOpen,
    sent_by: admin.user.id,
    recipient_count: audience.recipientCount,
  });

  if (logError) {
    await insertSelfNotification(
      supabase,
      admin.user.id,
      "Registration announcement not logged",
      `Educators were notified, but the announcement log could not be saved: ${logError.message}`,
    );
    revalidatePath("/portal/admin/editions");
    return {
      ok: false,
      message: "Educators were notified, but the announcement log could not be saved.",
    };
  }

  await insertSelfNotification(
    supabase,
    admin.user.id,
    "Registration announcement sent",
    `Registration ${statusLabel} was announced to ${audience.recipientCount} educator${audience.recipientCount === 1 ? "" : "s"}.`,
  );
  revalidatePath("/portal/admin/editions");
  revalidatePath("/portal/notifications");
  return {
    ok: true,
    message: `Registration ${statusLabel} announced to ${audience.recipientCount} educator${audience.recipientCount === 1 ? "" : "s"}.`,
  };
}

export async function setEditionStage(year: number, formData: FormData) {
  if (!(await requireManage("registrations"))) return;
  const stage = String(formData.get("stage") ?? "").trim();
  if (!stage) return;
  const supabase = await createClient();
  if (!(await isCurrentEdition(supabase, year))) return;
  await supabase
    .from("editions")
    .update({ current_stage: stage })
    .eq("year", year);
  // Notify everyone tied to this edition (in-portal alert).
  await supabase.rpc("notify_edition_stage", { p_year: year });
  revalidatePath("/portal/admin/editions");
  revalidatePath("/portal");
}

// One-click "advance to the next stage" — derives the next stage server-side so
// the common path never needs the dropdown. Fans out the same notification.
export async function advanceEditionStage(year: number) {
  if (!(await requireManage("registrations"))) return;
  const supabase = await createClient();
  if (!(await isCurrentEdition(supabase, year))) return;
  const { data: edition } = await supabase
    .from("editions")
    .select("stages, current_stage")
    .eq("year", year)
    .maybeSingle();
  if (!edition) return;
  const stages = (edition.stages ?? []) as string[];
  const idx = stages.indexOf(edition.current_stage as string);
  const next = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null;
  if (!next) return;
  await supabase.from("editions").update({ current_stage: next }).eq("year", year);
  await supabase.rpc("notify_edition_stage", { p_year: year });
  revalidatePath("/portal/admin/editions");
  revalidatePath("/portal");
}

export async function createEdition(formData: FormData) {
  if (!(await requireManage("registrations"))) return;
  const year = Number(formData.get("year"));
  const title = String(formData.get("title") ?? "").trim();
  if (!Number.isInteger(year) || year < 2000) return;
  const supabase = await createClient();
  const latest = await latestEditionYear(supabase);
  if (latest != null && year <= latest) return;
  await supabase
    .from("editions")
    .upsert({ year, title: title || null }, { onConflict: "year" });
  revalidatePath("/portal/admin/editions");
}

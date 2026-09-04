// Who an announcement reaches. One resolver feeds BOTH channels (email and the
// in-portal bell), so an educator can never get the email but miss the portal
// copy — the invariant getSchoolAudience in ./school-notify was written to hold
// for a single school. This is the cross-school version: it paginates, and it
// derives the teacher/principal split that school_members can't record.
//
// See also registrationAnnouncementAudience in
// src/app/(portal)/portal/admin/editions/actions.ts — the registration-status
// blast has its own near-identical resolver. Left alone deliberately: folding it
// in here would put regression risk on that send for no gain today.

import type { createClient } from "@/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * How an educator relates to their school's registration entry. "member" means
 * an approved school_member we could not match to either the teacher or the
 * principal address on the entry — most often someone who joined after
 * registration, or a school whose entry predates the Supabase mirror.
 */
export type EducatorRole = "teacher" | "principal" | "member";

/**
 * Where a candidate came from. Only "contact" is droppable — it's the address on
 * the registration entry, kept as a fallback for schools with no member rows yet
 * and liable to be a stale Airtable value.
 */
export type RecipientSource = "member" | "owner" | "contact";

export interface EducatorRecipient {
  email: string | null;
  name: string | null;
  profileId: string | null;
  role: EducatorRole;
  /** Which school this candidate came from — used to drop stale contact fallbacks. */
  schoolId: string | null;
  source: RecipientSource;
}

export interface ResolvedRecipients {
  /** One entry per address — feeds sendBulkEmail. */
  emails: { email: string; name: string | null }[];
  /** One entry per account — feeds the notifications insert. */
  profileIds: string[];
  /** People, not sends: someone who is both owner and member counts once. */
  recipientCount: number;
}

/** Synthetic domain minted for code-login students in ./provision-student. */
const STUDENT_EMAIL_DOMAIN = "@students.adewaleconference.local";

/**
 * Students never hold a school_members row, so they cannot reach this resolver —
 * this is belt-and-braces against their synthetic address arriving by some other
 * path (a stale contact_email, a hand-edited row).
 */
export function isEducatorEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (!normalized.includes("@")) return false;
  return !normalized.endsWith(STUDENT_EMAIL_DOMAIN);
}

/** Match an address against the teacher/principal addresses on the entry. */
export function classifyRole(
  email: string | null | undefined,
  teacherEmails: Set<string>,
  principalEmails: Set<string>,
): EducatorRole {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return "member";
  if (teacherEmails.has(normalized)) return "teacher";
  if (principalEmails.has(normalized)) return "principal";
  return "member";
}

/**
 * A narrowed send reaches only educators whose role was actually established.
 * "member" is excluded from a teacher-only or principal-only send on purpose:
 * guessing would mail the wrong people.
 */
export function matchesTargetRole(role: EducatorRole, target: string): boolean {
  if (target !== "teacher" && target !== "principal") return true; // "all"
  return role === target;
}

/**
 * Collapse candidates into one message per address and one notification per
 * account, counting PEOPLE rather than sends.
 *
 * Three sets, the same strategy as registrationAnnouncementAudience:
 *   • emails       — keyed on the lowercased address
 *   • profileIds   — keyed on the account
 *   • recipientKeys — `profile:<id>` when the person has an account, else
 *     `email:<addr>`; learning an account for an address removes its email key,
 *     so a principal who is both registration owner and school member counts once.
 *
 * A registration's contact_email fallback is dropped for any school that already
 * produced a MEMBER address — otherwise a stale Airtable contact double-mails the
 * same school. Keyed on member rows only, not on the owner's profile: a school
 * where the teacher owns the entry and the principal is only named as the contact
 * must still reach the principal.
 */
export function dedupeRecipients(rows: EducatorRecipient[]): ResolvedRecipients {
  const schoolsWithMemberEmail = new Set<string>();
  for (const row of rows) {
    if (row.source !== "member") continue;
    if (row.schoolId && isEducatorEmail(row.email)) schoolsWithMemberEmail.add(row.schoolId);
  }

  const emails = new Map<string, { email: string; name: string | null }>();
  const profileIds = new Set<string>();
  const recipientKeys = new Set<string>();
  const profiledEmails = new Set<string>();

  for (const row of rows) {
    if (row.source === "contact" && row.schoolId && schoolsWithMemberEmail.has(row.schoolId)) {
      continue;
    }

    const usable = isEducatorEmail(row.email);
    const normalized = usable ? (row.email as string).trim().toLowerCase() : null;

    if (normalized && !emails.has(normalized)) {
      emails.set(normalized, {
        email: (row.email as string).trim(),
        name: row.name?.trim() || null,
      });
    }

    if (row.profileId) {
      profileIds.add(row.profileId);
      recipientKeys.add(`profile:${row.profileId}`);
      if (normalized) {
        profiledEmails.add(normalized);
        recipientKeys.delete(`email:${normalized}`);
      }
    } else if (normalized && !profiledEmails.has(normalized)) {
      recipientKeys.add(`email:${normalized}`);
    }
  }

  return {
    emails: [...emails.values()],
    profileIds: [...profileIds],
    recipientCount: recipientKeys.size,
  };
}

// ── Queries ─────────────────────────────────────────────────────────────────

/** PostgREST caps a response at 1000 rows; page rather than truncate silently. */
const PAGE_SIZE = 1000;
/** Keep the `in(...)` filter's URL sane when scoping members by school. */
const ID_CHUNK = 200;

function detailsValue(details: unknown, key: string): string | null {
  if (!details || typeof details !== "object") return null;
  const value = (details as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

interface RegistrationCandidate {
  school_id: string | null;
  owner_id: string | null;
  contact_email: string | null;
  contact_name: string | null;
  details: unknown;
  profiles: { email: string | null; full_name: string | null } | null;
}

interface MemberCandidate {
  school_id: string;
  email: string | null;
  full_name: string | null;
  profile_id: string | null;
}

async function fetchAllRegistrations(
  supabase: ServerClient,
  editionYear: number | null,
): Promise<RegistrationCandidate[]> {
  const rows: RegistrationCandidate[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("registrations")
      .select("school_id, owner_id, contact_email, contact_name, details, profiles(email, full_name)")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (editionYear != null) query = query.eq("edition_year", editionYear);

    const { data, error } = await query;
    if (error) break;
    const page = (data ?? []) as unknown as RegistrationCandidate[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchApprovedMembers(
  supabase: ServerClient,
  schoolIds: string[] | null,
): Promise<MemberCandidate[]> {
  const rows: MemberCandidate[] = [];

  // Scoped to an edition: ask only about that edition's schools, chunked.
  // Unscoped: one paginated sweep of every approved member.
  const chunks: (string[] | null)[] = schoolIds
    ? Array.from({ length: Math.ceil(schoolIds.length / ID_CHUNK) }, (_, i) =>
        schoolIds.slice(i * ID_CHUNK, (i + 1) * ID_CHUNK),
      )
    : [null];

  for (const chunk of chunks) {
    if (chunk && chunk.length === 0) continue;
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase
        .from("school_members")
        .select("school_id, email, full_name, profile_id")
        .eq("status", "approved")
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (chunk) query = query.in("school_id", chunk);

      const { data, error } = await query;
      if (error) break;
      const page = (data ?? []) as MemberCandidate[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }

  return rows;
}

/**
 * Resolve the educators an announcement should reach.
 *
 * `editionYear: null` means every edition — every approved educator. A year
 * narrows to the schools that registered that year, then to their approved
 * members plus each entry's owner and contact address.
 *
 * Mirrors public.can_read_announcement in
 * supabase/migrations/20260904090000_announcements.sql — keep the two in step.
 */
export async function resolveEducatorRecipients(
  supabase: ServerClient,
  scope: { editionYear: number | null; targetRole: string },
): Promise<ResolvedRecipients> {
  const registrations = await fetchAllRegistrations(supabase, scope.editionYear);

  const teacherEmails = new Set<string>();
  const principalEmails = new Set<string>();
  for (const registration of registrations) {
    const teacher =
      detailsValue(registration.details, "Teacher Email Address") ??
      registration.contact_email;
    const principal = detailsValue(registration.details, "Principal Email Address");
    if (teacher) teacherEmails.add(teacher.toLowerCase());
    if (principal) principalEmails.add(principal.toLowerCase());
  }

  const schoolIds = [
    ...new Set(
      registrations.map((r) => r.school_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  const members = await fetchApprovedMembers(
    supabase,
    scope.editionYear == null ? null : schoolIds,
  );

  const candidates: EducatorRecipient[] = [];

  for (const member of members) {
    candidates.push({
      email: member.email,
      name: member.full_name,
      profileId: member.profile_id,
      role: classifyRole(member.email, teacherEmails, principalEmails),
      schoolId: member.school_id,
      source: "member",
    });
  }

  for (const registration of registrations) {
    // The entry owner may have no member row (or theirs may predate account
    // linking) — make sure they still get the in-portal notification.
    if (registration.owner_id || registration.profiles?.email) {
      candidates.push({
        email: registration.profiles?.email ?? null,
        name: registration.profiles?.full_name ?? null,
        profileId: registration.owner_id,
        role: classifyRole(
          registration.profiles?.email,
          teacherEmails,
          principalEmails,
        ),
        schoolId: registration.school_id,
        source: "owner",
      });
    }

    if (registration.contact_email) {
      candidates.push({
        email: registration.contact_email,
        name: registration.contact_name,
        profileId: null,
        role: classifyRole(registration.contact_email, teacherEmails, principalEmails),
        schoolId: registration.school_id,
        source: "contact",
      });
    }
  }

  return dedupeRecipients(
    candidates.filter((c) => matchesTargetRole(c.role, scope.targetRole)),
  );
}

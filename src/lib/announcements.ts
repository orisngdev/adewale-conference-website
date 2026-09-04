// Announcements: admin-composed broadcasts to educators (coordinating teachers +
// principals), delivered by email, the in-portal bell, or both. Students are out
// of scope — they sign in with an access code against a synthetic auth_email and
// have no reachable inbox.
//
// Types, constants and the pure helpers live here; the recipient resolution lives
// in ./announcement-recipients, and the send flow in the module's actions.ts.

import { RESOURCE_DOC_EXTENSIONS } from "./resources";

/** How an announcement goes out. */
export type AnnouncementChannels = "email" | "in_app" | "both";

export const ANNOUNCEMENT_CHANNEL_OPTIONS: {
  value: AnnouncementChannels;
  label: string;
}[] = [
  { value: "both", label: "Email & in-portal" },
  { value: "email", label: "Email only" },
  { value: "in_app", label: "In-portal only" },
];

export const ANNOUNCEMENT_CHANNEL_LABEL: Record<string, string> = Object.fromEntries(
  ANNOUNCEMENT_CHANNEL_OPTIONS.map((c) => [c.value, c.label]),
);

/**
 * Which educators to reach. school_members carries no role column, so "teacher"
 * and "principal" are derived at send time by matching a member's address against
 * registrations.details ("Teacher Email Address" / "Principal Email Address").
 * An educator who joined later, or whose school registered before the Supabase
 * mirror, classifies as neither and is therefore EXCLUDED by a narrowed send —
 * which is why "all" is the default and the labels say where the split comes from.
 */
export type AnnouncementTargetRole = "all" | "teacher" | "principal";

export const ANNOUNCEMENT_TARGET_OPTIONS: {
  value: AnnouncementTargetRole;
  label: string;
}[] = [
  { value: "all", label: "All educators" },
  { value: "teacher", label: "Coordinating teachers (from the registration entry)" },
  { value: "principal", label: "Principals (from the registration entry)" },
];

export const ANNOUNCEMENT_TARGET_LABEL: Record<string, string> = Object.fromEntries(
  ANNOUNCEMENT_TARGET_OPTIONS.map((t) => [t.value, t.label]),
);

/**
 * Recipient-facing wording for the same values. The admin labels above carry
 * "(from the registration entry)" — an implementation detail an admin needs when
 * choosing, and noise in a school's inbox.
 */
export const ANNOUNCEMENT_TARGET_EMAIL_LABEL: Record<AnnouncementTargetRole, string> = {
  all: "All educators",
  teacher: "Coordinating teachers",
  principal: "Principals",
};

export type AnnouncementStatus = "draft" | "sent";

/** Per-file upload cap. Kept under next.config.ts's serverActions bodySizeLimit. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Files at or under this ride along in the email itself. */
export const MAX_INLINE_ATTACHMENT_BYTES = 5 * 1024 * 1024;
/** …and no more than this in total, so one message can't grow unbounded. */
export const MAX_INLINE_TOTAL_BYTES = 12 * 1024 * 1024;

// Announcements routinely carry a flyer, so images are allowed on top of the
// document types resources accepts.
export const ANNOUNCEMENT_FILE_EXTENSIONS = [
  ...RESOURCE_DOC_EXTENSIONS,
  ".png",
  ".jpg",
  ".jpeg",
] as const;
export const ANNOUNCEMENT_FILE_ACCEPT = ANNOUNCEMENT_FILE_EXTENSIONS.join(",");

const ANNOUNCEMENT_FILE_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "application/octet-stream", // some browsers report this for Office files
  "", // …or nothing at all
]);

/**
 * Accept a file only when its extension is a known type AND the MIME (when the
 * browser sent one) isn't an obviously different type. Extension is primary
 * because Office MIME reporting is unreliable across browsers — same rule as
 * isAllowedResourceFile.
 */
export function isAllowedAnnouncementFile(name: string, mime: string): boolean {
  const lower = (name ?? "").toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  if (!(ANNOUNCEMENT_FILE_EXTENSIONS as readonly string[]).includes(ext)) return false;
  return ANNOUNCEMENT_FILE_MIME.has((mime ?? "").toLowerCase());
}

/** The one spelling of an announcement's portal path — the notification `link`,
 *  the email CTA and the delete-time notification cleanup all go through this. */
export function announcementPath(id: string) {
  return `/portal/announcements/${id}`;
}

// ── Rows and mapping ────────────────────────────────────────────────────────

export interface AnnouncementAttachmentRow {
  id: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  channels: string | null;
  target_role: string | null;
  edition_year: number | null;
  status: string | null;
  sent_at: string | null;
  sent_by: string | null;
  recipient_count: number | null;
  email_sent_count: number | null;
  email_failed_count: number | null;
  notified_count: number | null;
  created_at: string;
  updated_at: string | null;
  announcement_attachments?: AnnouncementAttachmentRow[] | null;
}

/** Columns selected for an announcement everywhere in the app. */
export const ANNOUNCEMENT_COLUMNS =
  "id, title, body, channels, target_role, edition_year, status, sent_at, sent_by, " +
  "recipient_count, email_sent_count, email_failed_count, notified_count, " +
  "created_at, updated_at, " +
  "announcement_attachments(id, file_name, content_type, size_bytes)";

export interface AnnouncementAttachment {
  id: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
}

export interface PortalAnnouncement {
  id: string;
  title: string;
  body: string;
  channels: AnnouncementChannels;
  targetRole: AnnouncementTargetRole;
  editionYear: number | null;
  status: AnnouncementStatus;
  sentAt: string | null;
  recipientCount: number;
  emailSentCount: number;
  emailFailedCount: number;
  notifiedCount: number;
  createdAt: string;
  attachments: AnnouncementAttachment[];
}

function asChannels(value: string | null): AnnouncementChannels {
  return value === "email" || value === "in_app" || value === "both" ? value : "both";
}

function asTargetRole(value: string | null): AnnouncementTargetRole {
  return value === "teacher" || value === "principal" || value === "all" ? value : "all";
}

export function mapAnnouncement(row: AnnouncementRow): PortalAnnouncement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    channels: asChannels(row.channels),
    targetRole: asTargetRole(row.target_role),
    // A missing year means "every edition" — never coerce it to 0.
    editionYear: row.edition_year ?? null,
    status: row.status === "sent" ? "sent" : "draft",
    sentAt: row.sent_at,
    recipientCount: row.recipient_count ?? 0,
    emailSentCount: row.email_sent_count ?? 0,
    emailFailedCount: row.email_failed_count ?? 0,
    notifiedCount: row.notified_count ?? 0,
    createdAt: row.created_at,
    attachments: (row.announcement_attachments ?? []).map((a) => ({
      id: a.id,
      fileName: a.file_name,
      contentType: a.content_type,
      sizeBytes: Number(a.size_bytes ?? 0),
    })),
  };
}

// ── Inline-vs-link split ────────────────────────────────────────────────────

export interface SizedAttachment {
  id: string;
  fileName: string;
  sizeBytes: number;
}

/**
 * Split attachments into the ones small enough to ride along in the email and
 * the ones recipients must open in the portal. Files are taken in the order
 * given (creation order), so the result is deterministic: a file is inline only
 * if it fits the per-file cap AND still fits the running total.
 */
export function selectInlineAttachments<T extends SizedAttachment>(
  attachments: T[],
): { inline: T[]; linkOnly: T[] } {
  const inline: T[] = [];
  const linkOnly: T[] = [];
  let total = 0;

  for (const attachment of attachments) {
    const size = Number(attachment.sizeBytes ?? 0);
    if (
      size > 0 &&
      size <= MAX_INLINE_ATTACHMENT_BYTES &&
      total + size <= MAX_INLINE_TOTAL_BYTES
    ) {
      inline.push(attachment);
      total += size;
    } else {
      linkOnly.push(attachment);
    }
  }

  return { inline, linkOnly };
}

/** Human-readable file size for the attachment lists. */
export function formatFileSize(bytes: number) {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/supabase/server";
import { requireManage } from "@/supabase/auth";
import { resourceStorage } from "@/lib/storage";
import { buildAnnouncementEmail, sendBulkEmail, type EmailAttachment } from "@/lib/email";
import { markdownToEmailHtml } from "@/lib/markdown-email";
import { resolveEducatorRecipients } from "@/lib/announcement-recipients";
import {
  ANNOUNCEMENT_COLUMNS,
  MAX_ATTACHMENT_BYTES,
  announcementPath,
  isAllowedAnnouncementFile,
  mapAnnouncement,
  selectInlineAttachments,
  type AnnouncementRow,
} from "@/lib/announcements";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AnnouncementSendState = { ok: boolean; message: string } | null;

/**
 * Above this, a single inline send is no longer safe to attempt — better a clear
 * refusal than a request that dies mid-fan-out. Unlike the Airtable sync, an
 * announcement send must never be re-runnable, so there is no retry to fall back on.
 */
const MAX_INLINE_RECIPIENTS = 5000;
/** Notification rows per insert, so one blast isn't a single enormous statement. */
const NOTIFICATION_CHUNK = 500;

function revalidateAnnouncementViews() {
  revalidatePath("/portal/admin/announcements");
  revalidatePath("/portal/announcements");
  revalidatePath("/portal/notifications");
  revalidatePath("/portal/school");
}

function readChannels(formData: FormData) {
  const raw = String(formData.get("channels") ?? "both").trim();
  return ["email", "in_app", "both"].includes(raw) ? raw : "both";
}

function readTargetRole(formData: FormData) {
  const raw = String(formData.get("target_role") ?? "all").trim();
  return ["all", "teacher", "principal"].includes(raw) ? raw : "all";
}

function readEditionYear(formData: FormData) {
  const raw = String(formData.get("edition_year") ?? "").trim();
  return raw && /^\d{4}$/.test(raw) ? Number(raw) : null;
}

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
    link: "/portal/admin/announcements",
  });
}

/** A draft can be edited; a sent announcement is a record and must not change. */
async function loadDraft(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from("announcements")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  const row = data as { id: string; status: string } | null;
  return row && row.status === "draft" ? row : null;
}

/**
 * Store one uploaded file against an announcement and record it.
 *
 * Shared by the create form and the draft editor, so the validation, the key
 * shape and the "upload failed → no dangling row" rule are defined once.
 * Returns false when the file was rejected or the upload failed.
 */
async function storeAttachment(
  supabase: SupabaseClient,
  announcementId: string,
  file: File,
  /** Told why an upload was dropped, so the admin can be shown a reason. */
  onReject?: (reason: string) => void,
): Promise<boolean> {
  const name = file.name || "file";
  // Storage isn't wired — refuse rather than record a row pointing at nothing.
  if (!resourceStorage.configured) {
    onReject?.(`${name}: file storage is not configured`);
    return false;
  }
  if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) {
    onReject?.(`${name}: file is empty or over the size limit`);
    return false;
  }
  // The client `accept` is a hint, so re-check here.
  if (!isAllowedAnnouncementFile(name, file.type || "")) {
    onReject?.(`${name}: file type is not allowed`);
    return false;
  }

  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Namespaced by announcement so orphaned blobs can be swept by prefix.
  const storageKey = `announcements/${announcementId}/${randomUUID()}/${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    await resourceStorage.put(storageKey, bytes, file.type || undefined);
  } catch (error) {
    // Don't insert a row for a file that isn't there — and say so, rather than
    // leaving the admin to wonder why their upload vanished. Bad or rotated
    // storage credentials land here.
    onReject?.(
      `${name}: upload to storage failed (${error instanceof Error ? error.message : "unknown error"})`,
    );
    return false;
  }

  const { error } = await supabase.from("announcement_attachments").insert({
    announcement_id: announcementId,
    storage_key: storageKey,
    file_name: file.name || safeName,
    content_type: file.type || null,
    size_bytes: file.size,
  });
  if (error) {
    // Metadata write failed — drop the blob so nothing is left orphaned.
    try {
      await resourceStorage.remove(storageKey);
    } catch {
      /* best effort */
    }
    onReject?.(`${name}: could not be recorded (${error.message})`);
    return false;
  }
  return true;
}

/**
 * Upload every file on a form field, and if any were dropped tell the acting
 * admin why via their own notification. A void server action has no return
 * channel, and a silently vanishing attachment is the worst outcome — the
 * announcement would go out claiming files that were never stored.
 */
async function storeAttachments(
  supabase: SupabaseClient,
  announcementId: string,
  files: File[],
  adminId: string,
) {
  const rejected: string[] = [];
  for (const file of files) {
    await storeAttachment(supabase, announcementId, file, (reason) => rejected.push(reason));
  }
  if (rejected.length) {
    await supabase.from("notifications").insert({
      profile_id: adminId,
      title: `${rejected.length} attachment${rejected.length === 1 ? "" : "s"} could not be added`,
      body: rejected.join(" · "),
      link: `/portal/admin/announcements/${announcementId}`,
    });
  }
  return { stored: files.length - rejected.length, rejected: rejected.length };
}

/** Every file field on a form, ignoring the empty input browsers always send. */
function filesFrom(formData: FormData, field: string): File[] {
  return formData
    .getAll(field)
    .filter((f): f is File => f instanceof File && f.size > 0);
}

export async function createAnnouncementDraft(formData: FormData) {
  const admin = await requireManage("announcements");
  if (!admin) return;

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return;

  const supabase = await createClient();
  const { data: inserted } = await supabase
    .from("announcements")
    .insert({
      title,
      body,
      channels: readChannels(formData),
      target_role: readTargetRole(formData),
      edition_year: readEditionYear(formData),
      created_by: admin.user.id,
    })
    .select("id")
    .single();

  const id = (inserted as { id: string } | null)?.id ?? null;

  // Attachments can only be keyed once the row exists (the storage path embeds
  // the announcement id), so they are uploaded here rather than before insert.
  if (id) {
    const files = filesFrom(formData, "files");
    if (files.length) await storeAttachments(supabase, id, files, admin.user.id);
  }

  revalidatePath("/portal/admin/announcements");
  revalidatePath("/portal/notifications");
  redirect(id ? `/portal/admin/announcements/${id}` : "/portal/admin/announcements");
}

export async function updateAnnouncementDraft(id: string, formData: FormData) {
  const admin = await requireManage("announcements");
  if (!admin) return;

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return;

  const supabase = await createClient();
  if (!(await loadDraft(supabase, id))) return;

  await supabase
    .from("announcements")
    .update({
      title,
      body,
      channels: readChannels(formData),
      target_role: readTargetRole(formData),
      edition_year: readEditionYear(formData),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "draft");

  revalidatePath(`/portal/admin/announcements/${id}`);
  revalidatePath("/portal/admin/announcements");
}

export async function addAnnouncementAttachment(id: string, formData: FormData) {
  const admin = await requireManage("announcements");
  if (!admin) return;

  const files = filesFrom(formData, "file");
  if (files.length === 0) return;

  const supabase = await createClient();
  if (!(await loadDraft(supabase, id))) return;

  await storeAttachments(supabase, id, files, admin.user.id);

  revalidatePath(`/portal/admin/announcements/${id}`);
  revalidatePath("/portal/notifications");
}

export async function deleteAnnouncementAttachment(id: string, attachmentId: string) {
  const admin = await requireManage("announcements");
  if (!admin) return;

  const supabase = await createClient();
  if (!(await loadDraft(supabase, id))) return;

  const { data } = await supabase
    .from("announcement_attachments")
    .select("storage_key")
    .eq("id", attachmentId)
    .eq("announcement_id", id)
    .maybeSingle();
  const storageKey = (data as { storage_key: string } | null)?.storage_key ?? null;

  if (storageKey && resourceStorage.configured) {
    try {
      await resourceStorage.remove(storageKey);
    } catch {
      /* best-effort — still drop the metadata row below */
    }
  }

  await supabase
    .from("announcement_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("announcement_id", id);

  revalidatePath(`/portal/admin/announcements/${id}`);
}

/**
 * Send an announcement.
 *
 * The order of operations is the design:
 *   1. Resolve recipients and refuse the unsendable cases (nobody matches, too
 *      many to do inline) while the row is still a draft, so a refusal leaves an
 *      editable draft rather than a permanently unsendable record.
 *   2. Claim the row (compare-and-swap on status) BEFORE anything goes out, so a
 *      double-submit or a retried invocation cannot blast twice.
 *   3. In-portal notifications first: cheap, and it makes the announcement
 *      reachable even if email dies next.
 *   4. Read attachments once, not per recipient.
 *   5. Email.
 *   6. Write the counters.
 */
export async function sendAnnouncement(
  id: string,
  _prevState: AnnouncementSendState,
  _formData: FormData,
): Promise<AnnouncementSendState> {
  const admin = await requireManage("announcements");
  if (!admin) {
    return { ok: false, message: "You do not have permission to send announcements." };
  }

  const supabase = await createClient();

  // ── 1. Recipients, while it's still a draft ───────────────────────────────
  const { data: draftRow } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("id", id)
    .eq("status", "draft")
    .maybeSingle();
  if (!draftRow) {
    return { ok: false, message: "This announcement has already been sent." };
  }
  const draft = mapAnnouncement(draftRow as unknown as AnnouncementRow);

  let recipients = await resolveEducatorRecipients(supabase, {
    editionYear: draft.editionYear,
    targetRole: draft.targetRole,
  });

  if (recipients.recipientCount === 0) {
    return {
      ok: false,
      message:
        "No educators match this audience, so nothing was sent. Widen the edition or recipient filter and try again.",
    };
  }

  if (recipients.recipientCount > MAX_INLINE_RECIPIENTS) {
    return {
      ok: false,
      message: `This would reach ${recipients.recipientCount} educators, past what a single send can do safely. Contact engineering — this needs a background job.`,
    };
  }

  // ── 2. Claim the row ──────────────────────────────────────────────────────
  // Compare-and-swap: zero rows back means it was already claimed. The state
  // lives on the row, so unlike a time-window guard there is no gap in which a
  // duplicate send can slip through.
  const { data: claimedRow } = await supabase
    .from("announcements")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_by: admin.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "draft")
    .select(ANNOUNCEMENT_COLUMNS)
    .maybeSingle();

  if (!claimedRow) {
    return { ok: false, message: "This announcement has already been sent." };
  }
  // The claimed row is authoritative: someone may have edited the draft between
  // the read above and this claim, so re-resolve if the scope actually moved.
  const announcement = mapAnnouncement(claimedRow as unknown as AnnouncementRow);
  if (
    announcement.editionYear !== draft.editionYear ||
    announcement.targetRole !== draft.targetRole
  ) {
    recipients = await resolveEducatorRecipients(supabase, {
      editionYear: announcement.editionYear,
      targetRole: announcement.targetRole,
    });
  }

  const wantsInApp = announcement.channels === "in_app" || announcement.channels === "both";
  const wantsEmail = announcement.channels === "email" || announcement.channels === "both";

  // ── 3. In-portal notifications ────────────────────────────────────────────
  let notifiedCount = 0;
  let notifyError: string | null = null;
  if (wantsInApp && recipients.profileIds.length) {
    for (let i = 0; i < recipients.profileIds.length; i += NOTIFICATION_CHUNK) {
      const chunk = recipients.profileIds.slice(i, i + NOTIFICATION_CHUNK);
      const { error } = await supabase.from("notifications").insert(
        chunk.map((profileId) => ({
          profile_id: profileId,
          title: announcement.title,
          body: "A new announcement from the ASC team — open it to read the details.",
          link: announcementPath(id),
        })),
      );
      if (error) notifyError = error.message;
      else notifiedCount += chunk.length;
    }
  }

  // ── 4 & 5. Attachments, then email ────────────────────────────────────────
  let emailSent = 0;
  let emailFailed = 0;
  let emailSkipped = 0;
  let linkOnlyCount = 0;

  if (wantsEmail && recipients.emails.length) {
    const { inline, linkOnly } = selectInlineAttachments(announcement.attachments);
    const inlineFiles: EmailAttachment[] = [];
    const degraded: typeof linkOnly = [];
    if (inline.length && resourceStorage.configured) {
      // Read once for the whole send — per-recipient reads would be O(N) S3 calls.
      const { data: keyRows } = await supabase
        .from("announcement_attachments")
        .select("id, storage_key")
        .eq("announcement_id", id);
      const keys = new Map(
        ((keyRows ?? []) as { id: string; storage_key: string }[]).map((r) => [
          r.id,
          r.storage_key,
        ]),
      );

      for (const attachment of inline) {
        const key = keys.get(attachment.id);
        if (!key) {
          degraded.push(attachment);
          continue;
        }
        try {
          const bytes = await resourceStorage.read(key);
          inlineFiles.push({
            filename: attachment.fileName,
            content: bytes.toString("base64"),
            ...(attachment.contentType ? { type: attachment.contentType } : {}),
          });
        } catch {
          // A file we can't read degrades to portal-only; it never fails the send.
          degraded.push(attachment);
        }
      }
    } else {
      degraded.push(...inline);
    }

    const inlineNames = inlineFiles.map((f) => f.filename);
    const linkOnlyNames = [...linkOnly, ...degraded].map((a) => a.fileName);
    linkOnlyCount = linkOnlyNames.length;

    const { subject, html } = buildAnnouncementEmail({
      title: announcement.title,
      bodyHtml: markdownToEmailHtml(announcement.body),
      announcementPath: announcementPath(id),
      editionYear: announcement.editionYear,
      targetRole: announcement.targetRole,
      // Set by the claim above, so this is the real send time.
      sentAt: announcement.sentAt ? new Date(announcement.sentAt) : new Date(),
      inlineNames,
      linkOnlyNames,
    });

    const result = await sendBulkEmail({
      recipients: recipients.emails.map((r) => ({
        email: r.email,
        ...(r.name ? { name: r.name } : {}),
      })),
      subject,
      html,
      ...(inlineFiles.length ? { attachments: inlineFiles } : {}),
    });
    emailSent = result.sent;
    emailFailed = result.failed;
    emailSkipped = result.skipped;
  }

  // ── 6. Counters ───────────────────────────────────────────────────────────
  await supabase
    .from("announcements")
    .update({
      recipient_count: recipients.recipientCount,
      email_sent_count: emailSent,
      email_failed_count: emailFailed,
      notified_count: notifiedCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  const people = `${recipients.recipientCount} educator${recipients.recipientCount === 1 ? "" : "s"}`;

  if (notifyError) {
    await insertSelfNotification(
      supabase,
      admin.user.id,
      "Announcement partly delivered",
      `"${announcement.title}" went out, but some in-portal notifications could not be created: ${notifyError}`,
    );
    revalidateAnnouncementViews();
    return {
      ok: false,
      message: `Sent to ${people}, but some in-portal notifications could not be created. Do not re-send — check the send report.`,
    };
  }

  await insertSelfNotification(
    supabase,
    admin.user.id,
    "Announcement sent",
    `"${announcement.title}" was sent to ${people}.`,
  );
  revalidateAnnouncementViews();

  const notes: string[] = [];
  if (emailFailed > 0) notes.push(`${emailFailed} email${emailFailed === 1 ? "" : "s"} failed`);
  if (emailSkipped > 0) {
    // Reserved-domain addresses (the seeded dev educators) are never sent, so
    // say so — otherwise a test send looks like it silently reached everyone.
    notes.push(`${emailSkipped} skipped as undeliverable test address${emailSkipped === 1 ? "" : "es"}`);
  }
  if (linkOnlyCount > 0) {
    notes.push(
      `${linkOnlyCount} file${linkOnlyCount === 1 ? "" : "s"} left for portal download`,
    );
  }

  return {
    ok: true,
    message: `Sent to ${people}${notes.length ? ` — ${notes.join(", ")}` : ""}.`,
  };
}

export async function deleteAnnouncement(id: string) {
  const admin = await requireManage("announcements");
  if (!admin) return;

  const supabase = await createClient();

  const { data } = await supabase
    .from("announcement_attachments")
    .select("storage_key")
    .eq("announcement_id", id);
  if (resourceStorage.configured) {
    for (const row of (data ?? []) as { storage_key: string }[]) {
      try {
        await resourceStorage.remove(row.storage_key);
      } catch {
        /* best-effort — still drop the rows below */
      }
    }
  }

  // Clear the bell links first, so nobody is left with a notification pointing
  // at a page that no longer exists. announcementPath is the single spelling of
  // that link, shared with the send.
  await supabase.from("notifications").delete().eq("link", announcementPath(id));
  // Attachment rows go with the parent (on delete cascade).
  await supabase.from("announcements").delete().eq("id", id);

  revalidateAnnouncementViews();
  redirect("/portal/admin/announcements");
}

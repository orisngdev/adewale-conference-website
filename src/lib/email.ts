import { readFileSync } from "node:fs";
import { join } from "node:path";
import sendgrid, { type MailDataRequired } from "@sendgrid/mail";
import { SITE_URL } from "./site";

const DEFAULT_FROM_NAME = "Adewale Students Conference";
const EMAILS_DIR = join(process.cwd(), "src", "emails");

interface EmailRecipient {
  email: string;
  name?: string;
}

interface SendEmailInput {
  to: EmailRecipient[];
  subject: string;
  html: string;
  bcc?: EmailRecipient[];
}

function getApiKey() {
  return process.env.SENDGRID_API_KEY ?? "";
}

function getSenderAddress() {
  const value = process.env.ADEWALE_EMAIL_FROM;
  if (!value) {
    throw new Error("ADEWALE_EMAIL_FROM is not configured.");
  }
  return value;
}

function getSenderName() {
  return process.env.ADEWALE_EMAIL_FROM_NAME ?? DEFAULT_FROM_NAME;
}

function getReplyTo(): EmailRecipient | null {
  const email = process.env.ADEWALE_REPLY_TO;
  if (!email) return null;
  return { email, name: getSenderName() };
}

function getNotifyRecipient(): EmailRecipient | null {
  const email = process.env.ADEWALE_NOTIFY_EMAIL;
  if (!email) return null;
  return { email };
}

/**
 * Sends an email via SendGrid using inline HTML content.
 *
 * Returns false (and logs) instead of throwing when the API key is absent so
 * local development and form submissions never fail just because email is not
 * configured. Real SendGrid errors are surfaced to the caller.
 */
export async function sendEmail({ to, subject, html, bcc }: SendEmailInput): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("SENDGRID_API_KEY is not configured; skipping email send.");
    return false;
  }

  sendgrid.setApiKey(apiKey);

  // Spam filters score HTML-only mail worse — always include a text/plain
  // alternative derived from the HTML.
  const text = htmlToText(html);

  const replyTo = getReplyTo();
  const mail: MailDataRequired = {
    from: { email: getSenderAddress(), name: getSenderName() },
    ...(replyTo ? { replyTo } : {}),
    personalizations: [
      {
        to,
        ...(bcc?.length ? { bcc } : {}),
      },
    ],
    subject,
    content: [
      { type: "text/plain", value: text },
      { type: "text/html", value: html },
    ],
  };

  const [response] = await sendgrid.send(mail);
  return response.statusCode === 202;
}

/**
 * Sends an email and never throws — failures are logged so a downstream
 * submission (Airtable write) is not rolled back by a mail outage.
 */
export async function sendEmailSafely(input: SendEmailInput): Promise<void> {
  try {
    await sendEmail(input);
  } catch (error) {
    console.error("Email send failed:", error);
  }
}

// Rough plain-text rendering of an email body: links become "label (url)",
// block boundaries become newlines, entities are decoded.
function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const cleanLabel = label.replace(/<[^>]+>/g, "").trim();
      return cleanLabel ? `${cleanLabel} (${href})` : href;
    })
    .replace(/<\/(p|div|tr|table|h[1-6]|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const templateCache = new Map<string, string>();

function loadTemplate(name: string) {
  const cached = templateCache.get(name);
  if (cached) return cached;

  const template = readFileSync(join(EMAILS_DIR, `${name}.html`), "utf8");
  templateCache.set(name, template);
  return template;
}

/**
 * Fills `{{key}}` placeholders with HTML-escaped values, and `{{{key}}}`
 * placeholders with raw (already-trusted HTML) values.
 */
function interpolate(template: string, data: Record<string, string>) {
  return template.replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g, (match, rawKey, escKey) => {
    if (rawKey) {
      return rawKey in data ? data[rawKey] : match;
    }
    return escKey in data ? escapeHtml(data[escKey]) : match;
  });
}

/** Renders a body template, then wraps it in the shared layout. */
function render(bodyTemplate: string, heading: string, data: Record<string, string>) {
  const body = interpolate(loadTemplate(bodyTemplate), data);
  return interpolate(loadTemplate("layout"), { heading, body });
}

export interface RegistrationEmailData {
  schoolFullName: string;
  schoolLGA: string;
  zonalFinalsLocation: string;
  principalFullName: string;
  principalEmail: string;
  teacherFullName: string;
  teacherEmail: string;
  claimCode?: string | null;
  verifyToken?: string | null;
}

// Pre-rendered HTML inviting the coordinator to activate their portal account
// (self-service onboarding — the link is valid for 30 days and replaces the old
// claim-code flow; the claim code remains as a small different-email fallback).
// Empty when the Supabase mirror is off, so the email simply omits the section.
function buildActivateBlock(verifyToken?: string | null, claimCode?: string | null) {
  if (!verifyToken) return buildClaimBlock(claimCode);
  const activateUrl = `${SITE_URL}/portal/onboard?token=${encodeURIComponent(verifyToken)}`;
  const claimFootnote = claimCode
    ? `<p class="body-font" style="margin:14px 0 0;font-size:12px;line-height:18px;color:#8a8672;">Prefer a different email than this one? Sign up in the portal and use claim code <span style="font-family:monospace;font-weight:bold;color:#4A4E5C;">${escapeHtml(claimCode)}</span> at ${SITE_URL}/portal/claim.</p>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:26px 0 0;background:#FBF3E2;border:1px solid #E8A020;">
  <tr><td style="padding:18px;">
    <p class="body-font" style="margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:#8a5e0e;">Activate your school portal</p>
    <p class="body-font" style="margin:0 0 14px;font-size:15px;line-height:24px;color:#4A4E5C;">Set your password to activate your coordinator account — your students' login codes will be ready inside, along with practice drills, learning plans, and your registration status. This link is valid for 30 days.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#E8A020;">
      <a href="${activateUrl}" style="display:inline-block;padding:11px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#0A0F1E;text-decoration:none;">Activate your portal account →</a>
    </td></tr></table>
    ${claimFootnote}
  </td></tr>
</table>`;
}

// Legacy claim-code block — used only when the mirror produced a claim code but
// no verify token (e.g. rows created before self-service onboarding).
function buildClaimBlock(claimCode?: string | null) {
  if (!claimCode) return "";
  const claimUrl = `${SITE_URL}/portal/claim?code=${encodeURIComponent(claimCode)}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:26px 0 0;background:#FBF3E2;border:1px solid #E8A020;">
  <tr><td style="padding:18px;">
    <p class="body-font" style="margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:#8a5e0e;">Manage your school online</p>
    <p class="body-font" style="margin:0 0 14px;font-size:15px;line-height:24px;color:#4A4E5C;">Sign in to claim your school — track your status, manage representatives, and download certificates. Your claim code:</p>
    <p style="margin:0 0 16px;font-size:22px;font-weight:bold;letter-spacing:3px;font-family:monospace;color:#0A0F1E;">${escapeHtml(claimCode)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#E8A020;">
      <a href="${claimUrl}" style="display:inline-block;padding:11px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#0A0F1E;text-decoration:none;">Claim your school →</a>
    </td></tr></table>
  </td></tr>
</table>`;
}

export function buildRegistrationEmail(data: RegistrationEmailData) {
  const subject = `Registration received — ${data.schoolFullName}`;
  const html = render("registration", "Registration received", {
    schoolFullName: data.schoolFullName,
    schoolLGA: data.schoolLGA,
    zonalFinalsLocation: data.zonalFinalsLocation,
    principalFullName: data.principalFullName,
    teacherFullName: data.teacherFullName,
    claimBlock: buildActivateBlock(data.verifyToken, data.claimCode),
  });

  const to: EmailRecipient[] = [
    { email: data.principalEmail, name: data.principalFullName },
    { email: data.teacherEmail, name: data.teacherFullName },
  ];

  const notify = getNotifyRecipient();
  return { to, bcc: notify ? [notify] : undefined, subject, html };
}

/** Heads-up to the conference team when a new registration lands (awareness only). */
export function buildAdminNewRegistrationEmail(data: {
  recipients: EmailRecipient[];
  schoolFullName: string;
  schoolLGA: string;
  teacherFullName: string;
  contactEmail: string;
  editionYear: number;
  reps: string;
}) {
  const subject = `New registration — ${data.schoolFullName} (${data.editionYear})`;
  const html = render("admin-new-registration", "New registration", {
    schoolFullName: data.schoolFullName,
    schoolLGA: data.schoolLGA,
    teacherFullName: data.teacherFullName,
    contactEmail: data.contactEmail,
    editionYear: String(data.editionYear),
    reps: data.reps || "—",
    reviewUrl: `${SITE_URL}/portal/admin/registrations`,
  });
  return { to: data.recipients, subject, html };
}

/** Standalone activation (re)send — same 30-day link block as the confirmation. */
export function buildActivationEmail(data: {
  email: string;
  name?: string | null;
  schoolFullName: string;
  verifyToken: string;
  claimCode?: string | null;
}) {
  const subject = `Activate your ASC portal account — ${data.schoolFullName}`;
  const html = render("activation", "Activate your account", {
    schoolFullName: data.schoolFullName,
    activateBlock: buildActivateBlock(data.verifyToken, data.claimCode),
  });
  const to: EmailRecipient[] = [{ email: data.email, ...(data.name ? { name: data.name } : {}) }];
  return { to, subject, html };
}

function getGuidelinesUrl() {
  return process.env.ADEWALE_GUIDELINES_URL || `${SITE_URL}/faq`;
}

/** Official acceptance + competition guidelines (sent at close-of-registration review). */
export function buildAcceptedEmail(data: {
  email: string;
  name?: string | null;
  schoolFullName: string;
  editionYear: number;
}) {
  const subject = `You're in — ${data.schoolFullName} is confirmed for ASC ${data.editionYear}`;
  const html = render("accepted", "Entry confirmed", {
    schoolFullName: data.schoolFullName,
    editionYear: String(data.editionYear),
    guidelinesUrl: getGuidelinesUrl(),
  });
  const to: EmailRecipient[] = [{ email: data.email, ...(data.name ? { name: data.name } : {}) }];
  return { to, subject, html };
}

/** Polite not-selected email (portal/prep access stays open). */
export function buildDeclinedEmail(data: {
  email: string;
  name?: string | null;
  schoolFullName: string;
  editionYear: number;
}) {
  const subject = `Your ASC ${data.editionYear} entry — ${data.schoolFullName}`;
  const html = render("declined", "Entry update", {
    schoolFullName: data.schoolFullName,
    editionYear: String(data.editionYear),
  });
  const to: EmailRecipient[] = [{ email: data.email, ...(data.name ? { name: data.name } : {}) }];
  return { to, subject, html };
}

/** Admin team invitation — the emailed single-use token link lands on a
 * set-password page; the account is created pre-verified (clicking the link
 * proves address ownership). */
export function buildTeamInviteEmail(data: {
  email: string;
  invitedBy: string;
  verifyToken: string;
}) {
  const subject = "You're invited to the ASC portal team";
  const html = render("team-invite", "Team invitation", {
    invitedBy: data.invitedBy,
    email: data.email,
    inviteUrl: `${SITE_URL}/portal/team-invite?token=${encodeURIComponent(data.verifyToken)}`,
  });
  return { to: [{ email: data.email }], subject, html };
}

export interface SponsorshipEmailData {
  org: string;
  contact: string;
  email: string;
  tier: string;
}

export function buildSponsorshipEmail(data: SponsorshipEmailData) {
  const subject = `We received your sponsorship enquiry — ${data.org}`;
  const html = render("sponsorship", "Enquiry received", {
    contact: data.contact,
    org: data.org,
    tier: data.tier,
  });

  const to: EmailRecipient[] = [{ email: data.email, name: data.contact }];
  const notify = getNotifyRecipient();
  return { to, bcc: notify ? [notify] : undefined, subject, html };
}

import { readFileSync } from "node:fs";
import { join } from "node:path";
import sendgrid, { type MailDataRequired } from "@sendgrid/mail";

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
    content: [{ type: "text/html", value: html }],
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
}

export function buildRegistrationEmail(data: RegistrationEmailData) {
  const subject = `Registration received — ${data.schoolFullName}`;
  const html = render("registration", "Registration received", {
    schoolFullName: data.schoolFullName,
    schoolLGA: data.schoolLGA,
    zonalFinalsLocation: data.zonalFinalsLocation,
    principalFullName: data.principalFullName,
    teacherFullName: data.teacherFullName,
  });

  const to: EmailRecipient[] = [
    { email: data.principalEmail, name: data.principalFullName },
    { email: data.teacherEmail, name: data.teacherFullName },
  ];

  const notify = getNotifyRecipient();
  return { to, bcc: notify ? [notify] : undefined, subject, html };
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

# Custom SMTP for Supabase Auth emails

Supabase's **built-in** email sender is rate-limited (only a few messages per hour) and meant for testing — it will silently throttle real sign-ups. The portal sends **auth emails** (sign-up confirmation, magic link, password reset) through Supabase, so production needs a **custom SMTP** provider.

We already use **SendGrid** for the app's own transactional mail, so the simplest path is to point Supabase's SMTP at the same SendGrid account.

> Two separate email paths — don't confuse them:
> - **App emails** (registration / sponsorship confirmations) → sent by the Next app via the SendGrid **Web API** (`@sendgrid/mail`, `SENDGRID_API_KEY`).
> - **Auth emails** (confirm / magic-link / reset) → sent by **Supabase**, configured in the Supabase dashboard (below). Same SendGrid account, different mechanism.

---

## 1. Verify a sender in SendGrid (do this first)

Deliverability depends on SendGrid trusting your "From" address.

- **Best: Domain Authentication.** SendGrid → *Settings → Sender Authentication → Authenticate Your Domain* → follow the CNAME/DKIM/SPF DNS records for `asc2026.ng` (or your domain). This lets you send from any `@asc2026.ng` address with proper SPF/DKIM.
- **Quick: Single Sender Verification.** SendGrid → *Settings → Sender Authentication → Verify a Single Sender* → verify e.g. `noreply@asc2026.ng`. Fine to start, weaker deliverability.

The "From" you use in Supabase **must** be a verified sender/domain here, or mail bounces.

## 2. Get the SendGrid SMTP credentials

SendGrid's SMTP relay uses the **same API key** as the Web API:

| Field    | Value                          |
| -------- | ------------------------------ |
| Host     | `smtp.sendgrid.net`            |
| Port     | `587` (STARTTLS) — or `465` (SSL) |
| Username | `apikey` *(the literal word)*  |
| Password | your SendGrid API key (`SG.…`) |

If you don't have a key with Mail-Send permission: SendGrid → *Settings → API Keys → Create API Key* → **Restricted Access → Mail Send: Full**.

## 3. Enable custom SMTP in Supabase

Supabase Dashboard → **Authentication → Emails → SMTP Settings** → toggle **Enable Custom SMTP**, then fill:

| Setting              | Value                                             |
| -------------------- | ------------------------------------------------- |
| Sender email         | `noreply@asc2026.ng` *(your verified sender)*     |
| Sender name          | `Adewale Students Conference`                     |
| Host                 | `smtp.sendgrid.net`                               |
| Port                 | `587`                                             |
| Username             | `apikey`                                          |
| Password             | your `SG.…` API key                               |
| Minimum interval     | `60` seconds (default is fine)                    |

Save. Supabase now routes all auth emails through SendGrid.

## 4. Raise the auth rate limits

With built-in email, Supabase caps sends low on purpose. After enabling custom SMTP:

Dashboard → **Authentication → Rate Limits** → raise **"Rate limit for sending emails"** (e.g. to a few hundred/hour) to match a real cohort signing up.

## 5. Set the redirect URLs (required for magic-link / reset / callback)

The portal's magic-link, password-reset, and OAuth callback all redirect back to the app. Set these so links don't break in production:

Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://<your-production-domain>` (e.g. `https://www.adewaleconference.org`)
- **Redirect URLs** (add each): `https://<your-production-domain>/portal/auth/callback`, `https://<your-production-domain>/portal/reset`, and for local dev `http://localhost:3000/portal/auth/callback`, `http://localhost:3000/portal/reset`.

## 6. (Optional) Brand the email templates

Dashboard → **Authentication → Emails → Templates** — customize *Confirm signup*, *Magic Link*, *Reset Password* with ASC copy/colors. Keep the `{{ .ConfirmationURL }}` variable intact so links still work.

## 7. Test it

1. In an incognito window, sign up a new test account at `/portal/login`.
2. Confirm the email arrives (check spam on first sends).
3. Cross-check **SendGrid → Activity Feed** — you should see the send with a `delivered` status.
4. Try **Forgot password** and a **magic link** to confirm the redirect URLs resolve to the app.

---

## Using a different provider

Any SMTP provider works — just swap the host/port/username/password in step 3. Common ones:

| Provider   | Host                     | Port | Username        |
| ---------- | ------------------------ | ---- | --------------- |
| SendGrid   | `smtp.sendgrid.net`      | 587  | `apikey`        |
| Resend     | `smtp.resend.com`        | 587  | `resend`        |
| Mailgun    | `smtp.mailgun.org`       | 587  | your SMTP login |
| Postmark   | `smtp.postmarkapp.com`   | 587  | your server token |
| AWS SES    | `email-smtp.<region>.amazonaws.com` | 587 | SES SMTP user |
| Brevo      | `smtp-relay.brevo.com`   | 587  | your SMTP login |

# Supabase Auth Email Templates (ASC-branded)

These mirror the app's own transactional emails (`src/emails/layout.html`) so the
**Magic Link / sign-in** email (and the other auth emails) look identical to the
registration / activation emails students already receive — same masthead badge,
Bebas heading, gold rule, and navy Foundation footer.

## How to apply
1. Supabase → **Authentication → Email Templates**.
2. Pick the template (Magic Link, Confirm signup, …), set the **Subject** shown
   below, and paste the matching HTML block into the message body.
3. Save. (SMTP is already your SendGrid sender, so delivery is unchanged.)

**Notes**
- Placeholders are Supabase's Go variables — `{{ .ConfirmationURL }}`, `{{ .Token }}`,
  `{{ .Email }}`, `{{ .NewEmail }}`. Don't rename them.
- Bebas Neue / Playfair load from Google Fonts with safe fallbacks (Arial Narrow /
  Georgia) — some clients (Gmail) ignore web fonts and fall back; that's expected
  and still on-brand.
- Brand: navy `#0A0F1E`, gold `#E8A020`, cream `#FAF7F0`, footer navy `#1C2540`.
- The magic-link redirect (`/portal/reset?welcome=1`) is baked into
  `{{ .ConfirmationURL }}` by the app's `signInWithOtp` call — the template just
  links to it.

> Reusable shell: every template is the same masthead + gold rule + footer with a
> different heading/body. To restyle all, change one and mirror the edit.

---

## 1. Magic Link (sign-in link)

**Subject:** `Your Adewale Students Conference sign-in link`

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Playfair+Display:ital@1&display=swap" rel="stylesheet">
<style>.display{font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif}.serif{font-family:'Playfair Display',Georgia,serif}.body-font{font-family:Arial,Helvetica,sans-serif}</style>
</head><body style="margin:0;padding:0;background-color:#FAF7F0;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F0;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid rgba(10,15,30,0.10);">
  <tr><td style="background-color:#0A0F1E;padding:30px 36px 26px;">
    <span class="body-font" style="display:inline-block;border:1px solid #E8A020;color:#E8A020;font-size:10px;font-weight:bold;letter-spacing:0.25em;text-transform:uppercase;padding:6px 12px;margin-bottom:18px;">Year Six &middot; Ogun State &middot; 2026</span>
    <div class="display" style="color:#FFFFFF;font-size:30px;letter-spacing:0.06em;line-height:1;text-transform:uppercase;">Adewale Students <span style="color:#E8A020;">Conference</span></div>
  </td></tr>
  <tr><td style="height:4px;line-height:4px;font-size:0;background-color:#E8A020;">&nbsp;</td></tr>
  <tr><td style="padding:38px 36px 32px;">
    <h1 class="display" style="margin:0 0 18px;font-size:38px;line-height:1;letter-spacing:0.03em;color:#0A0F1E;text-transform:uppercase;">Your sign-in link</h1>
    <p class="body-font" style="margin:0 0 24px;font-size:15px;line-height:24px;color:#4A4E5C;">Tap the button below to sign in to your Adewale Students Conference portal. This link is valid for a short time and can be used once.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="background-color:#E8A020;">
      <a href="{{ .ConfirmationURL }}" class="body-font" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:bold;color:#0A0F1E;text-decoration:none;">Sign in to the portal &rarr;</a>
    </td></tr></table>
    <p class="body-font" style="margin:0 0 8px;font-size:13px;color:#4A4E5C;">Or enter this one-time code:</p>
    <p class="body-font" style="margin:0;font-size:24px;font-weight:bold;letter-spacing:5px;color:#0A0F1E;background:#FBF3E2;border:1px solid #E8A020;padding:14px;text-align:center;font-family:'Courier New',monospace;">{{ .Token }}</p>
  </td></tr>
  <tr><td style="background-color:#1C2540;padding:26px 36px;">
    <div class="body-font" style="color:#E8A020;font-size:11px;font-weight:bold;letter-spacing:0.22em;text-transform:uppercase;margin-bottom:10px;">An Initiative of The Adewale Foundation</div>
    <div class="body-font" style="color:rgba(240,234,216,0.7);font-size:12px;line-height:19px;">Questions? Reach us at <a href="mailto:adewaleconference@gmail.com" style="color:#F0EAD8;text-decoration:underline;">adewaleconference@gmail.com</a>.</div>
    <div class="body-font" style="color:rgba(240,234,216,0.45);font-size:11px;line-height:18px;margin-top:14px;">If you didn't request this sign-in link, you can safely ignore this email.</div>
  </td></tr>
</table>
<div class="body-font" style="color:rgba(10,15,30,0.45);font-size:11px;letter-spacing:0.06em;padding:18px 0 0;">&copy; 2026 Adewale Students Conference &middot; Ogun State, Nigeria</div>
</td></tr></table></body></html>
```

---

## 2. Confirm sign up

**Subject:** `Confirm your email — Adewale Students Conference`

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Playfair+Display:ital@1&display=swap" rel="stylesheet">
<style>.display{font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif}.serif{font-family:'Playfair Display',Georgia,serif}.body-font{font-family:Arial,Helvetica,sans-serif}</style>
</head><body style="margin:0;padding:0;background-color:#FAF7F0;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F0;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid rgba(10,15,30,0.10);">
  <tr><td style="background-color:#0A0F1E;padding:30px 36px 26px;">
    <span class="body-font" style="display:inline-block;border:1px solid #E8A020;color:#E8A020;font-size:10px;font-weight:bold;letter-spacing:0.25em;text-transform:uppercase;padding:6px 12px;margin-bottom:18px;">Year Six &middot; Ogun State &middot; 2026</span>
    <div class="display" style="color:#FFFFFF;font-size:30px;letter-spacing:0.06em;line-height:1;text-transform:uppercase;">Adewale Students <span style="color:#E8A020;">Conference</span></div>
  </td></tr>
  <tr><td style="height:4px;line-height:4px;font-size:0;background-color:#E8A020;">&nbsp;</td></tr>
  <tr><td style="padding:38px 36px 32px;">
    <h1 class="display" style="margin:0 0 18px;font-size:38px;line-height:1;letter-spacing:0.03em;color:#0A0F1E;text-transform:uppercase;">Confirm your email</h1>
    <p class="body-font" style="margin:0 0 24px;font-size:15px;line-height:24px;color:#4A4E5C;">Tap below to confirm <span style="color:#0A0F1E;font-weight:bold;">{{ .Email }}</span> and finish setting up your Adewale Students Conference portal account.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#E8A020;">
      <a href="{{ .ConfirmationURL }}" class="body-font" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:bold;color:#0A0F1E;text-decoration:none;">Confirm email address &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="background-color:#1C2540;padding:26px 36px;">
    <div class="body-font" style="color:#E8A020;font-size:11px;font-weight:bold;letter-spacing:0.22em;text-transform:uppercase;margin-bottom:10px;">An Initiative of The Adewale Foundation</div>
    <div class="body-font" style="color:rgba(240,234,216,0.7);font-size:12px;line-height:19px;">Questions? Reach us at <a href="mailto:adewaleconference@gmail.com" style="color:#F0EAD8;text-decoration:underline;">adewaleconference@gmail.com</a>.</div>
    <div class="body-font" style="color:rgba(240,234,216,0.45);font-size:11px;line-height:18px;margin-top:14px;">If you didn't create an account, you can safely ignore this email.</div>
  </td></tr>
</table>
<div class="body-font" style="color:rgba(10,15,30,0.45);font-size:11px;letter-spacing:0.06em;padding:18px 0 0;">&copy; 2026 Adewale Students Conference &middot; Ogun State, Nigeria</div>
</td></tr></table></body></html>
```

---

## 3. Invite user

**Subject:** `You're invited to the Adewale Students Conference portal`

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Playfair+Display:ital@1&display=swap" rel="stylesheet">
<style>.display{font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif}.serif{font-family:'Playfair Display',Georgia,serif}.body-font{font-family:Arial,Helvetica,sans-serif}</style>
</head><body style="margin:0;padding:0;background-color:#FAF7F0;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F0;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid rgba(10,15,30,0.10);">
  <tr><td style="background-color:#0A0F1E;padding:30px 36px 26px;">
    <span class="body-font" style="display:inline-block;border:1px solid #E8A020;color:#E8A020;font-size:10px;font-weight:bold;letter-spacing:0.25em;text-transform:uppercase;padding:6px 12px;margin-bottom:18px;">Year Six &middot; Ogun State &middot; 2026</span>
    <div class="display" style="color:#FFFFFF;font-size:30px;letter-spacing:0.06em;line-height:1;text-transform:uppercase;">Adewale Students <span style="color:#E8A020;">Conference</span></div>
  </td></tr>
  <tr><td style="height:4px;line-height:4px;font-size:0;background-color:#E8A020;">&nbsp;</td></tr>
  <tr><td style="padding:38px 36px 32px;">
    <h1 class="display" style="margin:0 0 18px;font-size:38px;line-height:1;letter-spacing:0.03em;color:#0A0F1E;text-transform:uppercase;">You've been invited</h1>
    <p class="body-font" style="margin:0 0 24px;font-size:15px;line-height:24px;color:#4A4E5C;">You've been invited to join the Adewale Students Conference portal. Tap below to accept and set up your account.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#E8A020;">
      <a href="{{ .ConfirmationURL }}" class="body-font" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:bold;color:#0A0F1E;text-decoration:none;">Accept invitation &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="background-color:#1C2540;padding:26px 36px;">
    <div class="body-font" style="color:#E8A020;font-size:11px;font-weight:bold;letter-spacing:0.22em;text-transform:uppercase;margin-bottom:10px;">An Initiative of The Adewale Foundation</div>
    <div class="body-font" style="color:rgba(240,234,216,0.7);font-size:12px;line-height:19px;">Questions? Reach us at <a href="mailto:adewaleconference@gmail.com" style="color:#F0EAD8;text-decoration:underline;">adewaleconference@gmail.com</a>.</div>
  </td></tr>
</table>
<div class="body-font" style="color:rgba(10,15,30,0.45);font-size:11px;letter-spacing:0.06em;padding:18px 0 0;">&copy; 2026 Adewale Students Conference &middot; Ogun State, Nigeria</div>
</td></tr></table></body></html>
```

---

## 4. Change email address

**Subject:** `Confirm your new email address`

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Playfair+Display:ital@1&display=swap" rel="stylesheet">
<style>.display{font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif}.serif{font-family:'Playfair Display',Georgia,serif}.body-font{font-family:Arial,Helvetica,sans-serif}</style>
</head><body style="margin:0;padding:0;background-color:#FAF7F0;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F0;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid rgba(10,15,30,0.10);">
  <tr><td style="background-color:#0A0F1E;padding:30px 36px 26px;">
    <span class="body-font" style="display:inline-block;border:1px solid #E8A020;color:#E8A020;font-size:10px;font-weight:bold;letter-spacing:0.25em;text-transform:uppercase;padding:6px 12px;margin-bottom:18px;">Year Six &middot; Ogun State &middot; 2026</span>
    <div class="display" style="color:#FFFFFF;font-size:30px;letter-spacing:0.06em;line-height:1;text-transform:uppercase;">Adewale Students <span style="color:#E8A020;">Conference</span></div>
  </td></tr>
  <tr><td style="height:4px;line-height:4px;font-size:0;background-color:#E8A020;">&nbsp;</td></tr>
  <tr><td style="padding:38px 36px 32px;">
    <h1 class="display" style="margin:0 0 18px;font-size:38px;line-height:1;letter-spacing:0.03em;color:#0A0F1E;text-transform:uppercase;">Confirm your new email</h1>
    <p class="body-font" style="margin:0 0 24px;font-size:15px;line-height:24px;color:#4A4E5C;">Tap below to confirm <span style="color:#0A0F1E;font-weight:bold;">{{ .NewEmail }}</span> as the new email on your Adewale Students Conference account.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#E8A020;">
      <a href="{{ .ConfirmationURL }}" class="body-font" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:bold;color:#0A0F1E;text-decoration:none;">Confirm new email &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="background-color:#1C2540;padding:26px 36px;">
    <div class="body-font" style="color:#E8A020;font-size:11px;font-weight:bold;letter-spacing:0.22em;text-transform:uppercase;margin-bottom:10px;">An Initiative of The Adewale Foundation</div>
    <div class="body-font" style="color:rgba(240,234,216,0.45);font-size:11px;line-height:18px;">If you didn't request this change, you can safely ignore this email.</div>
  </td></tr>
</table>
<div class="body-font" style="color:rgba(10,15,30,0.45);font-size:11px;letter-spacing:0.06em;padding:18px 0 0;">&copy; 2026 Adewale Students Conference &middot; Ogun State, Nigeria</div>
</td></tr></table></body></html>
```

---

## 5. Reset password

**Subject:** `Reset your password`

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Playfair+Display:ital@1&display=swap" rel="stylesheet">
<style>.display{font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif}.serif{font-family:'Playfair Display',Georgia,serif}.body-font{font-family:Arial,Helvetica,sans-serif}</style>
</head><body style="margin:0;padding:0;background-color:#FAF7F0;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F0;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid rgba(10,15,30,0.10);">
  <tr><td style="background-color:#0A0F1E;padding:30px 36px 26px;">
    <span class="body-font" style="display:inline-block;border:1px solid #E8A020;color:#E8A020;font-size:10px;font-weight:bold;letter-spacing:0.25em;text-transform:uppercase;padding:6px 12px;margin-bottom:18px;">Year Six &middot; Ogun State &middot; 2026</span>
    <div class="display" style="color:#FFFFFF;font-size:30px;letter-spacing:0.06em;line-height:1;text-transform:uppercase;">Adewale Students <span style="color:#E8A020;">Conference</span></div>
  </td></tr>
  <tr><td style="height:4px;line-height:4px;font-size:0;background-color:#E8A020;">&nbsp;</td></tr>
  <tr><td style="padding:38px 36px 32px;">
    <h1 class="display" style="margin:0 0 18px;font-size:38px;line-height:1;letter-spacing:0.03em;color:#0A0F1E;text-transform:uppercase;">Reset your password</h1>
    <p class="body-font" style="margin:0 0 24px;font-size:15px;line-height:24px;color:#4A4E5C;">We received a request to reset the password for <span style="color:#0A0F1E;font-weight:bold;">{{ .Email }}</span>. Tap below to choose a new one.</p>
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background-color:#E8A020;">
      <a href="{{ .ConfirmationURL }}" class="body-font" style="display:inline-block;padding:13px 30px;font-size:14px;font-weight:bold;color:#0A0F1E;text-decoration:none;">Reset password &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="background-color:#1C2540;padding:26px 36px;">
    <div class="body-font" style="color:#E8A020;font-size:11px;font-weight:bold;letter-spacing:0.22em;text-transform:uppercase;margin-bottom:10px;">An Initiative of The Adewale Foundation</div>
    <div class="body-font" style="color:rgba(240,234,216,0.45);font-size:11px;line-height:18px;">If you didn't request this, you can safely ignore this email — your password stays the same.</div>
  </td></tr>
</table>
<div class="body-font" style="color:rgba(10,15,30,0.45);font-size:11px;letter-spacing:0.06em;padding:18px 0 0;">&copy; 2026 Adewale Students Conference &middot; Ogun State, Nigeria</div>
</td></tr></table></body></html>
```

---

## 6. Reauthentication (OTP code)

**Subject:** `Your verification code`

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Playfair+Display:ital@1&display=swap" rel="stylesheet">
<style>.display{font-family:'Bebas Neue','Arial Narrow',Arial,sans-serif}.serif{font-family:'Playfair Display',Georgia,serif}.body-font{font-family:Arial,Helvetica,sans-serif}</style>
</head><body style="margin:0;padding:0;background-color:#FAF7F0;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F0;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid rgba(10,15,30,0.10);">
  <tr><td style="background-color:#0A0F1E;padding:30px 36px 26px;">
    <span class="body-font" style="display:inline-block;border:1px solid #E8A020;color:#E8A020;font-size:10px;font-weight:bold;letter-spacing:0.25em;text-transform:uppercase;padding:6px 12px;margin-bottom:18px;">Year Six &middot; Ogun State &middot; 2026</span>
    <div class="display" style="color:#FFFFFF;font-size:30px;letter-spacing:0.06em;line-height:1;text-transform:uppercase;">Adewale Students <span style="color:#E8A020;">Conference</span></div>
  </td></tr>
  <tr><td style="height:4px;line-height:4px;font-size:0;background-color:#E8A020;">&nbsp;</td></tr>
  <tr><td style="padding:38px 36px 32px;">
    <h1 class="display" style="margin:0 0 18px;font-size:38px;line-height:1;letter-spacing:0.03em;color:#0A0F1E;text-transform:uppercase;">Your verification code</h1>
    <p class="body-font" style="margin:0 0 20px;font-size:15px;line-height:24px;color:#4A4E5C;">Use the code below to verify your identity. It expires shortly.</p>
    <p class="body-font" style="margin:0;font-size:30px;font-weight:bold;letter-spacing:8px;color:#0A0F1E;background:#FBF3E2;border:1px solid #E8A020;padding:18px;text-align:center;font-family:'Courier New',monospace;">{{ .Token }}</p>
  </td></tr>
  <tr><td style="background-color:#1C2540;padding:26px 36px;">
    <div class="body-font" style="color:#E8A020;font-size:11px;font-weight:bold;letter-spacing:0.22em;text-transform:uppercase;margin-bottom:10px;">An Initiative of The Adewale Foundation</div>
    <div class="body-font" style="color:rgba(240,234,216,0.45);font-size:11px;line-height:18px;">If you didn't request this, you can safely ignore this email.</div>
  </td></tr>
</table>
<div class="body-font" style="color:rgba(10,15,30,0.45);font-size:11px;letter-spacing:0.06em;padding:18px 0 0;">&copy; 2026 Adewale Students Conference &middot; Ogun State, Nigeria</div>
</td></tr></table></body></html>
```

# Supabase Auth Email Templates (ASC-branded)

Paste each HTML block into **Supabase → Authentication → Email Templates**, pick the
matching template, and set the **Subject** shown above it. They use Supabase's Go
placeholders (`{{ .ConfirmationURL }}` etc.) and are full, email-safe HTML
(inline styles + tables) so they render in Gmail/Outlook/Apple Mail.

> Brand: navy `#0A0F1E`, gold `#E8A020`, cream `#FAF7F0`. Serif headings (Georgia,
> since Bebas/Playfair don't load in email). Edit the footer line as you like.

---

## 1. Magic Link / OTP

**Subject:** `Your Adewale Students Conference sign-in link`

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F0;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#FFFFFF;border:1px solid #F0EAD8;">
        <tr><td style="background:#0A0F1E;padding:20px 28px;">
          <span style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#FFFFFF;letter-spacing:0.5px;">Adewale <span style="color:#E8A020;">Students Conference</span></span>
        </td></tr>
        <tr><td style="padding:32px 28px;font-family:Arial,Helvetica,sans-serif;">
          <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;color:#0A0F1E;">Your sign-in link</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:24px;color:#4A4E5C;">Follow the link below to sign in to the ASC portal. It expires shortly and can only be used once.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
            <tr><td style="background:#E8A020;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:bold;color:#0A0F1E;text-decoration:none;">Sign in</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;color:#4A4E5C;">Or enter this one-time code:</p>
          <p style="margin:0;font-family:'Courier New',monospace;font-size:26px;font-weight:bold;letter-spacing:5px;color:#0A0F1E;background:#FBF3E2;border:1px solid #E8A020;padding:14px;text-align:center;">{{ .Token }}</p>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #F0EAD8;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a9ba3;line-height:18px;">Adewale Students Conference &middot; Ogun State's flagship STEM competition. If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
```

---

## 2. Confirm sign up

**Subject:** `Confirm your email — Adewale Students Conference`

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F0;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#FFFFFF;border:1px solid #F0EAD8;">
        <tr><td style="background:#0A0F1E;padding:20px 28px;">
          <span style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#FFFFFF;letter-spacing:0.5px;">Adewale <span style="color:#E8A020;">Students Conference</span></span>
        </td></tr>
        <tr><td style="padding:32px 28px;font-family:Arial,Helvetica,sans-serif;">
          <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;color:#0A0F1E;">Confirm your email address</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:24px;color:#4A4E5C;">Follow the link below to confirm <span style="color:#0A0F1E;">{{ .Email }}</span> and finish setting up your ASC portal account.</p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="background:#E8A020;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:bold;color:#0A0F1E;text-decoration:none;">Confirm email address</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #F0EAD8;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a9ba3;line-height:18px;">Adewale Students Conference &middot; Ogun State's flagship STEM competition. If you didn't create an account, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
```

---

## 3. Invite user

**Subject:** `You're invited to the Adewale Students Conference portal`

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F0;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#FFFFFF;border:1px solid #F0EAD8;">
        <tr><td style="background:#0A0F1E;padding:20px 28px;">
          <span style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#FFFFFF;letter-spacing:0.5px;">Adewale <span style="color:#E8A020;">Students Conference</span></span>
        </td></tr>
        <tr><td style="padding:32px 28px;font-family:Arial,Helvetica,sans-serif;">
          <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;color:#0A0F1E;">You've been invited</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:24px;color:#4A4E5C;">You've been invited to join the Adewale Students Conference portal. Follow the link below to accept and create your account.</p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="background:#E8A020;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:bold;color:#0A0F1E;text-decoration:none;">Accept invitation</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #F0EAD8;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a9ba3;line-height:18px;">Adewale Students Conference &middot; Ogun State's flagship STEM competition.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
```

---

## 4. Change email address

**Subject:** `Confirm your new email address`

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F0;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#FFFFFF;border:1px solid #F0EAD8;">
        <tr><td style="background:#0A0F1E;padding:20px 28px;">
          <span style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#FFFFFF;letter-spacing:0.5px;">Adewale <span style="color:#E8A020;">Students Conference</span></span>
        </td></tr>
        <tr><td style="padding:32px 28px;font-family:Arial,Helvetica,sans-serif;">
          <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;color:#0A0F1E;">Confirm your new email</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:24px;color:#4A4E5C;">Follow the link below to confirm <span style="color:#0A0F1E;">{{ .NewEmail }}</span> as the new email address on your ASC portal account.</p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="background:#E8A020;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:bold;color:#0A0F1E;text-decoration:none;">Confirm new email address</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #F0EAD8;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a9ba3;line-height:18px;">Adewale Students Conference. If you didn't request this change, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
```

---

## 5. Reset password

**Subject:** `Reset your password`

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F0;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#FFFFFF;border:1px solid #F0EAD8;">
        <tr><td style="background:#0A0F1E;padding:20px 28px;">
          <span style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#FFFFFF;letter-spacing:0.5px;">Adewale <span style="color:#E8A020;">Students Conference</span></span>
        </td></tr>
        <tr><td style="padding:32px 28px;font-family:Arial,Helvetica,sans-serif;">
          <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;color:#0A0F1E;">Reset your password</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:24px;color:#4A4E5C;">We received a request to reset the password for <span style="color:#0A0F1E;">{{ .Email }}</span>. Follow the link below to choose a new one.</p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="background:#E8A020;">
              <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:bold;color:#0A0F1E;text-decoration:none;">Reset password</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #F0EAD8;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a9ba3;line-height:18px;">Adewale Students Conference. If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
```

---

## 6. Reauthentication (OTP code)

**Subject:** `Your verification code`

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F0;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#FFFFFF;border:1px solid #F0EAD8;">
        <tr><td style="background:#0A0F1E;padding:20px 28px;">
          <span style="font-family:Georgia,serif;font-size:20px;font-weight:bold;color:#FFFFFF;letter-spacing:0.5px;">Adewale <span style="color:#E8A020;">Students Conference</span></span>
        </td></tr>
        <tr><td style="padding:32px 28px;font-family:Arial,Helvetica,sans-serif;">
          <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;color:#0A0F1E;">Your verification code</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#4A4E5C;">Use the code below to verify your identity. It expires shortly.</p>
          <p style="margin:0;font-family:'Courier New',monospace;font-size:30px;font-weight:bold;letter-spacing:8px;color:#0A0F1E;background:#FBF3E2;border:1px solid #E8A020;padding:18px;text-align:center;">{{ .Token }}</p>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #F0EAD8;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9a9ba3;line-height:18px;">Adewale Students Conference. If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
```

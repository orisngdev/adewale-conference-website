-- Per-school registration invites for waitlisted schools.
--
-- The public form is tied to the OPEN edition, so once registration closes
-- nobody can submit. An invite is a single-use pass for exactly one waitlist
-- entry: it prefills the form and lets that one school register into
-- invited_edition_year even while every edition is closed.
--
-- notified_at (the bulk "registration is open" blast) stays what it was;
-- invited_at is the individual pass, and the two are independent.
--
-- The token is only ever read server-side with the service role — same shape
-- as registrations.verify_token. RLS on this table stays admin-only.

alter table public.waitlist
  add column if not exists invite_token            text,
  add column if not exists invite_token_expires_at timestamptz,
  add column if not exists invited_edition_year    int,
  add column if not exists invited_at              timestamptz,
  add column if not exists registration_id         uuid references public.registrations(id) on delete set null,
  add column if not exists converted_at            timestamptz;

-- Partial: a burned/never-issued token is null, and nulls must not collide.
create unique index if not exists waitlist_invite_token_idx
  on public.waitlist (invite_token)
  where invite_token is not null;

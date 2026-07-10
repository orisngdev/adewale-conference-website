-- Per-educator activation: every staged school member (coordinating teacher,
-- principal, …) can carry their OWN single-use 30-day activation token, so each
-- educator activates their own account from their own email — nobody signs up
-- "separately", and nobody sets a password on someone else's account. The
-- registration-level token (…024) remains the teacher's link; member tokens
-- cover additional educators. Read server-side only (service role) — no RLS
-- policy exposes them. Idempotent. Run after …026.

alter table public.school_members add column if not exists full_name text;
alter table public.school_members add column if not exists verify_token text;
alter table public.school_members add column if not exists verify_token_expires_at timestamptz;
alter table public.school_members add column if not exists onboarded_at timestamptz;

create index if not exists school_members_verify_token_idx
  on public.school_members (verify_token) where verify_token is not null;

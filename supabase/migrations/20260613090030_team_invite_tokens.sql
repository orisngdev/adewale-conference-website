-- Team invites v2: the invite email now carries a single-use 256-bit token
-- (same pattern as coordinator activation). The link lands on
-- /portal/team-invite?token=… where the invitee sets their password directly —
-- the account is created pre-verified (clicking the emailed link proves address
-- ownership). The signup trigger from …029 stays as a fallback: signing up
-- normally with a pending invited email still grants the role. Idempotent.
-- Run after …029.

alter table public.team_invites add column if not exists verify_token text;

create index if not exists team_invites_verify_token_idx
  on public.team_invites (verify_token) where verify_token is not null;

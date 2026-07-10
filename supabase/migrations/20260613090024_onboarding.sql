-- Self-service coordinator onboarding (replaces the claim code as the primary
-- path). The public registration email now carries a 30-day verification link;
-- the token lives on the registration and is only ever read server-side with the
-- service role — no RLS policy exposes it. claim_code is kept as the
-- signed-up-with-a-different-email fallback. Idempotent. Run after …023.

alter table public.registrations add column if not exists contact_name text;
alter table public.registrations add column if not exists verify_token text;
alter table public.registrations add column if not exists verify_token_expires_at timestamptz;
alter table public.registrations add column if not exists onboarded_at timestamptz;
alter table public.registrations add column if not exists provisioned_count int;

create index if not exists registrations_verify_token_idx
  on public.registrations (verify_token) where verify_token is not null;

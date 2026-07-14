-- Airtable → portal sync (Airtable stays source of truth; the portal is a
-- synced mirror kept current by lib/airtable-sync). Run in Supabase → SQL
-- Editor. Idempotent.

-- Link registrations back to their Airtable participant record — the sync's
-- idempotency key (schools already carry airtable_id from the bridge).
alter table public.registrations add column if not exists airtable_id text;
create unique index if not exists registrations_airtable_id_key
  on public.registrations (airtable_id) where airtable_id is not null;

-- Full registration payload (student DOBs/genders/guardians, phones, survey
-- answers) exactly as stored in Airtable — field names as keys. Lets the
-- portal render everything without an Airtable read.
alter table public.registrations add column if not exists details jsonb;

-- School contact fields mirrored from the Airtable Schools table.
alter table public.schools add column if not exists address text;
alter table public.schools add column if not exists email text;

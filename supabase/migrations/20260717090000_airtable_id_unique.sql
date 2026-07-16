-- Replace the partial unique indexes on airtable_id with real UNIQUE
-- constraints. Postgres treats NULLs as distinct in unique constraints, so
-- the partial predicate was never needed — and PostgREST upserts
-- (ON CONFLICT (airtable_id)) can only target a full constraint, which the
-- batched Airtable sync relies on. Idempotent.

alter table public.registrations drop constraint if exists registrations_airtable_id_unique;
drop index if exists public.registrations_airtable_id_key;
alter table public.registrations add constraint registrations_airtable_id_unique unique (airtable_id);

alter table public.schools drop constraint if exists schools_airtable_id_unique;
drop index if exists public.schools_airtable_id_key;
alter table public.schools add constraint schools_airtable_id_unique unique (airtable_id);

-- Bulk-update RPCs for the Airtable sync. A PostgREST upsert can't do partial
-- updates (the candidate insert row must satisfy NOT NULL columns like
-- edition_year/status, which the sync must NOT touch — they're admin-owned),
-- so refreshes go through one UPDATE ... FROM jsonb_to_recordset call.
-- Service-role only. Idempotent.

create or replace function public.sync_refresh_registrations(p_rows jsonb)
returns int
language sql
security definer set search_path = public
as $$
  with v as (
    select * from jsonb_to_recordset(p_rows) as x(
      airtable_id   text,
      school_id     uuid,
      reps          jsonb,
      details       jsonb,
      contact_email text,
      contact_name  text
    )
  ), upd as (
    update public.registrations r
    set school_id     = v.school_id,
        reps          = v.reps,
        details       = v.details,
        contact_email = v.contact_email,
        contact_name  = v.contact_name
    from v
    where r.airtable_id = v.airtable_id
    returning 1
  )
  select count(*)::int from upd;
$$;

create or replace function public.sync_retag_students(p_rows jsonb)
returns int
language sql
security definer set search_path = public
as $$
  with v as (
    select * from jsonb_to_recordset(p_rows) as x(
      id           uuid,
      edition_year int,
      level        text
    )
  ), upd as (
    update public.students s
    set edition_year = v.edition_year,
        level        = v.level
    from v
    where s.id = v.id
    returning 1
  )
  select count(*)::int from upd;
$$;

revoke execute on function public.sync_refresh_registrations(jsonb) from public, anon, authenticated;
revoke execute on function public.sync_retag_students(jsonb) from public, anon, authenticated;
grant execute on function public.sync_refresh_registrations(jsonb) to service_role;
grant execute on function public.sync_retag_students(jsonb) to service_role;

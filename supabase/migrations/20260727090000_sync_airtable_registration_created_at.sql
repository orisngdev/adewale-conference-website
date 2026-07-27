-- Keep Airtable-imported registration timestamps aligned with Airtable's
-- creation time. Existing rows are corrected on the next sync refresh.

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
      contact_name  text,
      created_at    timestamptz
    )
  ), upd as (
    update public.registrations r
    set school_id     = v.school_id,
        reps          = v.reps,
        details       = v.details,
        contact_email = v.contact_email,
        contact_name  = v.contact_name,
        created_at    = coalesce(v.created_at, r.created_at)
    from v
    where r.airtable_id = v.airtable_id
    returning 1
  )
  select count(*)::int from upd;
$$;

revoke execute on function public.sync_refresh_registrations(jsonb) from public, anon, authenticated;
grant execute on function public.sync_refresh_registrations(jsonb) to service_role;


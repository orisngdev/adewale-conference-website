-- Bulk allocation of zonal exam centres.
--
-- Allocating 178 schools one row at a time is 178 round trips and 178 chances to
-- half-finish. This applies a whole edition's allocation in one statement.
--
-- The allowed centres are passed IN rather than hardcoded here. ZONAL_FINALS_OPTIONS
-- in src/lib/forms.ts is the single source of that list, and duplicating a constant
-- across TypeScript and SQL is precisely what let this column fill up with LGAs and
-- division names in the first place. The function stays safe because it is
-- admin-only and only ever writes a value the caller declared valid.
--
-- Returns the number of rows actually changed, so the UI can report honestly rather
-- than claiming success for a no-op. Idempotent.

create or replace function public.allocate_qualification_zones(
  p_rows    jsonb,
  p_allowed text[]
)
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_changed int := 0;
begin
  if not public.is_admin() then raise exception 'Not permitted'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a jsonb array of {id, zone}';
  end if;
  if p_allowed is null or cardinality(p_allowed) = 0 then
    raise exception 'p_allowed must list the permitted centres';
  end if;

  with input as (
    select
      (row_value ->> 'id')::uuid              as id,
      nullif(btrim(row_value ->> 'zone'), '') as zone
    from jsonb_array_elements(p_rows) as row_value
  ),
  permitted as (
    -- An empty zone clears the allocation; anything else must be a declared centre,
    -- so a stale LGA can be replaced or cleared but never written back.
    select id, zone from input
    where zone is null or zone = any (p_allowed)
  )
  update public.registrations reg
  set qualification_zone = p.zone
  from permitted p
  where reg.id = p.id
    and reg.qualification_zone is distinct from p.zone;

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$function$;

revoke all on function public.allocate_qualification_zones(jsonb, text[]) from public, anon;
grant execute on function public.allocate_qualification_zones(jsonb, text[]) to authenticated;

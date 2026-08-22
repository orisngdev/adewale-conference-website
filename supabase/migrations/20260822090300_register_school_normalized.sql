-- Stop the portal minting duplicate schools.
--
-- register_school_for_edition matched on an exact name string plus LGA and category:
--
--     where name = p_school
--       and coalesce(lga,'')      = coalesce(p_lga,'')
--       and coalesce(category,'') = coalesce(p_category,'')
--
-- So "Nawair-ud-deen High School" and "NAWAIR UR DEEN HIGH SCHOOL" were two schools,
-- and the same school under a mistyped LGA was a third. This function was one of the
-- five paths that turned 534 schools into 741 rows.
--
-- It now matches on school_norm_name(name) — the same expression as
-- schools_norm_name_key, so a lookup can no longer miss a row that the unique index
-- would then refuse to insert. LGA and category are deliberately NOT part of the
-- match: the duplicate rows disagreed about LGA as often as they agreed, so scoping
-- by it is what let them through.
--
-- Matching more eagerly is also the safer direction here. A coordinator who creates a
-- new school gets an APPROVED membership immediately; one who matches an existing
-- school gets PENDING and waits for an admin. Erring towards matching therefore errs
-- towards review. Idempotent.

create or replace function public.register_school_for_edition(
  p_year     integer,
  p_school   text,
  p_lga      text,
  p_category text,
  p_reps     jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_open       boolean;
  v_school_id  uuid;
  v_reg_id     uuid;
  v_stage      text;
  v_new_school boolean := false;
  v_email      text;
  v_name       text := btrim(coalesce(p_school, ''));
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if v_name = '' then raise exception 'School name is required'; end if;

  select registration_open, current_stage into v_open, v_stage
  from public.editions where year = p_year;
  if not coalesce(v_open, false) then
    raise exception 'Registration is not open for %', p_year;
  end if;

  if exists (select 1 from public.registrations
             where owner_id = auth.uid() and edition_year = p_year) then
    select id into v_reg_id from public.registrations
    where owner_id = auth.uid() and edition_year = p_year limit 1;
    return v_reg_id;
  end if;

  -- Prefer a canonical school, so a coordinator's spelling can never take priority
  -- over a row that carries an ASC- code.
  select id into v_school_id from public.schools
  where public.school_norm_name(name) = public.school_norm_name(v_name)
  order by (school_code is null), created_at
  limit 1;

  if v_school_id is null then
    -- Someone may insert the same name between the select and here; let the unique
    -- index arbitrate rather than raising at the caller.
    insert into public.schools (name, lga, category)
    values (v_name, p_lga, p_category)
    on conflict (public.school_norm_name(name)) do nothing
    returning id into v_school_id;

    if v_school_id is null then
      select id into v_school_id from public.schools
      where public.school_norm_name(name) = public.school_norm_name(v_name)
      order by (school_code is null), created_at
      limit 1;
    else
      v_new_school := true;
    end if;
  end if;

  if v_school_id is null then
    raise exception 'Could not resolve or create school %', v_name;
  end if;

  insert into public.registrations
    (school_id, owner_id, edition_year, status, current_stage, reps)
  values (v_school_id, auth.uid(), p_year, 'submitted', v_stage, p_reps)
  returning id into v_reg_id;

  select email into v_email from public.profiles where id = auth.uid();
  insert into public.school_members (school_id, email, profile_id, status)
  values (v_school_id, v_email, auth.uid(),
          case when v_new_school then 'approved' else 'pending' end)
  on conflict (school_id, email) do nothing;

  return v_reg_id;
end;
$function$;

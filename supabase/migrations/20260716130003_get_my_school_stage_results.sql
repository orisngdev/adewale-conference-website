-- get_my_school: expose the registration id and its per-stage results, so the
-- resource-tier gate can be DERIVED from competition progress (tierRank in
-- resource-access.ts) instead of the registration status flag. Purely additive —
-- existing consumers keep reading edition_year / status and ignore the rest.
create or replace function public.get_my_school()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with me as (
    select coalesce(
      (select school_id from public.students
         where auth_user_id = auth.uid() and school_id is not null limit 1),
      (select school_id from public.registrations
         where owner_id = auth.uid() order by edition_year desc limit 1),
      (select sid from public.my_school_ids() sid limit 1)
    ) as school_id
  )
  select case when m.school_id is null then null else jsonb_build_object(
    'school', (
      select jsonb_build_object('id', s.id, 'name', s.name, 'lga', s.lga, 'category', s.category)
      from public.schools s where s.id = m.school_id
    ),
    'coordinators', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.full_name, 'email', sm.email)
                       order by p.full_name nulls last)
      from public.school_members sm
      left join public.profiles p on p.id = sm.profile_id
      where sm.school_id = m.school_id and sm.status = 'approved'
    ), '[]'::jsonb),
    'student_count', (
      select count(*) from public.students st
      where st.school_id = m.school_id and st.deactivated_at is null
    ),
    'registration', (
      select jsonb_build_object(
        'id', r.id,
        'edition_year', r.edition_year,
        'status', r.status,
        'stage_results', coalesce((
          select jsonb_agg(jsonb_build_object('stage', sr.stage, 'outcome', sr.outcome))
          from public.registration_stage_results sr
          where sr.registration_id = r.id
        ), '[]'::jsonb)
      )
      from public.registrations r
      where r.school_id = m.school_id
      order by r.edition_year desc limit 1
    )
  ) end
  from me m;
$$;
grant execute on function public.get_my_school() to authenticated;

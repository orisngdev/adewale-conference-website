-- A Student's own school + its coordinators + registration status, for the
-- "My school" page. SECURITY DEFINER because school_members / profiles are
-- self-read only at the RLS level — a student can't otherwise see their teacher.
-- Resolves the school from the provisioned students row, else the latest
-- registration the user owns. Idempotent. Run after …020.

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
         where owner_id = auth.uid() order by edition_year desc limit 1)
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
      select count(*) from public.students st where st.school_id = m.school_id
    ),
    'registration', (
      select jsonb_build_object('edition_year', r.edition_year, 'status', r.status)
      from public.registrations r
      where r.school_id = m.school_id
      order by r.edition_year desc limit 1
    )
  ) end
  from me m;
$$;

grant execute on function public.get_my_school() to authenticated;

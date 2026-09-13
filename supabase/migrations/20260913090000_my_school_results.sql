-- The competition record a school and its reps are entitled to see, read from
-- the portal's own tables. Idempotent.
--
-- This exists because the "results" a coordinator and a student were shown came
-- from a hand-authored CMS collection that nothing has ever published into, so
-- the section was permanently empty while registration_stage_results held the
-- real thing: every school's score, rank and outcome at each stage.
--
-- An RPC rather than a policy. A code-login student is not a school_member, so
-- my_school_ids() does not cover them, and widening reg_member_read to reach
-- them would hand every rep the registration row entire — contact email, phone
-- and the whole `details` payload. This returns the standings and nothing else.
create or replace function public.get_my_school_results()
returns jsonb
language plpgsql security definer set search_path = public stable
as $$
declare
  v_schools uuid[];
  v_out     jsonb;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;

  -- Both ways of belonging to a school: an approved coordinator or teacher, and
  -- a rep whose account was provisioned from an access code.
  select array_agg(distinct id) into v_schools
  from (
    select id from public.my_school_ids() id
    union
    select s.school_id
    from public.students s
    where s.auth_user_id = auth.uid() and s.school_id is not null
  ) mine
  where id is not null;

  if v_schools is null or cardinality(v_schools) = 0 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(payload order by edition_year desc), '[]'::jsonb)
  into v_out
  from (
    select r.edition_year,
           jsonb_build_object(
             'registration_id', r.id,
             'edition_year',    r.edition_year,
             'school_name',     sc.name,
             'centre',          r.qualification_zone,
             'results', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'stage',      sr.stage,
                        'outcome',    sr.outcome,
                        'score',      sr.score,
                        'score_max',  sr.score_max,
                        'lga_rank',   sr.lga_rank,
                        'state_rank', sr.state_rank,
                        'reason',     sr.reason,
                        'note',       sr.note))
               from public.registration_stage_results sr
               where sr.registration_id = r.id
             ), '[]'::jsonb)
           ) as payload
    from public.registrations r
    join public.schools sc on sc.id = r.school_id
    where r.school_id = any (v_schools)
      and r.status = 'verified'
  ) x;

  return v_out;
end $$;

revoke all on function public.get_my_school_results() from public, anon;
grant execute on function public.get_my_school_results() to authenticated;

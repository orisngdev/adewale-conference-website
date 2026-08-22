-- Find school rows that are probably one school recorded twice.
--
-- Name similarity is the obvious approach and it is the wrong one: over 532 canonical
-- schools it returns 247 pairs above 80% similarity, almost all of them genuinely
-- different schools sharing generic words — IGBUSI, ẸGBA, ODUA, ABOBI and FAITH
-- COMPREHENSIVE HIGH SCHOOL are five real schools, and the four ADEDOKUN campuses each
-- field their own team.
--
-- What actually identified the two real leftovers was a sharper signal: two rows that
-- share a coordinator and NEVER competed in the same year. A school group with several
-- campuses shares staff but enters every year in parallel; one school recorded twice
-- has its history split across the pair with no overlap. That found ASERO HIGH SCHOOL
-- (2022-23 + 2024) and PATTERSON MEMORIAL, whose 2023 registration sat under a
-- person's name, out of 11 candidates — the other 9 being teachers who simply changed
-- school between editions.
--
-- Sharing the school's own email as well is the strongest form of the signal, so it is
-- reported and sorted on. Idempotent.

create or replace function public.school_duplicate_candidates()
returns table (
  a_id uuid,
  a_name text,
  a_school_code text,
  a_years int[],
  b_id uuid,
  b_name text,
  b_school_code text,
  b_years int[],
  shared_coordinators int,
  same_school_email boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with member as (
    select school_id, lower(btrim(email)) as email from public.school_members
  ),
  pair as (
    select x.school_id as a_id, y.school_id as b_id, count(*)::int as shared
    from member x
    join member y on x.email = y.email and x.school_id < y.school_id
    group by 1, 2
  ),
  years as (
    select school_id, array_agg(distinct edition_year order by edition_year) as years
    from public.registrations where school_id is not null group by school_id
  )
  select
    p.a_id, sa.name, sa.school_code, coalesce(ya.years, '{}'),
    p.b_id, sb.name, sb.school_code, coalesce(yb.years, '{}'),
    p.shared,
    coalesce(sa.email is not null and lower(btrim(sa.email)) = lower(btrim(sb.email)), false)
  from pair p
  join public.schools sa on sa.id = p.a_id
  join public.schools sb on sb.id = p.b_id
  left join years ya on ya.school_id = p.a_id
  left join years yb on yb.school_id = p.b_id
  -- No shared edition: the histories sit side by side rather than competing.
  where not (coalesce(ya.years, '{}') && coalesce(yb.years, '{}'))
    and public.is_admin()
  order by
    coalesce(sa.email is not null and lower(btrim(sa.email)) = lower(btrim(sb.email)), false) desc,
    p.shared desc,
    sa.name;
$function$;

revoke all on function public.school_duplicate_candidates() from public, anon;
grant execute on function public.school_duplicate_candidates() to authenticated;

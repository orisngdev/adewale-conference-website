-- Batch fixes (2026-07-16): resource audience, gated-download resolver, and a
-- structural guard against duplicate students. Idempotent.

-- ── 1. Resource audience ────────────────────────────────────────────────────
-- Who a resource is for. Students only see student-facing rows in their portal;
-- coordinators (and admins) see everything, so they can attach any material to a
-- Learning Plan. 'coordinator' = hidden from students (e.g. a coach handbook).
alter table public.resources
  add column if not exists audience text not null default 'both'
    check (audience in ('student', 'coordinator', 'both'));

-- ── 2. get_my_school: resolve via membership too ────────────────────────────
-- A coordinator who is an approved school_member but NOT the registration owner
-- (e.g. the principal, or any Airtable-synced educator) previously resolved to
-- NULL here — so gated resource downloads 403'd even for an accepted school.
-- Add my_school_ids() as the final fallback so the tier gate sees their school.
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
      select jsonb_build_object('edition_year', r.edition_year, 'status', r.status)
      from public.registrations r
      where r.school_id = m.school_id
      order by r.edition_year desc limit 1
    )
  ) end
  from me m;
$$;
grant execute on function public.get_my_school() to authenticated;

-- ── 3. One active student per (school, name) — structural ───────────────────
-- provisionStudent already treats a returning name in a school as the same
-- human (reuse-by-name), but that invariant lived only in app code and a race
-- between two onboarding flows (teacher + principal) could still double-provision.
-- Enforce it in the schema. First retire existing duplicates — keep the earliest
-- active row per (school, lower(name)); the extras are deactivated, not deleted,
-- preserving history (their access codes were never the canonical ones).
with ranked as (
  select id,
         row_number() over (
           partition by school_id, lower(name)
           order by created_at asc, id asc
         ) as rn
  from public.students
  where deactivated_at is null
)
update public.students s
set deactivated_at = now()
from ranked r
where s.id = r.id and r.rn > 1;

create unique index if not exists students_active_name_uniq
  on public.students (school_id, lower(name))
  where deactivated_at is null;

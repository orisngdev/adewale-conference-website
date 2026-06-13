-- School membership: the school is the unit; coordinators are members (by email).
-- Access to a school's registrations requires an APPROVED membership. Run in the
-- Supabase SQL editor after supabase-editions.sql. Idempotent.

create table if not exists public.school_members (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools on delete cascade,
  email      text not null,
  profile_id uuid references public.profiles on delete set null,
  status     text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  unique (school_id, email)
);
create index if not exists school_members_email_idx on public.school_members (lower(email));
create index if not exists school_members_profile_idx on public.school_members (profile_id);

-- Approved school_ids for the current user — matched by linked profile OR by the
-- email on their profile (so a membership staged at registration links up on signup).
create or replace function public.my_school_ids()
returns setof uuid
language sql security definer set search_path = public stable
as $$
  select sm.school_id
  from public.school_members sm
  where sm.status = 'approved'
    and (
      sm.profile_id = auth.uid()
      or lower(sm.email) = lower((select email from public.profiles where id = auth.uid()))
    );
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.school_members enable row level security;
drop policy if exists "members_self_read" on public.school_members;
drop policy if exists "members_admin_all" on public.school_members;
create policy "members_self_read" on public.school_members for select using (
  profile_id = auth.uid()
  or lower(email) = lower((select email from public.profiles where id = auth.uid()))
  or public.is_admin()
);
create policy "members_admin_all" on public.school_members
  for all using (public.is_admin()) with check (public.is_admin());

-- Approved members can read their school's registrations (added alongside the
-- existing owner/admin read policies — SELECT policies are OR'd together).
drop policy if exists "reg_member_read" on public.registrations;
create policy "reg_member_read" on public.registrations for select using (
  school_id in (select public.my_school_ids())
);

-- ── In-portal registration, now membership-aware ────────────────────────────
-- A logged-in coordinator registers their school for an open edition. New school
-- → they become an APPROVED founding member; existing school → membership PENDING
-- admin approval (matches the public-form policy).
create or replace function public.register_school_for_edition(
  p_year int, p_school text, p_lga text, p_category text, p_reps jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_open boolean;
  v_school_id uuid;
  v_reg_id uuid;
  v_stage text;
  v_new_school boolean := false;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

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

  select id into v_school_id from public.schools
  where name = p_school
    and coalesce(lga,'') = coalesce(p_lga,'')
    and coalesce(category,'') = coalesce(p_category,'') limit 1;
  if v_school_id is null then
    insert into public.schools (name, lga, category)
    values (p_school, p_lga, p_category) returning id into v_school_id;
    v_new_school := true;
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
$$;

grant execute on function public.register_school_for_edition(int, text, text, text, jsonb) to authenticated;

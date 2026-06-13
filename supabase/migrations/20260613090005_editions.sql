-- Edition operational state + portal-native registration. Run in Supabase SQL
-- editor (after supabase-schema.sql + supabase-bridge.sql). Idempotent.
-- Content of an edition lives in Sanity; this is the operational side: whether
-- registration is open, the ordered stages, and which stage the edition is at.

create table if not exists public.editions (
  year              int primary key,
  title             text,
  registration_open boolean not null default false,
  stages            text[] not null
                    default array['Registration','Zonal Stage','Grand Finale','Completed'],
  current_stage     text not null default 'Registration',
  created_at        timestamptz not null default now()
);

-- A school's own progression marker within its registration.
alter table public.registrations add column if not exists current_stage text;

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table public.editions enable row level security;
drop policy if exists "editions_read"        on public.editions;
drop policy if exists "editions_admin_write" on public.editions;
-- Edition stage/registration state is non-sensitive — readable by anyone.
create policy "editions_read" on public.editions for select using (true);
create policy "editions_admin_write" on public.editions
  for all using (public.is_admin()) with check (public.is_admin());

-- ── Portal-native registration ──────────────────────────────────────────────
-- A signed-in coordinator registers their school for an open edition. The new
-- registration is owned by them (no claim). SECURITY DEFINER so it can create
-- the school row past RLS, but it only ever acts for the caller (auth.uid()).
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
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select registration_open, current_stage into v_open, v_stage
  from public.editions where year = p_year;
  if not coalesce(v_open, false) then
    raise exception 'Registration is not open for %', p_year;
  end if;

  -- One registration per coordinator per edition.
  select id into v_reg_id from public.registrations
  where owner_id = auth.uid() and edition_year = p_year limit 1;
  if v_reg_id is not null then return v_reg_id; end if;

  -- Find-or-create the school.
  select id into v_school_id from public.schools
  where name = p_school
    and coalesce(lga,'') = coalesce(p_lga,'')
    and coalesce(category,'') = coalesce(p_category,'') limit 1;
  if v_school_id is null then
    insert into public.schools (name, lga, category)
    values (p_school, p_lga, p_category) returning id into v_school_id;
  end if;

  insert into public.registrations
    (school_id, owner_id, edition_year, status, current_stage, reps)
  values (v_school_id, auth.uid(), p_year, 'submitted', v_stage, p_reps)
  returning id into v_reg_id;
  return v_reg_id;
end;
$$;

grant execute on function public.register_school_for_edition(int, text, text, text, jsonb) to authenticated;

-- Seed the current edition (closed by default; admin opens it from the portal).
insert into public.editions (year, title, registration_open, current_stage)
values (2026, 'Building Tomorrow''s Geniuses', false, 'Registration')
on conflict (year) do nothing;

-- ASC Portal schema (Phase 5). Run in Supabase → SQL Editor.
-- Implements docs/platform-roadmap.md §3.2: profiles, schools, registrations, certificates.
-- Idempotent — safe to run more than once.

-- ── Roles ──────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('student', 'coordinator', 'admin');
  end if;
end $$;

-- ── profiles: one row per auth user, created automatically on sign-up ────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  role       user_role not null default 'student',
  full_name  text,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── schools ──────────────────────────────────────────────────────────────────
create table if not exists public.schools (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  lga        text,
  category   text,
  created_at timestamptz not null default now()
);

-- ── registrations ────────────────────────────────────────────────────────────
create table if not exists public.registrations (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid references public.schools on delete set null,
  owner_id     uuid references public.profiles on delete set null,
  edition_year int not null,
  status       text not null default 'submitted'
               check (status in ('submitted', 'verified', 'qualified', 'finalist')),
  reps         jsonb not null default '[]',
  created_at   timestamptz not null default now()
);

create index if not exists registrations_owner_idx on public.registrations (owner_id);
create index if not exists registrations_school_idx on public.registrations (school_id);

-- ── certificates ──────────────────────────────────────────────────────────────
create table if not exists public.certificates (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid references public.registrations on delete cascade,
  type            text,
  asset_url       text,
  created_at      timestamptz not null default now()
);

-- ── Row-level security ────────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.schools       enable row level security;
alter table public.registrations enable row level security;
alter table public.certificates  enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profiles_self_read"    on public.profiles;
drop policy if exists "profiles_self_update"  on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_self_read"    on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles_self_update"  on public.profiles for update using (id = auth.uid());
-- Admins can change any profile's role (used by the admin Users page).
create policy "profiles_admin_update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "schools_read"  on public.schools;
drop policy if exists "schools_write" on public.schools;
create policy "schools_read"  on public.schools for select using (auth.role() = 'authenticated');
create policy "schools_write" on public.schools for all    using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reg_owner_read"   on public.registrations;
drop policy if exists "reg_owner_insert" on public.registrations;
drop policy if exists "reg_owner_update" on public.registrations;
create policy "reg_owner_read"   on public.registrations for select using (owner_id = auth.uid() or public.is_admin());
create policy "reg_owner_insert" on public.registrations for insert with check (owner_id = auth.uid());
create policy "reg_owner_update" on public.registrations for update using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "cert_owner_read"  on public.certificates;
drop policy if exists "cert_admin_write" on public.certificates;
create policy "cert_owner_read" on public.certificates for select using (
  public.is_admin() or exists (
    select 1 from public.registrations r
    where r.id = registration_id and r.owner_id = auth.uid()
  )
);
create policy "cert_admin_write" on public.certificates for all using (public.is_admin()) with check (public.is_admin());

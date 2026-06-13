-- Students: coordinator-provisioned, code-login (no email). Each student maps to
-- a Supabase auth user with a synthetic email + the access code as password, so
-- they sign in by typing only their code. Run after school_members. Idempotent.

create table if not exists public.students (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools on delete cascade,
  name         text not null,
  level        text,
  access_code  text not null unique,
  auth_email   text not null,
  auth_user_id uuid references auth.users on delete set null,
  edition_year int,
  created_at   timestamptz not null default now()
);
create index if not exists students_school_idx on public.students (school_id);
create index if not exists students_auth_idx on public.students (auth_user_id);

alter table public.students enable row level security;

-- A student reads their own row; approved members of the school read its students;
-- admins read all. Writes happen via the service-role key (provisioning), so
-- direct table writes are limited to admins.
drop policy if exists "students_read"        on public.students;
drop policy if exists "students_admin_write" on public.students;
create policy "students_read" on public.students for select using (
  auth_user_id = auth.uid()
  or public.is_admin()
  or school_id in (select public.my_school_ids())
);
create policy "students_admin_write" on public.students
  for all using (public.is_admin()) with check (public.is_admin());

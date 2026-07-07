-- Study-pack download log. The files themselves live on the Sanity CDN (public,
-- free content — ADR 0005); Supabase only records who opened/downloaded what, to
-- power a Student's progress and admin analytics. resource_id is the Sanity
-- document _id (text, not an FK). Idempotent. Run after …015.

create table if not exists public.resource_downloads (
  id              uuid primary key default gen_random_uuid(),
  resource_id     text not null,                          -- Sanity document _id
  student_user_id uuid not null references auth.users on delete cascade,
  event           text not null default 'download' check (event in ('view','download')),
  created_at      timestamptz not null default now()
);
create index if not exists resource_downloads_user_idx
  on public.resource_downloads (student_user_id, resource_id);
create index if not exists resource_downloads_resource_idx
  on public.resource_downloads (resource_id);

alter table public.resource_downloads enable row level security;
drop policy if exists "resource_downloads_self"       on public.resource_downloads;
drop policy if exists "resource_downloads_staff_read" on public.resource_downloads;
-- Student writes/reads own rows.
create policy "resource_downloads_self" on public.resource_downloads for all
  using (student_user_id = auth.uid()) with check (student_user_id = auth.uid());
-- Coordinators read their school's students'; admins read all.
create policy "resource_downloads_staff_read" on public.resource_downloads for select using (
  public.is_admin() or student_user_id in (
    select auth_user_id from public.students
    where school_id in (select public.my_school_ids())
  )
);

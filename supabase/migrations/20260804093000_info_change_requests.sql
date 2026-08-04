-- Educator-initiated correction requests for a school's contact details (the
-- coordinating teacher / principal name or phone). Mirrors student_replacements:
-- a member files a request with a required reason; an admin approves (applying
-- the change) or declines (with a note). Email changes are intentionally NOT
-- here — those carry auth/membership side effects and stay admin-only via the
-- registration contact editor.
create table if not exists public.info_change_requests (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations on delete cascade,
  school_id       uuid not null references public.schools on delete cascade,
  target          text not null check (target in ('teacher', 'principal')),
  new_name        text,
  new_phone       text,
  reason          text not null check (btrim(reason) <> ''),
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'declined')),
  admin_note      text,
  requested_by    uuid references public.profiles,
  reviewed_by     uuid references public.profiles,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists info_change_requests_status_idx
  on public.info_change_requests (status, created_at);
create index if not exists info_change_requests_school_idx
  on public.info_change_requests (school_id);

alter table public.info_change_requests enable row level security;

-- Approved members of the school (or admins) file + read their school's requests;
-- only admins can act on them.
drop policy if exists "icr_read"         on public.info_change_requests;
drop policy if exists "icr_insert"       on public.info_change_requests;
drop policy if exists "icr_admin_update" on public.info_change_requests;
create policy "icr_read" on public.info_change_requests for select using (
  public.is_admin() or school_id in (select public.my_school_ids())
);
create policy "icr_insert" on public.info_change_requests for insert with check (
  public.is_admin() or school_id in (select public.my_school_ids())
);
create policy "icr_admin_update" on public.info_change_requests for update
  using (public.is_admin()) with check (public.is_admin());

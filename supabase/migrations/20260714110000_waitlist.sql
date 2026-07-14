-- Waitlist: schools that want in while registration is closed. Public inserts
-- go through /api/waitlist with the service role (rate-limited + validated);
-- the table itself is admin-only. Idempotent.

create table if not exists public.waitlist (
  id            uuid primary key default gen_random_uuid(),
  school_name   text not null,
  lga           text,
  category      text,
  contact_name  text not null,
  contact_email text not null,
  phone         text,
  notified_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- One entry per school+contact — re-submitting is a no-op.
create unique index if not exists waitlist_school_contact_key
  on public.waitlist (lower(school_name), lower(contact_email));

alter table public.waitlist enable row level security;

drop policy if exists "waitlist_admin" on public.waitlist;
create policy "waitlist_admin" on public.waitlist
  for all using (public.is_admin()) with check (public.is_admin());

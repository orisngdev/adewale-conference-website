-- Admin-composed broadcasts to educators (coordinating teachers + principals).
-- Until now every "announcement" was hardcoded: sendRegistrationStatusAnnouncement
-- could only say registration is open/closed, and notify_edition_stage fires a
-- fixed stage string. Anything else — a venue change, a deadline reminder, a
-- circular with a PDF — had to leave someone's personal inbox.
--
-- Students are deliberately out of scope: they sign in with an access code against
-- a synthetic auth_email (student.<code>@students.adewaleconference.local) and have
-- no reachable inbox. The exclusion is structural rather than a filter — every read
-- path goes through my_school_ids(), which matches on school_members, and students
-- never have a membership row.
--
-- Both channels (email + the in-portal bell) resolve from ONE recipient list in
-- src/lib/announcement-recipients.ts, so nobody can get the email but miss the
-- portal copy — the bug getSchoolAudience was written to prevent. Idempotent.

create table if not exists public.announcements (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null check (btrim(title) <> ''),
  body               text not null check (btrim(body) <> ''),   -- markdown
  channels           text not null default 'both'
                       check (channels in ('email', 'in_app', 'both')),
  -- Best-effort narrowing. school_members has no role column, so teacher vs
  -- principal is derived at send time from registrations.details; 'all' is the
  -- honest default. See the note in announcement-recipients.ts.
  target_role        text not null default 'all'
                       check (target_role in ('all', 'teacher', 'principal')),
  -- null = every edition. No ON DELETE action on purpose: silently widening a
  -- year-scoped announcement to "everyone" is worse than erroring.
  edition_year       int references public.editions(year),
  status             text not null default 'draft'
                       check (status in ('draft', 'sent')),
  created_by         uuid references public.profiles(id) on delete set null,
  sent_by            uuid references public.profiles(id) on delete set null,
  sent_at            timestamptz,
  recipient_count    int not null default 0,
  email_sent_count   int not null default 0,
  email_failed_count int not null default 0,
  notified_count     int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- The lifecycle is unfalsifiable here, not just in the server action.
  constraint announcements_sent_shape check (
    (status = 'draft' and sent_at is null)
    or (status = 'sent' and sent_at is not null)
  )
);

create index if not exists announcements_status_idx
  on public.announcements (status, sent_at desc);
create index if not exists announcements_edition_idx
  on public.announcements (edition_year);

-- A child table rather than a jsonb array: the gated download route needs a
-- stable per-file id in its URL, RLS can name a child row in one `exists` (it
-- cannot address a jsonb array element), and removing one attachment from a
-- draft stays a plain delete + the resourceStorage.remove cleanup that
-- deleteResource already proves out.
create table if not exists public.announcement_attachments (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements on delete cascade,
  storage_key     text not null,
  file_name       text not null,
  content_type    text,
  size_bytes      bigint not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists announcement_attachments_announcement_idx
  on public.announcement_attachments (announcement_id);

-- ── Shared read predicate ───────────────────────────────────────────────────
-- One definition of "may this user read this announcement", so the announcement
-- policy and the attachment policy can never drift apart. SECURITY DEFINER so it
-- can inspect the row while being called FROM that row's own policy (a definer
-- function runs with the owner's rights, so there is no policy recursion). It
-- returns a bare boolean, so nothing leaks through it.
--
-- target_role is deliberately NOT part of this predicate: narrowing who gets
-- emailed/notified is a send-time decision, but any educator at a targeted school
-- may read a sent announcement in the portal.
--
-- Mirrors resolveEducatorRecipients() in src/lib/announcement-recipients.ts —
-- keep the two in step.
create or replace function public.can_read_announcement(p_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
stable
as $function$
  select exists (
    select 1 from public.announcements a
    where a.id = p_id
      and a.status = 'sent'
      and (
        (a.edition_year is null and exists (select 1 from public.my_school_ids()))
        or (a.edition_year is not null and exists (
              select 1 from public.registrations r
              where r.edition_year = a.edition_year
                and r.school_id in (select public.my_school_ids())
           ))
      )
  );
$function$;

revoke all on function public.can_read_announcement(uuid) from public, anon;
grant execute on function public.can_read_announcement(uuid) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Stricter than the repo's usual is_admin(): a broadcast tool must respect the
-- view/manage split BELOW the app layer too, for the same reason spelled out in
-- 20260822091000_module_permission_guards.sql.
alter table public.announcements            enable row level security;
alter table public.announcement_attachments enable row level security;

drop policy if exists announcements_admin_read    on public.announcements;
drop policy if exists announcements_admin_write   on public.announcements;
drop policy if exists announcements_educator_read on public.announcements;

create policy announcements_admin_read on public.announcements for select
  to authenticated using (public.has_module_view('announcements'));

create policy announcements_admin_write on public.announcements for all
  to authenticated
  using (public.has_module_manage('announcements'))
  with check (public.has_module_manage('announcements'));

create policy announcements_educator_read on public.announcements for select
  to authenticated using (public.can_read_announcement(id));

drop policy if exists ann_attachments_admin_write on public.announcement_attachments;
drop policy if exists ann_attachments_read        on public.announcement_attachments;

create policy ann_attachments_admin_write on public.announcement_attachments for all
  to authenticated
  using (public.has_module_manage('announcements'))
  with check (public.has_module_manage('announcements'));

create policy ann_attachments_read on public.announcement_attachments for select
  to authenticated using (
    public.has_module_view('announcements')
    or public.can_read_announcement(announcement_id)
  );

-- In-portal notifications + stage-advance fan-out. Run in the Supabase SQL editor
-- after supabase-editions.sql + supabase-school-members.sql. Idempotent.

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles on delete cascade,
  title      text not null,
  body       text,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_profile_idx
  on public.notifications (profile_id, read, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notif_self_read"   on public.notifications;
drop policy if exists "notif_self_update" on public.notifications;
drop policy if exists "notif_admin_write" on public.notifications;
create policy "notif_self_read"   on public.notifications for select using (profile_id = auth.uid() or public.is_admin());
create policy "notif_self_update" on public.notifications for update using (profile_id = auth.uid());
create policy "notif_admin_write" on public.notifications for all using (public.is_admin()) with check (public.is_admin());

-- Fan out a notification to everyone tied to an edition: in-portal registrants
-- (registration owners) + approved members of any school registered that year.
-- SECURITY DEFINER so it can insert rows for other users; admin-only to call.
create or replace function public.notify_edition_stage(p_year int)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_stage text;
  v_count int;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  select current_stage into v_stage from public.editions where year = p_year;

  with recipients as (
    select distinct pid from (
      select owner_id as pid
      from public.registrations
      where edition_year = p_year and owner_id is not null
      union
      select sm.profile_id as pid
      from public.school_members sm
      where sm.status = 'approved' and sm.profile_id is not null
        and sm.school_id in (
          select school_id from public.registrations where edition_year = p_year
        )
    ) r
    where pid is not null
  )
  insert into public.notifications (profile_id, title, body, link)
  select
    pid,
    'Stage update — ' || p_year,
    'The ' || p_year || ' edition has advanced to "' || coalesce(v_stage, '') || '".',
    '/portal'
  from recipients;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.notify_edition_stage(int) to authenticated;

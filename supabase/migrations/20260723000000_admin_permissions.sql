-- Migration to add admin_role and permissions (JSONB permissions map) to profiles and team_invites.
-- Supports 3 access levels per module: "none" | "view" | "manage"

alter table public.profiles
  add column if not exists admin_role text default null,
  add column if not exists permissions jsonb default null;

alter table public.team_invites
  add column if not exists admin_role text default 'super_admin',
  add column if not exists permissions jsonb default null;

-- Update handle_new_user() trigger to pass along admin_role and permissions
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  admin_emails text[] := array[
    'oris@joinoris.com',
    'destinyerhabor6@gmail.com',
    'adewaleconference@gmail.com'
  ];
  v_role user_role := 'student';
  v_invite_role user_role;
  v_admin_role text;
  v_permissions jsonb;
begin
  select role, admin_role, permissions into v_invite_role, v_admin_role, v_permissions
  from public.team_invites
  where lower(email) = lower(new.email)
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if new.email = any(admin_emails) then
    v_role := 'admin';
    v_admin_role := 'super_admin';
  elsif v_invite_role is not null then
    v_role := v_invite_role;
  elsif exists (
    select 1 from public.registrations
    where contact_email = new.email and owner_id is null
  ) or exists (
    select 1 from public.school_members
    where lower(email) = lower(new.email)
  ) then
    v_role := 'coordinator';
  end if;

  insert into public.profiles (id, email, full_name, role, admin_role, permissions)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', v_role, v_admin_role, v_permissions);

  if v_invite_role is not null then
    update public.team_invites
    set accepted_at = now(), accepted_by = new.id
    where lower(email) = lower(new.email) and accepted_at is null;
  end if;

  -- Auto-link any unclaimed registrations that match their email.
  update public.registrations
  set owner_id = new.id
  where contact_email = new.email and owner_id is null;

  return new;
end;
$$;

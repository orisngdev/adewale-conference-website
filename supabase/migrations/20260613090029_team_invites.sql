-- Team invites: an admin invites a teammate by email with a role (admin or
-- coordinator). The invitee just creates an account / signs in with that email
-- — the signup trigger consumes the pending invite and assigns the role, so
-- there's no separate token flow; email ownership is proven by Supabase auth.
-- If the email already has a profile, the invite action promotes it directly.
-- REPLACES handle_new_user from …026 (same body + the invite clause).
-- 👉 keep the admin list in sync with …002/…004/…026. Idempotent. Run after …028.

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role user_role not null default 'admin',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null
);

-- One pending invite per email at a time.
create unique index if not exists team_invites_pending_email_idx
  on public.team_invites (lower(email)) where accepted_at is null;

alter table public.team_invites enable row level security;

drop policy if exists team_invites_admin_all on public.team_invites;
create policy team_invites_admin_all on public.team_invites
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Signup trigger: admin allowlist > pending team invite > staged educator > student.
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
begin
  select role into v_invite_role
  from public.team_invites
  where lower(email) = lower(new.email)
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if new.email = any(admin_emails) then
    v_role := 'admin';
  elsif v_invite_role is not null then
    v_role := v_invite_role;
  elsif exists (
    select 1 from public.registrations
    where contact_email = new.email and owner_id is null
  ) or exists (
    -- Staged as a school educator (teacher or principal) by a registration.
    select 1 from public.school_members
    where lower(email) = lower(new.email)
  ) then
    v_role := 'coordinator';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', v_role);

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

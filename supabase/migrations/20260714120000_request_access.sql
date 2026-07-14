-- Educator self-signup: a signed-in user (no claim code) picks their school
-- and requests access → pending school_members row → the existing admin
-- approval queue on Portal → Schools. SECURITY DEFINER because members RLS is
-- self-read/admin-write; the RPC only ever acts for auth.uid(). Idempotent.

create or replace function public.request_school_access(p_school_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_email  text;
  v_name   text;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select lower(email), full_name into v_email, v_name
  from public.profiles where id = auth.uid();
  if v_email is null or v_email = '' then
    raise exception 'Your account has no email address';
  end if;

  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'Unknown school';
  end if;

  -- New request → pending + a heads-up for every admin. Re-submitting (or
  -- requesting a school that already staged this email) just reports the
  -- current status instead of duplicating.
  insert into public.school_members (school_id, email, full_name, profile_id, status)
  values (p_school_id, v_email, v_name, auth.uid(), 'pending')
  on conflict (school_id, email) do nothing
  returning status into v_status;

  if v_status is not null then
    insert into public.notifications (profile_id, title, body, link)
    select p.id, 'School access request',
           coalesce(v_name, v_email) || ' requested access to ' ||
             coalesce((select name from public.schools where id = p_school_id), 'a school'),
           '/portal/admin/schools'
    from public.profiles p where p.role = 'admin';
    return 'pending';
  end if;

  -- Existing row: make sure it's linked to this account, then report status.
  update public.school_members
  set profile_id = auth.uid()
  where school_id = p_school_id and email = v_email and profile_id is null;

  select status into v_status
  from public.school_members
  where school_id = p_school_id and email = v_email;
  return coalesce(v_status, 'pending');
end;
$$;

grant execute on function public.request_school_access(uuid) to authenticated;

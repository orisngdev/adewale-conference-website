-- Claim-by-code now grants APPROVED school membership (the code from the
-- confirmation email is proof of legitimacy, so no admin approval needed).
-- Run after supabase-school-members.sql. Idempotent — supersedes the earlier
-- claim_registration in supabase-bridge.sql.

create or replace function public.claim_registration(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_reg uuid;
  v_school uuid;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select id, school_id into v_reg, v_school
  from public.registrations where claim_code = p_code limit 1;
  if v_reg is null then return null; end if;  -- unknown code

  -- Take ownership if it's still unclaimed.
  update public.registrations
  set owner_id = auth.uid()
  where id = v_reg and owner_id is null;

  select email into v_email from public.profiles where id = auth.uid();

  -- Approved membership → access to the school's full history.
  if v_school is not null then
    insert into public.school_members (school_id, email, profile_id, status)
    values (v_school, coalesce(v_email, ''), auth.uid(), 'approved')
    on conflict (school_id, email)
      do update set status = 'approved', profile_id = auth.uid();
  end if;

  update public.profiles set role = 'coordinator'
  where id = auth.uid() and role = 'student';

  return v_reg;
end;
$$;

grant execute on function public.claim_registration(text) to authenticated;


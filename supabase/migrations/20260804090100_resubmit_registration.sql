-- Let a school resubmit a declined registration for another review. Runs as a
-- security-definer RPC because (a) reg_owner_update only lets the OWNER update a
-- registration, but any approved member (e.g. the principal) may resubmit, and
-- (b) coordinators can't insert notifications for admins under RLS. The function
-- verifies the caller belongs to the school, only acts on a declined row, flips
-- it back to submitted (clearing the reason), and pings every admin.
create or replace function public.resubmit_registration(p_registration_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_school uuid;
  v_status text;
  v_year   int;
  v_name   text;
begin
  select r.school_id, r.status, r.edition_year, s.name
    into v_school, v_status, v_year, v_name
  from public.registrations r
  left join public.schools s on s.id = r.school_id
  where r.id = p_registration_id;

  -- Unknown row, not the caller's school, or not actually declined → no-op.
  if v_school is null then return false; end if;
  if v_school not in (select public.my_school_ids()) then return false; end if;
  if v_status is distinct from 'declined' then return false; end if;

  update public.registrations
    set status = 'submitted', decline_reason = null
    where id = p_registration_id;

  insert into public.notifications (profile_id, title, body, link)
  select p.id,
         'Registration resubmitted',
         coalesce(v_name, 'A school') || ' resubmitted its ' || v_year ||
           ' entry for review.',
         '/portal/admin/registrations/' || p_registration_id
  from public.profiles p
  where p.role = 'admin';

  return true;
end;
$$;

revoke execute on function public.resubmit_registration(uuid) from public, anon;
grant execute on function public.resubmit_registration(uuid) to authenticated;

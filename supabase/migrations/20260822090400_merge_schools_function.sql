-- Admin-callable school merge, so a duplicate never needs a one-off script again.
--
-- This is the same operation scripts/canonical/merge-schools.mjs performed on 206
-- rows, as a function so the admin UI can call it. It is one statement from the
-- caller's point of view: either the whole merge lands or none of it does. A
-- multi-step server action could fail halfway and leave children pointing at a
-- school that has already been deleted.
--
-- Order matters, and it is the order the constraints force:
--   1. drop duplicate memberships  — school_members is unique (school_id, email)
--   2. deactivate duplicate students — students_active_name_uniq is
--      (school_id, lower(name)) where deactivated_at is null
--   3. only then re-point anything
--   4. record the merge, including the absorbed ASC- code as an alias
--   5. delete, and only after verifying nothing still references the row: every
--      school_id FK except registrations cascades, and registrations sets null, so a
--      missed child would be destroyed or orphaned silently rather than erroring.
-- Idempotent.

create or replace function public.merge_schools(p_survivor uuid, p_absorbed uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_survivor      public.schools;
  v_absorbed      public.schools;
  v_dropped_mem   int := 0;
  v_deactivated   int := 0;
  v_moved_mem     int := 0;
  v_moved_stu     int := 0;
  v_moved_regs    int := 0;
  v_left_behind   int := 0;
begin
  if not public.is_admin() then raise exception 'Not permitted'; end if;
  if p_survivor is null or p_absorbed is null then
    raise exception 'Both schools are required';
  end if;
  if p_survivor = p_absorbed then
    raise exception 'Cannot merge a school into itself';
  end if;

  select * into v_survivor from public.schools where id = p_survivor;
  if not found then raise exception 'Surviving school not found'; end if;
  select * into v_absorbed from public.schools where id = p_absorbed;
  if not found then raise exception 'School to absorb not found'; end if;

  -- 1. Memberships that would collide on (school_id, email).
  delete from public.school_members m
  where m.school_id = p_absorbed
    and exists (
      select 1 from public.school_members k
      where k.school_id = p_survivor and lower(btrim(k.email)) = lower(btrim(m.email))
    );
  get diagnostics v_dropped_mem = row_count;

  -- 2. Active students that would collide on (school_id, lower(name)).
  update public.students s
  set deactivated_at = now()
  where s.school_id = p_absorbed
    and s.deactivated_at is null
    and exists (
      select 1 from public.students k
      where k.school_id = p_survivor
        and k.deactivated_at is null
        and lower(btrim(k.name)) = lower(btrim(s.name))
    );
  get diagnostics v_deactivated = row_count;

  -- 3. Re-point every child.
  update public.school_members set school_id = p_survivor where school_id = p_absorbed;
  get diagnostics v_moved_mem = row_count;
  update public.students set school_id = p_survivor where school_id = p_absorbed;
  get diagnostics v_moved_stu = row_count;
  update public.registrations set school_id = p_survivor where school_id = p_absorbed;
  get diagnostics v_moved_regs = row_count;
  update public.learning_plans        set school_id = p_survivor where school_id = p_absorbed;
  update public.plan_assignments      set school_id = p_survivor where school_id = p_absorbed;
  update public.student_replacements  set school_id = p_survivor where school_id = p_absorbed;
  update public.info_change_requests  set school_id = p_survivor where school_id = p_absorbed;

  -- 4. Audit trail, with the absorbed code recorded as an alias.
  insert into public.school_merges (
    survivor_id, school_code, absorbed_id, absorbed_name, absorbed_school_code,
    absorbed_lga, absorbed_category, absorbed_airtable_id,
    moved_registrations, moved_members, dropped_members, moved_students,
    deactivated_students, note
  ) values (
    p_survivor, v_survivor.school_code, p_absorbed, v_absorbed.name, v_absorbed.school_code,
    v_absorbed.lga, v_absorbed.category, v_absorbed.airtable_id,
    v_moved_regs, v_moved_mem, v_dropped_mem, v_moved_stu,
    v_deactivated, format('Merged into %s from the admin portal', v_survivor.name)
  );

  -- 5. Refuse to delete while anything still points at it.
  select count(*) into v_left_behind from (
    select 1 from public.registrations        where school_id = p_absorbed
    union all select 1 from public.school_members       where school_id = p_absorbed
    union all select 1 from public.students             where school_id = p_absorbed
    union all select 1 from public.learning_plans       where school_id = p_absorbed
    union all select 1 from public.plan_assignments     where school_id = p_absorbed
    union all select 1 from public.student_replacements where school_id = p_absorbed
    union all select 1 from public.info_change_requests where school_id = p_absorbed
  ) remaining;
  if v_left_behind > 0 then
    raise exception '% rows still reference %; not deleting', v_left_behind, v_absorbed.name;
  end if;

  delete from public.schools where id = p_absorbed;

  -- Canonical identity must not be lost: if the row being kept has no ASC- code and
  -- the absorbed one did, the code moves across. Done after the delete, because
  -- school_code is unique.
  if v_survivor.school_code is null and v_absorbed.school_code is not null then
    update public.schools set school_code = v_absorbed.school_code, updated_at = now()
    where id = p_survivor;
  end if;

  return jsonb_build_object(
    'survivor_id', p_survivor,
    'survivor_name', v_survivor.name,
    'absorbed_name', v_absorbed.name,
    'moved_registrations', v_moved_regs,
    'moved_members', v_moved_mem,
    'dropped_members', v_dropped_mem,
    'moved_students', v_moved_stu,
    'deactivated_students', v_deactivated
  );
end;
$function$;

revoke all on function public.merge_schools(uuid, uuid) from public, anon;
grant execute on function public.merge_schools(uuid, uuid) to authenticated;

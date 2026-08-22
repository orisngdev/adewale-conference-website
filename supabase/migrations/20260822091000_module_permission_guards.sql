-- Enforce the two-tier admin permissions in the database, not just in the app.
--
-- Every teammate invited to the console is `profiles.role = 'admin'`, so is_admin()
-- treats them all alike. The finer view/manage split per module has lived purely in
-- TypeScript (requireManage / canViewModule). That is fine for a server action, which
-- is the only way to reach a table write — but these three functions are SECURITY
-- DEFINER and granted to `authenticated`, so they are reachable directly:
--
--   POST /rest/v1/rpc/merge_schools                → delete a school, re-point history
--   POST /rest/v1/rpc/allocate_qualification_zones → rewrite an edition's centres
--
-- An admin holding VIEW-only on the module could call either with their own session
-- token and bypass the gate entirely, and because SECURITY DEFINER also bypasses RLS
-- that is strictly more power than the table writes these replaced. So the guard has
-- to exist below the app layer too.
--
-- The two helpers mirror getAdminPermissions in src/supabase/auth.ts exactly:
-- role must be 'admin'; a NULL permissions map or admin_role = 'super_admin' means
-- full access (backward compatibility for admins predating the permissions work);
-- otherwise the module's own entry decides. Keep them in step with
-- canView/canManage in src/lib/admin-permissions.ts.

create or replace function public.has_module_view(p_module text)
returns boolean
language sql
security definer
set search_path to 'public'
stable
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and (
        p.permissions is null
        or p.admin_role = 'super_admin'
        or p.permissions ->> p_module in ('view', 'manage')
      )
  );
$function$;

create or replace function public.has_module_manage(p_module text)
returns boolean
language sql
security definer
set search_path to 'public'
stable
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and (
        p.permissions is null
        or p.admin_role = 'super_admin'
        or p.permissions ->> p_module = 'manage'
      )
  );
$function$;

revoke all on function public.has_module_view(text)   from public, anon;
revoke all on function public.has_module_manage(text) from public, anon;
grant execute on function public.has_module_view(text)   to authenticated;
grant execute on function public.has_module_manage(text) to authenticated;

-- ── Re-guarded functions ────────────────────────────────────────────────────
-- Bodies below are unchanged from 20260822090400 / 090500 / 090600 apart from the
-- guard on the first line. Repeated in full because a body cannot be patched in
-- place; the definitions here are the live ones.

-- Schools sit in the "registrations" module ("Registrations & Schools"), matching
-- requireManage("registrations") in admin/schools/actions.ts.
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
  if not public.has_module_manage('registrations') then
    raise exception 'Not permitted';
  end if;
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

create or replace function public.allocate_qualification_zones(
  p_rows    jsonb,
  p_allowed text[]
)
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_changed int := 0;
begin
  if not public.has_module_manage('participants') then
    raise exception 'Not permitted';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a jsonb array of {id, zone}';
  end if;
  if p_allowed is null or cardinality(p_allowed) = 0 then
    raise exception 'p_allowed must list the permitted centres';
  end if;

  with input as (
    select
      (row_value ->> 'id')::uuid              as id,
      nullif(btrim(row_value ->> 'zone'), '') as zone
    from jsonb_array_elements(p_rows) as row_value
  ),
  permitted as (
    -- An empty zone clears the allocation; anything else must be a declared centre,
    -- so a stale LGA can be replaced or cleared but never written back.
    select id, zone from input
    where zone is null or zone = any (p_allowed)
  )
  update public.registrations reg
  set qualification_zone = p.zone
  from permitted p
  where reg.id = p.id
    and reg.qualification_zone is distinct from p.zone;

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$function$;

-- A plain SQL set-returning function cannot raise, so the guard stays a predicate:
-- an admin without view access on the module gets an empty list rather than an
-- error. No row can be returned unless the predicate holds, so nothing leaks.
--
-- Also fixed: members are now joined on a non-empty email. Blank emails all compare
-- equal to each other, so any group of k schools carrying '' would have paired up
-- k-squared times and buried the real candidates.
create or replace function public.school_duplicate_candidates()
returns table (
  a_id uuid,
  a_name text,
  a_school_code text,
  a_years int[],
  b_id uuid,
  b_name text,
  b_school_code text,
  b_years int[],
  shared_coordinators int,
  same_school_email boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with member as (
    select school_id, lower(btrim(email)) as email
    from public.school_members
    where nullif(btrim(email), '') is not null
  ),
  pair as (
    select x.school_id as a_id, y.school_id as b_id, count(*)::int as shared
    from member x
    join member y on x.email = y.email and x.school_id < y.school_id
    group by 1, 2
  ),
  years as (
    select school_id, array_agg(distinct edition_year order by edition_year) as years
    from public.registrations where school_id is not null group by school_id
  )
  select
    p.a_id, sa.name, sa.school_code, coalesce(ya.years, '{}'),
    p.b_id, sb.name, sb.school_code, coalesce(yb.years, '{}'),
    p.shared,
    coalesce(sa.email is not null and lower(btrim(sa.email)) = lower(btrim(sb.email)), false)
  from pair p
  join public.schools sa on sa.id = p.a_id
  join public.schools sb on sb.id = p.b_id
  left join years ya on ya.school_id = p.a_id
  left join years yb on yb.school_id = p.b_id
  -- No shared edition: the histories sit side by side rather than competing.
  where not (coalesce(ya.years, '{}') && coalesce(yb.years, '{}'))
    and public.has_module_view('registrations')
  order by
    coalesce(sa.email is not null and lower(btrim(sa.email)) = lower(btrim(sb.email)), false) desc,
    p.shared desc,
    sa.name;
$function$;

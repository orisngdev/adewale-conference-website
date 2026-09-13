-- Two guards against a school holding more than three reps.
--
-- registrations.reps has always honoured the three-rep rule; nothing enforced it
-- on the roster those reps provision. students has no cap, and its only guard —
-- the partial unique index on (school_id, lower(name)) — is walked past by any
-- change of spelling or word order, so a near-miss INSERTs beside the student
-- instead of resolving to them. Four 2026 schools drifted past three that way;
-- the rows were retired by a one-off repair before this cap went on.
--
-- Name matching itself lives in src/lib/person-identity.ts — nothing indexes on
-- a normalized person name, so there is no SQL copy to hold in lockstep.

-- ── 1. roster cap ───────────────────────────────────────────────────────────
-- Scoped to the latest edition: 2022–2025 rosters came from result sheets that
-- legitimately disagree with the registrations (some schools sat six), and a
-- retroactive cap would block correcting that history.
--
-- The replacement flow is unaffected — it retires the outgoing student before
-- provisioning the incoming one. One that FAILS to find its outgoing student now
-- raises here instead of quietly leaving a fourth rep behind.
create or replace function public.enforce_roster_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap    constant integer := 3;
  v_latest integer;
  v_active integer;
  v_school text;
begin
  if new.school_id is null or new.edition_year is null or new.deactivated_at is not null then
    return new;
  end if;

  select max(year) into v_latest from public.editions;
  if v_latest is null or new.edition_year <> v_latest then
    return new;
  end if;

  select count(*) into v_active
  from public.students
  where school_id = new.school_id
    and edition_year = new.edition_year
    and deactivated_at is null
    and id <> new.id;

  if v_active >= v_cap then
    select name into v_school from public.schools where id = new.school_id;
    raise exception using
      errcode = 'ASC03',
      message = format(
        '%s already has %s active representatives for %s.',
        coalesce(v_school, 'This school'), v_active, new.edition_year
      ),
      hint = 'A school fields three. Retire a rep through the replacement flow before adding another.';
  end if;

  return new;
end;
$$;

drop trigger if exists students_roster_cap on public.students;

-- UPDATE is watched so clearing deactivated_at cannot bring a retired rep back
-- into a roster that has already been refilled.
create trigger students_roster_cap
  before insert or update of school_id, edition_year, deactivated_at
  on public.students
  for each row execute function public.enforce_roster_cap();

-- ── 2. one registration per school per edition ──────────────────────────────
-- Unchanged from 20260822090300 except for the duplicate guard. That version
-- asked "does this CALLER already have a registration for this year?", which is
-- blind to one the school already has but the caller has not claimed yet — so a
-- coordinator registering through the portal minted a second registration beside
-- the unclaimed one, and both provisioned their own spelling of the same reps.
--
-- The owner check stays as the first gate (it makes a double submit idempotent);
-- the school check is added once the school resolves.
create or replace function public.register_school_for_edition(
  p_year     integer,
  p_school   text,
  p_lga      text,
  p_category text,
  p_reps     jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_open       boolean;
  v_school_id  uuid;
  v_reg_id     uuid;
  v_owner      uuid;
  v_stage      text;
  v_new_school boolean := false;
  v_email      text;
  v_name       text := btrim(coalesce(p_school, ''));
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if v_name = '' then raise exception 'School name is required'; end if;

  select registration_open, current_stage into v_open, v_stage
  from public.editions where year = p_year;
  if not coalesce(v_open, false) then
    raise exception 'Registration is not open for %', p_year;
  end if;

  if exists (select 1 from public.registrations
             where owner_id = auth.uid() and edition_year = p_year) then
    select id into v_reg_id from public.registrations
    where owner_id = auth.uid() and edition_year = p_year limit 1;
    return v_reg_id;
  end if;

  -- Prefer a canonical school, so a coordinator's spelling can never take priority
  -- over a row that carries an ASC- code.
  select id into v_school_id from public.schools
  where public.school_norm_name(name) = public.school_norm_name(v_name)
  order by (school_code is null), created_at
  limit 1;

  if v_school_id is null then
    -- Someone may insert the same name between the select and here; let the unique
    -- index arbitrate rather than raising at the caller.
    insert into public.schools (name, lga, category)
    values (v_name, p_lga, p_category)
    on conflict (public.school_norm_name(name)) do nothing
    returning id into v_school_id;

    if v_school_id is null then
      select id into v_school_id from public.schools
      where public.school_norm_name(name) = public.school_norm_name(v_name)
      order by (school_code is null), created_at
      limit 1;
    else
      v_new_school := true;
    end if;
  end if;

  if v_school_id is null then
    raise exception 'Could not resolve or create school %', v_name;
  end if;

  -- A declined row does not count: that is how a duplicate gets retired, so a
  -- school must still be able to register after one.
  select id, owner_id into v_reg_id, v_owner
  from public.registrations
  where school_id = v_school_id
    and edition_year = p_year
    and status <> 'declined'
  order by created_at
  limit 1;

  if v_reg_id is not null then
    if v_owner = auth.uid() then
      return v_reg_id;
    elsif v_owner is null then
      raise exception using
        errcode = 'ASC01',
        message = format('%s is already registered for %s.', v_name, p_year),
        hint    = 'Redeem the claim code sent to the school to take over that registration.';
    else
      raise exception using
        errcode = 'ASC02',
        message = format('%s is already registered for %s by another coordinator.', v_name, p_year),
        hint    = 'Ask them to add you as a coordinator on the school, or contact the organisers.';
    end if;
  end if;

  insert into public.registrations
    (school_id, owner_id, edition_year, status, current_stage, reps)
  values (v_school_id, auth.uid(), p_year, 'submitted', v_stage, p_reps)
  returning id into v_reg_id;

  select email into v_email from public.profiles where id = auth.uid();
  insert into public.school_members (school_id, email, profile_id, status)
  values (v_school_id, v_email, auth.uid(),
          case when v_new_school then 'approved' else 'pending' end)
  on conflict (school_id, email) do nothing;

  return v_reg_id;
end;
$function$;

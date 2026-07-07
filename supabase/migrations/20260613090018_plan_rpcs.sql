-- Learning-plan RPCs (SECURITY DEFINER, granted to authenticated) + a trigger
-- that auto-completes assessment items when a Student records an attempt.
-- No gating (ordered checklist). Idempotent. Run after …017.

-- ── A Student's assigned plans (current edition, published) ────────────────────
create or replace function public.get_my_plans()
returns jsonb language sql security definer set search_path = public stable as $$
  select coalesce(jsonb_agg(distinct jsonb_build_object(
    'id', lp.id, 'title', lp.title, 'description', lp.description,
    'subject', lp.subject, 'level', lp.level, 'edition_year', lp.edition_year)), '[]'::jsonb)
  from public.students s
  join public.plan_assignments pa on (
    (pa.assignee_type = 'level' and pa.school_id = s.school_id
       and (pa.level is null or pa.level = s.level)
       and (pa.edition_year is null or pa.edition_year = s.edition_year))
    or (pa.assignee_type = 'student' and pa.student_id = s.id))
  join public.learning_plans lp on lp.id = pa.plan_id and lp.published
  where s.auth_user_id = auth.uid();
$$;
grant execute on function public.get_my_plans() to authenticated;

-- ── One plan with modules → items + this Student's progress (assignment-checked) ─
create or replace function public.get_student_plan(p_plan_id uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_ok boolean;
begin
  select exists (
    select 1 from public.students s
    join public.plan_assignments pa on (
      (pa.assignee_type = 'level' and pa.school_id = s.school_id
         and (pa.level is null or pa.level = s.level)
         and (pa.edition_year is null or pa.edition_year = s.edition_year))
      or (pa.assignee_type = 'student' and pa.student_id = s.id))
    where s.auth_user_id = auth.uid() and pa.plan_id = p_plan_id
  ) into v_ok;
  if not v_ok then return null; end if;

  return (
    select jsonb_build_object(
      'id', lp.id, 'title', lp.title, 'description', lp.description,
      'subject', lp.subject, 'level', lp.level,
      'modules', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', pm.id, 'title', pm.title, 'description', pm.description,
          'position', pm.position, 'due_date', pm.due_date,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', pmi.id, 'position', pmi.position, 'item_type', pmi.item_type,
              'title', pmi.title, 'required', pmi.required,
              'assessment_id', pmi.assessment_id, 'assessment_mode', a.mode,
              'resource_id', pmi.resource_id, 'external_url', pmi.external_url,
              'note_md', pmi.note_md,
              'status', coalesce(pip.status, 'not_started'), 'score', pip.score)
              order by pmi.position)
            from public.plan_module_items pmi
            left join public.assessments a on a.id = pmi.assessment_id
            left join public.plan_item_progress pip
              on pip.module_item_id = pmi.id and pip.student_user_id = auth.uid()
            where pmi.module_id = pm.id), '[]'::jsonb))
          order by pm.position)
        from public.plan_modules pm where pm.plan_id = lp.id), '[]'::jsonb))
    from public.learning_plans lp where lp.id = p_plan_id);
end;
$$;
grant execute on function public.get_student_plan(uuid) to authenticated;

-- ── Mark a non-assessment item done (or update status) — no prerequisite check ─
create or replace function public.complete_module_item(
  p_item_id uuid, p_status text default 'completed', p_score int default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.plan_item_progress
    (module_item_id, student_user_id, status, score, completed_at)
  values (p_item_id, auth.uid(), p_status, p_score,
          case when p_status = 'completed' then now() else null end)
  on conflict (module_item_id, student_user_id) do update set
    status = excluded.status,
    score = case when excluded.score is not null
                   and (plan_item_progress.score is null or excluded.score > plan_item_progress.score)
                 then excluded.score else plan_item_progress.score end,
    completed_at = coalesce(plan_item_progress.completed_at, excluded.completed_at);
end;
$$;
grant execute on function public.complete_module_item(uuid, text, int) to authenticated;

-- ── Class dashboard: per-student completion of required items (staff-only) ─────
create or replace function public.get_class_plan_progress(p_plan_id uuid)
returns jsonb language sql security definer set search_path = public stable as $$
  with guard as (
    select 1 from public.learning_plans lp
    where lp.id = p_plan_id
      and (public.is_admin() or lp.school_id in (select public.my_school_ids()))
  ),
  req as (
    select pmi.id from public.plan_module_items pmi
    join public.plan_modules pm on pm.id = pmi.module_id
    where pm.plan_id = p_plan_id and pmi.required
  ),
  roster as (
    select distinct s.id, s.name, s.level, s.auth_user_id
    from public.plan_assignments pa
    join public.students s on (
      (pa.assignee_type = 'level' and pa.school_id = s.school_id
         and (pa.level is null or pa.level = s.level)
         and (pa.edition_year is null or pa.edition_year = s.edition_year))
      or (pa.assignee_type = 'student' and pa.student_id = s.id))
    where pa.plan_id = p_plan_id
      and (public.is_admin() or s.school_id in (select public.my_school_ids()))
  )
  select case when exists (select 1 from guard) then coalesce((
    select jsonb_agg(jsonb_build_object(
      'student_id', r.id, 'name', r.name, 'level', r.level,
      'total', (select count(*) from req),
      'completed', (
        select count(*) from public.plan_item_progress pip
        where pip.student_user_id = r.auth_user_id and pip.status = 'completed'
          and pip.module_item_id in (select id from req))
    ) order by r.name)
    from roster r), '[]'::jsonb) else null end;
$$;
grant execute on function public.get_class_plan_progress(uuid) to authenticated;

-- ── Auto-complete assessment plan items when a Student records an attempt ──────
create or replace function public.sync_plan_progress_from_attempt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'submitted' and new.assessment_id is not null then
    insert into public.plan_item_progress
      (module_item_id, student_user_id, status, score, completed_at)
    select pmi.id, new.student_user_id, 'completed', new.score, now()
    from public.plan_module_items pmi
    where pmi.assessment_id = new.assessment_id
    on conflict (module_item_id, student_user_id) do update set
      status = 'completed',
      score = case when excluded.score is not null
                     and (plan_item_progress.score is null or excluded.score > plan_item_progress.score)
                   then excluded.score else plan_item_progress.score end,
      completed_at = coalesce(plan_item_progress.completed_at, excluded.completed_at);
  end if;
  return new;
end;
$$;
drop trigger if exists sync_plan_progress on public.assessment_attempts;
create trigger sync_plan_progress
  after insert or update on public.assessment_attempts
  for each row execute function public.sync_plan_progress_from_attempt();

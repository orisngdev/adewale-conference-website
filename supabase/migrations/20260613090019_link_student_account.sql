-- Account merge (ADR 0001): a self-signed-up Student who is also a
-- Coordinator-provisioned Rep enters their access code once to become a single
-- identity — the Rep record is repointed to their real account and their history
-- migrates, so one human keeps one progress history. Idempotent. Run after …018.

create or replace function public.link_student_account(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_old uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select id, auth_user_id into v_student, v_old
  from public.students where access_code = p_code;
  if v_student is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_old = auth.uid() then return jsonb_build_object('ok', true, 'already', true); end if;

  -- Repoint the Rep record to the caller's account.
  update public.students set auth_user_id = auth.uid() where id = v_student;

  -- Merge history off the old (synthetic code-login) account, if any.
  if v_old is not null then
    -- avoid unique(module_item_id, student_user_id) clashes
    delete from public.plan_item_progress
    where student_user_id = auth.uid()
      and module_item_id in (
        select module_item_id from public.plan_item_progress where student_user_id = v_old);

    update public.assessment_attempts set student_user_id = auth.uid() where student_user_id = v_old;
    update public.plan_item_progress   set student_user_id = auth.uid() where student_user_id = v_old;
    update public.resource_downloads   set student_user_id = auth.uid() where student_user_id = v_old;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.link_student_account(text) to authenticated;

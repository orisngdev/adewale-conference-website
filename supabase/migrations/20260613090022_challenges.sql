-- Data-science challenges (a Zindi/Kaggle-style arena for the Tech track).
-- Students download a dataset, analyse it off-portal, and upload a predictions
-- CSV; the server scores it against a hidden ground truth. Ground truth is
-- admin-only (like question_bank) and NEVER reaches the client — scoring runs in
-- a SECURITY DEFINER RPC, so the leaderboard can't be gamed. Idempotent. After …021.

create table if not exists public.challenges (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  title          text not null,
  description_md text,
  metric         text not null check (metric in ('accuracy','rmse','mae')),
  id_column      text not null default 'id',
  target_column  text not null default 'prediction',
  train_url      text,
  test_url       text,
  deadline       timestamptz,
  edition_year   int,
  daily_limit    int default 20,
  published      boolean not null default false,
  created_at     timestamptz not null default now()
);

-- The answer key. Split into a public slice (live leaderboard) and a private
-- slice (final ranking) to stop leaderboard overfitting.
create table if not exists public.challenge_truth (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  row_id       text not null,
  true_value   numeric not null,
  is_public    boolean not null default true,
  unique (challenge_id, row_id)
);
create index if not exists challenge_truth_challenge_idx on public.challenge_truth (challenge_id);

create table if not exists public.challenge_submissions (
  id              uuid primary key default gen_random_uuid(),
  challenge_id    uuid not null references public.challenges on delete cascade,
  student_user_id uuid not null references auth.users on delete cascade,
  public_score    numeric,
  private_score   numeric,
  n_rows          int,
  created_at      timestamptz not null default now()
);
create index if not exists challenge_submissions_lb_idx on public.challenge_submissions (challenge_id, public_score);
create index if not exists challenge_submissions_student_idx on public.challenge_submissions (challenge_id, student_user_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.challenges            enable row level security;
alter table public.challenge_truth       enable row level security;
alter table public.challenge_submissions enable row level security;

drop policy if exists "challenges_read"  on public.challenges;
drop policy if exists "challenges_admin" on public.challenges;
create policy "challenges_read"  on public.challenges for select using (published or public.is_admin());
create policy "challenges_admin" on public.challenges for all using (public.is_admin()) with check (public.is_admin());

-- Truth: ADMIN ONLY. No student SELECT policy — the scoring RPC (definer) is the
-- only path that ever touches it. Do NOT add a student-readable policy here.
drop policy if exists "challenge_truth_admin" on public.challenge_truth;
create policy "challenge_truth_admin" on public.challenge_truth for all using (public.is_admin()) with check (public.is_admin());

-- Submissions: students read their own; school staff + admins read their students'.
-- Inserts happen only via score_submission() (definer), never directly.
drop policy if exists "challenge_sub_self"        on public.challenge_submissions;
drop policy if exists "challenge_sub_staff_read"  on public.challenge_submissions;
create policy "challenge_sub_self" on public.challenge_submissions for select using (student_user_id = auth.uid());
create policy "challenge_sub_staff_read" on public.challenge_submissions for select using (
  public.is_admin() or student_user_id in (
    select auth_user_id from public.students where school_id in (select public.my_school_ids())));

-- ── Scoring: grade a predictions payload against the hidden truth ─────────────
create or replace function public.score_submission(p_challenge_id uuid, p_predictions jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_metric text; v_deadline timestamptz; v_published boolean; v_limit int;
  v_today int; v_n int; v_matched int;
  v_acc_pub numeric; v_acc_priv numeric; v_mae_pub numeric; v_mae_priv numeric;
  v_mse_pub numeric; v_mse_priv numeric; v_public numeric; v_private numeric;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select metric, deadline, published, daily_limit
    into v_metric, v_deadline, v_published, v_limit
  from public.challenges where id = p_challenge_id;
  if v_metric is null then raise exception 'Challenge not found'; end if;
  if not v_published then raise exception 'This challenge is not open'; end if;
  if v_deadline is not null and now() > v_deadline then raise exception 'The deadline has passed'; end if;

  v_n := jsonb_array_length(p_predictions);
  if coalesce(v_n, 0) = 0 then raise exception 'No predictions submitted'; end if;
  if v_n > 100000 then raise exception 'Too many rows (max 100000)'; end if;

  select count(*) into v_today from public.challenge_submissions
   where challenge_id = p_challenge_id and student_user_id = auth.uid()
     and created_at >= date_trunc('day', now());
  if v_limit is not null and v_today >= v_limit then
    raise exception 'Daily submission limit reached (%). Try again tomorrow.', v_limit;
  end if;

  with preds as (
    select (e->>'id')::text as row_id, (e->>'prediction')::numeric as pred
    from jsonb_array_elements(p_predictions) e
  ),
  joined as (
    select t.is_public, t.true_value as truth, p.pred
    from public.challenge_truth t
    join preds p on p.row_id = t.row_id
    where t.challenge_id = p_challenge_id
  )
  select
    count(*),
    avg((round(pred) = truth)::int) filter (where is_public),
    avg((round(pred) = truth)::int) filter (where not is_public),
    avg(abs(pred - truth))          filter (where is_public),
    avg(abs(pred - truth))          filter (where not is_public),
    avg((pred - truth) ^ 2)         filter (where is_public),
    avg((pred - truth) ^ 2)         filter (where not is_public)
  into v_matched, v_acc_pub, v_acc_priv, v_mae_pub, v_mae_priv, v_mse_pub, v_mse_priv
  from joined;

  if coalesce(v_matched, 0) = 0 then
    raise exception 'None of your ids matched the test set — check the id column and format';
  end if;

  if v_metric = 'accuracy' then
    v_public := v_acc_pub;  v_private := v_acc_priv;
  elsif v_metric = 'mae' then
    v_public := v_mae_pub;  v_private := v_mae_priv;
  else -- rmse
    v_public := sqrt(v_mse_pub);  v_private := sqrt(v_mse_priv);
  end if;

  insert into public.challenge_submissions (challenge_id, student_user_id, public_score, private_score, n_rows)
  values (p_challenge_id, auth.uid(), round(v_public, 4), round(v_private, 4), v_matched);

  return jsonb_build_object(
    'ok', true, 'metric', v_metric,
    'public_score', round(v_public, 4),
    'matched', v_matched, 'submitted', v_n,
    'lower_is_better', v_metric in ('rmse','mae')
  );
end;
$$;
grant execute on function public.score_submission(uuid, jsonb) to authenticated;

-- ── Public leaderboard: best public score per student, ranked ────────────────
create or replace function public.get_challenge_leaderboard(p_challenge_id uuid)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_lower boolean; v_result jsonb;
begin
  select metric in ('rmse','mae') into v_lower from public.challenges where id = p_challenge_id;
  with best as (
    select cs.student_user_id,
           case when v_lower then min(cs.public_score) else max(cs.public_score) end as score,
           count(*) as entries
    from public.challenge_submissions cs
    where cs.challenge_id = p_challenge_id and cs.public_score is not null
    group by cs.student_user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', coalesce(st.name, p.full_name, 'Student'),
      'school', sch.name,
      'score', b.score,
      'entries', b.entries
    ) order by (case when v_lower then b.score else -b.score end) asc), '[]'::jsonb)
  into v_result
  from best b
  left join public.students st on st.auth_user_id = b.student_user_id
  left join public.schools  sch on sch.id = st.school_id
  left join public.profiles p on p.id = b.student_user_id;
  return v_result;
end;
$$;
grant execute on function public.get_challenge_leaderboard(uuid) to authenticated;

-- ── Demo seed: a gentle first challenge (safe to delete) ─────────────────────
insert into public.challenges
  (slug, title, description_md, metric, id_column, target_column, train_url, test_url, edition_year, daily_limit, published)
values (
  'exam-score-101',
  'Predict the Exam Score',
  'Your first data challenge. The training data gives you each student''s weekly study hours and their real exam score. Find the relationship, then predict the exam score for every student in the test data. A simple line of best fit will get you started — can you do better?',
  'rmse', 'id', 'prediction',
  '/challenges/exam-score-101/train.csv',
  '/challenges/exam-score-101/test.csv',
  2026, 20, true
) on conflict (slug) do nothing;

insert into public.challenge_truth (challenge_id, row_id, true_value, is_public)
select c.id, v.row_id, v.true_value, v.is_public
from public.challenges c,
  (values
    ('1000', 23, true),
    ('1001', 44, false),
    ('1002', 53, true),
    ('1003', 45, false),
    ('1004', 45, true),
    ('1005', 62, false),
    ('1006', 61, true),
    ('1007', 55, false),
    ('1008', 63, true),
    ('1009', 81, false),
    ('1010', 79, true),
    ('1011', 28, false),
    ('1012', 42, true),
    ('1013', 51, false),
    ('1014', 43, true),
    ('1015', 47, false),
    ('1016', 58, true),
    ('1017', 60, false),
    ('1018', 53, true),
    ('1019', 68, false)
  ) as v(row_id, true_value, is_public)
where c.slug = 'exam-score-101'
on conflict (challenge_id, row_id) do nothing;

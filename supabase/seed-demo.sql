-- Demo data for testing the portal. Run in Supabase → SQL Editor.
-- Idempotent (safe to re-run) and easy to wipe — see CLEANUP at the bottom.
-- All demo schools are prefixed "[DEMO]" so nothing collides with real data.
--
-- 👉 Registrations are owned by SEED_EMAIL below — change it to the account you
--    log in with, so they appear on your student/coordinator dashboards.
--    (That account must have signed in at least once so its profile exists.)

-- ── Demo schools (insert only if missing) ────────────────────────────────────
insert into public.schools (name, lga, category)
select v.name, v.lga, v.category
from (values
  ('[DEMO] Mayflower Secondary School', 'Ikenne', 'Private'),
  ('[DEMO] Ogun Grammar School',        'Abeokuta South', 'Public'),
  ('[DEMO] Remo Secondary School',      'Sagamu', 'Public')
) as v(name, lga, category)
where not exists (select 1 from public.schools s where s.name = v.name);

-- ── Demo registrations owned by SEED_EMAIL ───────────────────────────────────
insert into public.registrations (school_id, owner_id, edition_year, status, reps)
select s.id, p.id, v.year, v.status, v.reps::jsonb
from (values
  ('[DEMO] Mayflower Secondary School', 2025, 'verified',
   '[{"name":"Ada Okeke","level":"SS2"},{"name":"Tunde Bello","level":"SS3"}]'),
  ('[DEMO] Ogun Grammar School', 2025, 'submitted',
   '[{"name":"Chidi Nwosu","level":"SS1"}]'),
  ('[DEMO] Remo Secondary School', 2024, 'finalist',
   '[{"name":"Funke Adeyemi","level":"SS2"}]')
) as v(school_name, year, status, reps)
join public.schools s on s.name = v.school_name
cross join (
  select id from public.profiles where email = 'destinyerhabor6@gmail.com'  -- SEED_EMAIL
) p
where not exists (
  select 1 from public.registrations r
  where r.owner_id = p.id and r.school_id = s.id and r.edition_year = v.year
);

-- ── A demo certificate on the finalist registration ──────────────────────────
insert into public.certificates (registration_id, type, asset_url)
select r.id, 'Finalist 2024', 'https://example.com/demo-certificate.pdf'
from public.registrations r
join public.schools s on s.id = r.school_id
where s.name = '[DEMO] Remo Secondary School'
  and r.edition_year = 2024
  and not exists (select 1 from public.certificates c where c.registration_id = r.id);

-- ── Demo assessments: a published practice drill + a mock exam ───────────────
do $$
declare v_a uuid; v_q uuid;
begin
  if not exists (select 1 from public.assessments where title = '[DEMO] Math Speed Drill') then
    insert into public.assessments (title, subject, level, mode, published, time_limit_minutes)
    values ('[DEMO] Math Speed Drill', 'Mathematics & Number Theory', 'SS2', 'practice', true, 10)
    returning id into v_a;

    insert into public.question_bank (mode, subject, level, difficulty, prompt, options, correct_index, explanation)
    values ('practice','Mathematics & Number Theory','SS2','easy','What is 7 × 8?', '["54","56","48","64"]'::jsonb, 1, '7 × 8 = 56.')
    returning id into v_q;
    insert into public.assessment_questions (assessment_id, question_id, position) values (v_a, v_q, 0);

    insert into public.question_bank (mode, subject, level, difficulty, prompt, options, correct_index, explanation)
    values ('practice','Mathematics & Number Theory','SS2','medium','Convert 1010 (base 2) to base 10.', '["8","10","12","5"]'::jsonb, 1, '1010₂ = 8 + 0 + 2 + 0 = 10.')
    returning id into v_q;
    insert into public.assessment_questions (assessment_id, question_id, position) values (v_a, v_q, 1);

    insert into public.question_bank (mode, subject, level, difficulty, prompt, options, correct_index, explanation)
    values ('practice','Mathematics & Number Theory','SS2','hard','Solve for x: 2x + 3 = 11.', '["3","4","5","6"]'::jsonb, 1, '2x = 8, so x = 4.')
    returning id into v_q;
    insert into public.assessment_questions (assessment_id, question_id, position) values (v_a, v_q, 2);
  end if;

  if not exists (select 1 from public.assessments where title = '[DEMO] Physics Mock Exam') then
    insert into public.assessments (title, subject, level, mode, published, time_limit_minutes, max_attempts)
    values ('[DEMO] Physics Mock Exam', 'Mechanics & Physics', 'SS2', 'exam', true, 15, 2)
    returning id into v_a;

    insert into public.question_bank (mode, subject, level, difficulty, prompt, options, correct_index)
    values ('exam','Mechanics & Physics','SS2','medium','The SI unit of force is the?', '["Joule","Newton","Watt","Pascal"]'::jsonb, 1)
    returning id into v_q;
    insert into public.assessment_questions (assessment_id, question_id, position) values (v_a, v_q, 0);

    insert into public.question_bank (mode, subject, level, difficulty, prompt, options, correct_index)
    values ('exam','Mechanics & Physics','SS2','easy','Acceleration due to gravity is approximately (m/s²)?', '["8.9","9.8","10.8","6.7"]'::jsonb, 1)
    returning id into v_q;
    insert into public.assessment_questions (assessment_id, question_id, position) values (v_a, v_q, 1);
  end if;
end $$;

-- ── CLEANUP — run these lines to remove ALL demo data ────────────────────────
-- delete from public.assessment_questions where assessment_id in (select id from public.assessments where title like '[DEMO]%');
-- delete from public.assessments where title like '[DEMO]%';
-- delete from public.registrations where school_id in (select id from public.schools where name like '[DEMO]%');
-- delete from public.schools where name like '[DEMO]%';

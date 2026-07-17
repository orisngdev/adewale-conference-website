-- Seed the Future Tech Skills Lab as the first Guided Lab and carry existing
-- tech-lab ticks over. Stable step keys (scratch/python/data) match the legacy
-- TECH_LAB_STEPS, so progress survives the move. The old tech_lab_progress
-- table is kept (not dropped). Idempotent. Run after …120000_labs.sql.

insert into public.labs (slug, title, summary, track, sort, published)
values (
  'future-tech',
  'Future Tech Skills Lab',
  'From Scratch blocks to Python and data — build the skills behind AI and software engineering.',
  'Future Tech',
  0,
  true
)
on conflict (slug) do nothing;

-- The three legacy steps as external-tool lessons (hrefs → media_url).
insert into public.lab_steps (lab_id, sort, key, title, kind, body_md, media_url, link_label)
select l.id, s.sort, s.key, s.title, 'link', s.body_md, s.media_url, s.link_label
from public.labs l
cross join (values
  (0, 'scratch', 'Scratch — block-based coding',
   'Learn the logic of programming visually, dragging blocks together.',
   'https://scratch.mit.edu/', 'Open Scratch'),
  (1, 'python', 'Python fundamentals',
   'Move to real code: variables, loops, functions and problem-solving.',
   'https://www.learnpython.org/', 'Open learnpython.org'),
  (2, 'data', 'Data libraries (Pandas & NumPy)',
   'Work with real data — the toolkit behind AI and data science.',
   'https://code.org/en-US/tools/python-lab', 'Open Python Lab')
) as s(sort, key, title, body_md, media_url, link_label)
where l.slug = 'future-tech'
on conflict (lab_id, key) do nothing;

-- Carry over existing ticks: tech_lab_progress → lab_progress under future-tech.
insert into public.lab_progress (lab_id, student_user_id, step_key, completed_at)
select l.id, t.student_user_id, t.step_key, t.completed_at
from public.tech_lab_progress t
cross join public.labs l
where l.slug = 'future-tech'
on conflict (lab_id, student_user_id, step_key) do nothing;

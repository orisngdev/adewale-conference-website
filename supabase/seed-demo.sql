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

-- ── CLEANUP — run these two lines to remove ALL demo data ────────────────────
-- delete from public.registrations where school_id in (select id from public.schools where name like '[DEMO]%');
-- delete from public.schools where name like '[DEMO]%';

-- The recurrence guard: one school row per normalized name, forever.
--
-- This CANNOT be applied before data/canonical/reports/merge-schools.sql has been
-- committed — it fails outright while duplicate names exist. That is deliberate:
-- the index creating successfully is the proof that the merge is complete.
--
-- Why name alone and not (name, lga): the duplicate rows this repairs disagreed
-- about LGA as often as they agreed. CENTURY TOWER MODEL COLLEGE existed three
-- times under Ijebu North, Ijebu North East and Ijebu Ode; ISANBI COMPREHENSIVE
-- under Ikenne and Imeko Afon. An index including lga would have let every one of
-- those through. School names in the canonical set are globally unique (534/534),
-- because Nigerian school names generally carry their town.
--
-- The trade-off: a genuinely new school whose name collides with an existing one is
-- rejected at insert time. That is a loud, fixable failure — the admin gives it its
-- fuller name, or merges via the admin tool — and is much cheaper than the silent
-- fragmentation this replaces. Idempotent.

create unique index if not exists schools_norm_name_key
  on public.schools (public.school_norm_name(name));

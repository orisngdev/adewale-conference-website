# Supabase migrations

Apply **in filename order, top to bottom** — each builds on the previous and is
idempotent (safe to re-run). The timestamp prefix enforces the order.

| # | File | What it does |
|---|------|--------------|
| 1 | `…_init_schema.sql` | `user_role` type; `profiles`, `schools`, `registrations`, `certificates`; RLS; `is_admin()`; `handle_new_user` + signup trigger; **profiles_admin_update** policy |
| 2 | `…_default_admins.sql` | Admin allowlist baked into the signup trigger + backfill |
| 3 | `…_registration_bridge.sql` | `schools.airtable_id`; `registrations.contact_email` + `claim_code`; `claim_registration` (v1) |
| 4 | `…_coordinator_onboarding.sql` | Smart signup: auto-admin / auto-coordinator by email + auto-link (supersedes the trigger from #2) |
| 5 | `…_editions.sql` | `editions` (registration_open, stages, current_stage); `current_stage` on registrations; `register_school_for_edition` RPC; seeds 2026 |
| 6 | `…_school_members.sql` | `school_members` (email↔school, pending/approved); `my_school_ids()`; member-read RLS; membership-aware `register_school_for_edition` (supersedes #5) |
| 7 | `…_claim_membership.sql` | `claim_registration` grants **approved** membership (supersedes #3) |
| 8 | `…_notifications.sql` | `notifications` table + `notify_edition_stage` fan-out RPC |

Later files deliberately redefine functions/triggers from earlier ones — that's
normal migration history; applying the whole sequence yields the correct final state.

## Applying

**Supabase SQL editor:** paste each file's contents in order and run.

**Supabase CLI:** `supabase db push` (applies all migrations in order).

## Seed data (optional)

`../seed-demo.sql` — demo schools/registrations for testing the portal. Not a
migration; run only in non-production. Edit `SEED_EMAIL` to your login first.

# 0007 — Admin analytics computed in-app from RLS reads (no new schema)

Admins need a dashboard that shows how an Edition is tracking, whether the platform is being used, and how the audience is growing — the [Competition ladder](../../CONTEXT.md#analytics), registration/growth/engagement trends, and [Active Student](../../CONTEXT.md#analytics) activity. The question was *where the aggregation runs*: a new analytics schema (rollup tables / materialized views / SQL RPCs), or app-code aggregation over the existing tables.

We compute analytics **in the page**, read-only, over the ordinary RLS-respecting server client (`createClient()`). Every table already has an `is_admin()` policy, so an admin's reads see all rows — **no service-role client and no new tables/RPCs**. `src/lib/analytics.ts` runs one batched `Promise.all` of column-scoped selects and derives every metric in TypeScript. Two deliberate constraints keep it honest and bounded:

- **Time-series are windowed at the DB.** The chosen window (30d / 90d / 12mo / all-time) is pushed down as `.gte(created_at, …)` on the large engagement tables (`assessment_attempts`, `resource_downloads`, …), so a normal view never scans them in full. Cumulative KPIs (registrations, schools, certificates) stay all-time.
- **Buckets are cut in Africa/Lagos (WAT, UTC+1, no DST), not UTC.** The audience is Nigerian and the server is UTC; bucketing daily activity in UTC would push evening-WAT events into the next day. The offset is applied in JS before truncating to day/week/month.

Filtering is split by what the data supports: a **global time window** drives all trends, while the **Edition selector scopes only the Registrations & Competition section**, because the engagement/growth tables carry no `edition_year` (per ADR-0004, rosters are edition-scoped but content/engagement is evergreen).

## Considered options
- **In-app aggregation over RLS reads (chosen).** Zero migration, ships now, reuses `tierRank()` for the ladder so there is one definition of "Accepted/Qualified/Finalist". Fine while volumes are hundreds–low thousands of rows; the cost is that some queries pull rows the DB could have counted.
- **SQL aggregation via `SECURITY DEFINER` RPCs.** Checks `is_admin()` once and buckets in Postgres (like `get_challenge_leaderboard`). More efficient at scale, but every metric change is a migration, and the WAT/edition logic would live in SQL. Deferred, not rejected — it is the escalation path.
- **Materialized views / a rollup table refreshed on a cron.** Cheapest reads, but stale by design and the most moving parts (refresh job, invalidation); unjustified for a dashboard a handful of admins open.

## Notes
- Route `src/app/(portal)/portal/admin/analytics`; inherits the admin gate from the admin `layout.tsx`; `getAdminAnalytics()` also calls `requireAdmin()` for defense-in-depth. Output is aggregate-only (no names/emails/PII). Inputs (`window`, `edition`) are whitelisted, never interpolated into a query.
- **Headline KPIs come from exact `count()` queries** (index-backed, no rows transferred), so the numbers stay correct at any scale; row reads exist only to draw charts and are **capped at `MAX_ROWS` (50k), ordered newest-first**, so a runaway table can neither OOM the request nor silently corrupt a headline number — at worst a chart shows the most-recent 50k rows.
- Charts use **Recharts** (client components); all aggregation stays server-side.
- **Escalation trigger:** if a windowed read on `assessment_attempts` / `resource_downloads` / `plan_item_progress` gets slow, move *that metric* into a `SECURITY DEFINER` RPC — the `AdminAnalytics` return shape is designed to stay stable across that swap.
- **Recommended follow-up (perf):** add `created_at` / `completed_at` / `submitted_at` indexes on the windowed engagement tables (`assessment_attempts`, `resource_downloads`, `lab_progress`, `tech_lab_progress`, `plan_item_progress`, `challenge_submissions`, `challenge_entries`, `profiles`, `students`) so the `.gte(...).order(...)` scans stay index-backed. Deferred as a separate additive migration (touches the live schema).
- Resource analytics are downloads-only for now: no `"view"` events are logged, and `resource_downloads.resource_id` mixes portal uuids and Sanity `_id`s, so there is no per-Resource name breakdown yet.

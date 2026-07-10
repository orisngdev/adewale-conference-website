# Registration & Onboarding Redesign — Plan

Turn registration into the single setup step: a school **self-registers** for an edition, **verifies email**, and is immediately in — the coordinator's account is created and every student rep gets a login + access code, with **no admin approval and no claim code**. Admin's review is a **separate competition-selection step at close** of registration (the "confirmation + guidelines" email). All of it **edition-scoped**.

> Status: **Phases 1–3 shipped** (edition tagging + backfill; self-service onboarding via 30-day branded link at `/portal/onboard`; auto-provisioning on both paths — migrations 023/024 pending `db:push`). Phases 4–6 (admin heads-up email, bulk approve/decline at close + entry-status banner + competition-page locking, resend/change-email) not yet built.

## Two separate steps (this is the key reframe)

Earlier this plan gated portal access behind admin approval. That conflated two different things:

- **Portal access** — using the portal to *prepare* (practice, tech lab, plans). This is **self-service with email verification. No admin approval.** Register → verify email → you're in, students provisioned.
- **Competition acceptance** — the site's *"confirmation after application review at close of registration, with the full competition guidelines."* This **is** a review, but it's a **batch competition-selection at close**, not an access gate. It decides who's accepted / advances to zonals and triggers the official guidelines email — *after* schools have already been prepping.

So a school registers → verifies email → prepares immediately → and separately gets its official "you're in, here are the guidelines" email once admin reviews the field at close.

## Decisions locked in

1. **Portal onboarding is self-service + email verification — no admin approval.** Register → verify email → immediate portal access with the student roster already provisioned.
2. **Competition entry is a separate review, visible to the educator.** The coordinator sees their entry status **prominently on their portal** — *Under review → Accepted / Declined* — and admin **approves or declines** schools (multi-select) at close. It's competition selection, never a gate on portal/prep access.
3. **Coordinator onboarding = email verification / magic link** (Supabase), not a claim code. Claim code kept only as a different-email fallback.
4. **Students never need email** — unique access code only. (Phone number a future add.)
5. **Registration auto-provisions the student roster** into logins + codes (both public and in-portal paths).
6. **Admin gets a heads-up email** on each new registration, and at close does the review: **multi-select → Approve** (accept + guidelines email) **or Decline** (+ a polite decline email). Adds a `declined` status.
7. **Everything is edition-scoped** (see the Editions section).

## Already shipped (in-portal path)

In-portal registration (`registerForEdition`) now **auto-provisions each rep** into a student login + code on submit, and the Students page copy reflects it. So for a **logged-in coordinator**, the vision is already true. This plan is mostly about the **public-form path** (the "instead of claiming" case) + editions + admin bulk-approve.

---

## The target flow (public-form path)

```
Public form (school + coordinator email + reps)
      │  writes Airtable (source of truth) + mirrors to Supabase
      ▼
Registration row (status = submitted, edition_year = open edition)
      ├─ EMAIL the coordinator: "Verify your email to access the portal" (magic link)
      └─ EMAIL admins: "New registration — <school> (<edition>)"  (awareness only, not a gate)
      ▼
Coordinator clicks verify → account active (coordinator role) → registration auto-linked
      │  (existing handle_new_user trigger links by email + promotes to coordinator)
      └─ students auto-provisioned → login + access code (edition-tagged)
      ▼
Coordinator lands on My school: school info + students + each access code to hand out.
Students sign in with their code → dashboard, My school, plans, etc.

  ── separately, at CLOSE of registration (competition selection, not access) ──
Admin → Registrations (filter by edition) → multi-select → "Qualify + send guidelines"
      → status → qualified; official confirmation + competition guidelines emailed.
```

The **in-portal path** is the same, minus the email step — the coordinator is already signed in and owns the registration.

---

## Editions (make the flow edition-aware)

Registrations, students, plans, assessments, and challenges are all keyed by `edition_year`. The onboarding must respect that.

- **Registration targets the open edition.** Only one edition has `registration_open = true`; the mirror stamps that `edition_year` on the row. (Admin opens/closes it under Editions.)
- **⚠️ Gap to fix:** the coordinator-provisioning path (`createStudentRecord`) inserts a `students` row **without `edition_year`**, while the seed sets it. Because `get_my_plans` matches a student's `edition_year` against a plan assignment's, **plans scoped to 2026 won't reach an untagged student.** Provisioning must **stamp the registration's `edition_year`** on each student. (This bug exists today for any hand-provisioned rep.)
- **Returning schools / students across editions (decided).** A school that ran a prior edition registers again → a **new registration row** (same `school_id`, new `edition_year`). Student rule: **match by name within the school — a returning student (same name) keeps their old access code; a genuinely new name gets a new student row + new code.** Each participation is stamped with the registration's `edition_year`. (This is what `createStudentRecord` already does for the code-reuse; we add edition tagging, plus a small `student_editions` link table if we want per-edition participation history.)
- **Admin views are edition-filtered.** The Registrations screen defaults to the open edition, with a filter to see past ones. Bulk-approve acts within the selected edition.
- **Coordinator access is edition-aware.** A coordinator approved for 2026 sees 2026 data; if they register again for 2027 with the same email, they're linked (no new invite).

---

## Admin: new-registration notification

On a new mirrored registration:
- **Email** every admin (the allowlist) via the existing `sendEmailSafely` (custom SMTP) — subject like *"New registration — Sunrise Model College (2026)"* with a link to the Registrations screen.
- **In-portal notification** row (the `notifications` table already exists and is admin-writable) so the bell shows it.
- Implementation: fire from the mirror step in `/api/registration` (service role), and/or a Postgres trigger on `registrations insert` that queues the notification. Email best-effort (never block the registration).

## Admin: bulk approve / decline at close (competition selection — not an access gate)

This is the site's "review at close of registration." Today `admin/registrations` sets status one row at a time via a `<select>`. Redesign:
- **Checkbox per registration** + a header checkbox (select all on the current edition/filter).
- Two bulk actions on the selection:
  - **Approve** → status `accepted`; send the official confirmation + competition-guidelines email.
  - **Decline** → status `declined`; send a polite "not selected this edition" email.
- **Add a `declined` status** — today's set is submitted / verified / qualified / finalist, with no reject state.
- Keep the per-row control for finer moves (`accepted → qualified → finalist`) and certificate issuing.
- Idempotent (won't re-send if a row is already in that state).
- Purely competition-side — portal access already happened at email verification, so this never blocks preparation.

## Coordinator sees their entry status — boldly

On the coordinator's dashboard / My school, a prominent banner reflects `registrations.status` for the current edition:
- **Under review** (submitted) — *"Your competition entry is under review — you'll be emailed the guidelines once schools are confirmed at close of registration. Meanwhile, prepare freely."*
- **Accepted** — *"You're in the {edition} competition"* (+ guidelines link).
- **Declined** — *"Your school wasn't selected for the {edition} competition this time."* (Prep access can remain.)

Students see a lighter version ("School entry: under review / accepted"). This is the educator-facing side of the admin approve/decline.

## Prep stays open; competition pages lock at close (decided)

After registration closes, the portal stays usable for **preparation**, but **competition pages lock**:
- **Open always (prep):** Practice drills, Tech Lab + learning, Pitch Studio, Learning plans, Resources, My school, Data-challenge *practice*.
- **Locked at close (competition):** the graded **Exams / CBT**, official **competition** challenge entries, and certificate issuance — gated on the edition's stage + the school's `accepted` status. A locked page explains itself ("Competition entry closed for {edition}"), not a 404.
- Enforce in two places: the page/layout (hide/lock the UI) **and** RLS/RPC (e.g. submitting a graded exam requires an active competition stage + an accepted school) so it can't be bypassed.
- (Exact page-by-page split to confirm — the Exams/CBT and official-challenge lines are the ones that matter.)

## The onboarding pipeline (runs on email verification, idempotent)

Triggered when the coordinator **verifies their email** (self-service) — or immediately for the in-portal path. A single re-runnable routine `onboardRegistration(regId)`:
1. **Coordinator:** the existing `handle_new_user` trigger already sets `owner_id` + `coordinator` role by matching `contact_email` — verification *is* access, nothing to gate.
2. **Provision students:** for each rep, create-or-reuse the student login + code, **stamped with the registration's `edition_year`**. (Reuses `createStudentRecord`, extended for edition + service-role context.)
3. Record `provisioned_count` on the row for the admin/coordinator view.
Idempotency: re-running never double-creates (students reused by name+school; `owner_id` set-once).

**Account creation & verification (decided):** the coordinator gets our **existing branded registration email**, now carrying a **verification link valid for 30 days** — a long-lived token stored on the registration (Supabase's built-in OTP/magic links expire too soon for 30 days, so we mint our own). Clicking it → a "set your password" page → account active; the existing trigger links the registration + coordinator role. This link **replaces the claim code** in that email. **Guard the public endpoint with a captcha + rate-limit** (it now creates accounts and sends mail), and expose a **resend**.

## Data model touches (small)

- `registrations`: add `contact_name` (nice for the invite + admin list), and lightweight status fields for the admin view — `invited_at timestamptz`, `provisioned_count int` (optional but helpful). `contact_email` + `claim_code` already exist.
- `students`: **write `edition_year`** on provisioning (column already exists). If we pick carry-over Option A with history, add a `student_editions (student_id, edition_year)` table; otherwise no new table.
- No change needed to `handle_new_user` (it already auto-links by email + promotes to coordinator).

## Retiring the claim code

Keep `claim_code` and `claim_registration` as a **fallback** for the edge case where someone signs up with a *different* email than the one on the form. Primary onboarding is invite-on-verify. Remove the claim code from the default confirmation email (or keep it as a small "signed up with a different email? use this code" footnote).

## Security & edge cases

- **The public endpoint now creates accounts + sends mail** → protect with **captcha + rate-limit** (email-bomb / junk-account vector). This is the main new risk vs. the old claim-code flow.
- **Wrong / typo'd coordinator email** → the verification link never reaches the real coordinator. Mitigate: a review/confirm step on the form; a **"resend / change email"** path; a typo creates at most an *unverified stub* (unusable until verified).
- **Existing account** → link, never re-create; never overwrite an existing `owner_id`.
- **Re-runs** → idempotent (no duplicate students; `owner_id` set-once).
- **Students provisioned independently of the coordinator** → fine; students belong to the `school`.
- **Access codes** stay server-generated, unique, reused by name-within-school; never derived from PII. Phone is a *future* optional field, not a login factor.
- **Email is best-effort** — a mail failure must never fail the registration; expose a resend.

## Phased rollout

1. **Editions correctness (do first, small):** stamp `edition_year` on provisioned students; default the admin Registrations screen to the open edition with a filter. Also fixes today's plans-not-reaching-hand-provisioned-students bug.
2. **Self-service coordinator onboarding:** the public form creates the coordinator's account + emails a magic-link verification (custom SMTP); on verify, the existing trigger links the registration + role. Captcha + rate-limit the endpoint. Retire the claim code to a fallback.
3. **Auto-provision students on the public path** at onboarding (edition-tagged) — the in-portal path already does this.
4. **Admin heads-up email + in-portal notification** on each new registration (awareness only).
5. **Bulk review at close:** multi-select + "Qualify + send guidelines" on the Registrations screen (competition selection).
6. **Resend / change email** for coordinators who mistyped or lost the verification email.

## Open decisions — resolved

- **Student code across editions:** match by name within the school — returning name keeps its code, new name gets a new code; each participation edition-tagged. ✅
- **Verification email:** the existing **branded** registration email carries a **30-day** verification link (custom long-lived token; replaces the claim code). ✅
- **After close:** prep stays open, **competition pages lock** (gated by edition stage + accepted status). ✅

Two small details left to confirm during the build:
- **Exact "competition pages" list** to lock (proposed: graded Exams/CBT, official challenge entries, certificates — everything else stays open for prep).
- **Participation history** — is name-match + a latest-edition tag enough, or do we add a `student_editions` table for per-edition history?

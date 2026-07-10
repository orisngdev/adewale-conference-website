# ASC Resource Portal — Demo Walkthrough

A top-to-bottom script for demoing the platform: a school discovers ASC, registers for the current edition (school + coordinator + student reps), admin reviews it, the coordinator sets up students and a learning plan, students learn/compete, and results flow back. Follow it in order; each act hands off to the next.

---

## 0. Before the demo (pre-flight checklist)

- [ ] **Apply migrations:** `npm run db:push` — this pushes `020` (tech-lab/pitch), `021` (my-school), `022` (data challenges). Without it, Tech Lab, Pitch Studio, My school, and Data Challenges error.
- [ ] **Dev/app running:** `npm run dev` (or the deployed URL).
- [ ] **Open the 2026 edition for registration** — it ships **closed**. Do it as admin: **Portal → Admin → Editions → open registration for 2026** (and confirm the stage is *Registration*). Nothing can register in-portal until this is on.
- [ ] **(Optional) One published assessment** so students can take an exam live — or author it during Act 6. **Admin → Assessments**.
- [ ] **The data challenge** ("Predict the Exam Score") is auto-seeded by migration `022` — verify it shows under **Student → Tech Lab → Data challenges**.
- [ ] **Browser setup:** open **three windows/profiles** (or normal + 2 incognito) so you can be **Admin**, **Coordinator**, and **Student** at once without logging out between acts.
- [ ] **Fallback data:** the seeded demo school "[DEMO] Mayflower Secondary School" with coordinator `educator@demo.test` / `demo12345` and student code `DEMO123` already has data — use it if a live step misbehaves.

**Personas & sample data (keep them consistent):**
| Role | Who | Login |
|---|---|---|
| Admin | You | `oris@joinoris.com` (email is allowlisted → auto-admin) |
| Coordinator | "Mrs. Bola Adé" | a fresh email you can receive at |
| School | "Sunrise Model College" · Ikenne LGA · Private | — |
| Student reps | Chidi Okeke (SS2), Ada Nwosu (SS3), Tunde Bello (SS1) | access codes generated in Act 3 |

---

## Act 1 — Discover & register (Coordinator)

**Story:** a teacher hears about ASC, visits the site, and registers their school.

1. **Landing page** — show the public site (hero, Programme, Hall of Fame). *Say:* "This is the public face — a STEM competition for Ogun State secondary schools."
2. Click **Portal** (top-right, next to Register) → the portal login.
3. **Sign up** as the coordinator (Mrs. Adé's email + a password) → lands on `/portal`. *Say:* "Anyone can create an account; what you can do depends on your role."
4. Go to **My school** (the coordinator area) → **Register your school for the 2026 edition**.
5. Fill the form: **school name** (Sunrise Model College), **LGA** (Ikenne), **category** (Private), and up to **3 student representatives** (name + class): Chidi (SS2), Ada (SS3), Tunde (SS1). Submit.
6. *Say:* "Because this is a brand-new school, Mrs. Adé becomes its **approved founding coordinator** automatically. If the school already existed, her membership would be **pending admin approval** instead — the school is the unit, coordinators are members of it."

> **Alternative:** the **public registration form** on the landing page (`/#register`) lets a school register *before* anyone has a portal account; that registration is later **claimed** with a claim code from **Portal → Claim**. The in-portal path above is the cleaner demo.

---

## Act 2 — Admin reviews (Admin)

**Story:** the conference team sees the new registration and verifies it.

1. Switch to the **Admin** window → **Portal → Admin**. *Say:* "Admin is an email allowlist, not a special password — my email is on it."
2. **Admin → Registrations** → the new **Sunrise Model College** registration is there with its reps. Open it.
3. **Advance its status:** `submitted → verified` (→ later `qualified` / `finalist` as the competition progresses). *Say:* "Admin verifies schools, moves them through the stages, and can issue certificates."
4. **(If the school had been pre-existing)** approve the coordinator's **pending membership** here so she gets access.
5. **Admin → Editions** — show stage control: the whole edition moves *Registration → Zonal → Regional → Finals*, and results/certificates hang off that.

---

## Act 3 — Coordinator sets up students & a plan (Coordinator)

**Story:** the coordinator turns reps into real student logins and assigns study.

1. Back in the **Coordinator** window → **My school → Students**.
2. The reps entered at registration **already have access codes** — auto-issued the moment the school registered. The roster shows each student with a **6-character code** (e.g. `K7P2QX`). *Say:* "No email — students log in with just this code, and it was created when the school registered. Nothing to provision." (The "Provision" button remains to issue a code for anyone added later.)
3. Copy Chidi's code — you'll use it in Act 4.
4. **My school → Learning plans → Create a plan** (e.g. "Week 1 — Algebra & Speed Drills"). Add a **module** and a couple of **items** (a practice drill, a study-pack link).
5. **The key step:** on the plan page, note the **status banner** — a plan is hidden until it's **Published *and* Assigned**. Click **Publish**, then under **"Who gets this plan"** assign it to **All levels** (or SS2). The banner flips to **Live**, and the plans list shows a **Live** badge. *Say:* "This is the guardrail — a plan only reaches students when it's both published and assigned."

---

## Act 4 — The student experience (Student)

**Story:** a student logs in and everything the coordinator did shows up.

1. **Student** window → **Portal → student login** → enter Chidi's **access code**. *Say:* "No email, no password to remember — just the code."
2. **Dashboard** — offline study banner, current edition/stage, the **Prepare** grid, recent results.
3. **My school** *(the payoff)* — Chidi sees **Sunrise Model College** and **Mrs. Adé's contact** — the registration from Act 1 comes full circle.
4. **My plans** — the plan assigned in Act 3 is here; open it, complete an item.
5. **Practice** — start a drill. *Say:* "Practice is offline-first — it works with no data and syncs when back online, and it never affects selection." (Toggle offline in devtools to show buffering if you like.)
6. **Tech Lab → Data challenges → Predict the Exam Score** *(the wow moment):*
   - Download **train.csv** / **test.csv**.
   - *Say:* "Like Zindi or Kaggle — students analyse the data (own machine, Colab, or in-browser), then upload predictions."
   - Upload a predictions CSV (`id,prediction`) → **it's scored instantly** and appears on the **leaderboard**. *Say:* "The answer key never leaves the server — scoring runs server-side, so the leaderboard can't be gamed. A naive guess scores ~15 RMSE; a simple line of best fit ~7."
7. **Pitch Studio** — the Design-Thinking stages + the interactive **Business Model Canvas** board (drag sticky notes). *Say:* "This is the innovation pillar — see the plan doc for where it's headed."
8. **Mobile:** shrink the window / open on a phone → the nav becomes a **native bottom tab bar** (it's an installable PWA). *Say:* "Mobile-first, low-bandwidth, installable."

---

## Act 5 — Content & assessments (Admin)

**Story:** where the exams and questions come from.

1. **Admin → Question bank** — show questions + **bulk import**. *Say:* "Questions live in an admin-only bank; correct answers never reach a student's browser."
2. **Admin → Assessments** — author a **practice** drill and a graded **exam**, publish them. *Say:* "Practice pools and exam pools are kept disjoint by a database rule — an exam question can't leak into practice where answers are shown."
3. **(Optional) Student takes the exam** — CBT engine with a timer and **tab-switch monitoring**; it's **server-graded**. The coordinator then sees the score under **My school → Results** (with any tab-switch flags).

---

## Act 6 — Results & recognition

1. **Admin → Registrations** → move Sunrise to `qualified` / `finalist`; **issue a certificate**.
2. **Student → Results** and **coordinator → Results** now reflect it; the certificate is downloadable.
3. **Public → Hall of Fame** (`/results`) — champions and finalists on the public site. *Say:* "The loop closes — public recognition drives the next cohort to register."

---

## What to emphasise (the "why this is good" beats)

- **Everyone connects:** one registration flows to admin, coordinator, and student, and the **My school** page proves it.
- **Offline & low-bandwidth by design** — PWA, offline practice buffering, small datasets, server-side grading. Built for metered mobile data.
- **Answer-safety is structural** — exam answers and challenge ground-truth are admin-only at the database level and never sent to the client.
- **Authentic, aspirational tech** — a Zindi/Kaggle-style data arena scaffolded for secondary students; a real innovation pillar.
- **Guardrails, not gotchas** — plans show exactly why they're hidden; roles gate everything cleanly.

## Troubleshooting (live-demo gotchas)

- **"Register" does nothing / no open edition** → admin hasn't **opened the 2026 edition** (Act 0). It ships closed.
- **Tech Lab / Pitch / My school / Challenges error** → migrations not pushed → run `npm run db:push`.
- **Plan not showing for the student** → it's **Draft** or **not assigned** — check the banner (Act 3, step 5).
- **New coordinator can't manage the school** → their membership is **pending**; approve it in **Admin → Registrations** (only happens for *existing* schools).
- **Admin menu missing** → that email isn't allowlisted, or it signed up before being added — set `profiles.role = 'admin'` for it, or use `oris@joinoris.com`.
- **Anything flaky mid-demo** → fall back to the seeded **[DEMO] Mayflower** school (`educator@demo.test` / `demo12345`, student `DEMO123`) which already has data.

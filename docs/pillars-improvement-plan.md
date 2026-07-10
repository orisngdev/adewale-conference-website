# Tech Skills Lab & Innovation/Pitch Studio — Improvement Plan

## Where they are today (honest read)

Both pillars shipped as **"a list of external links + one widget."** They introduce the topic but the student doesn't actually *do* or *prove* much inside the portal.

**Tech Skills Lab** (`src/app/(portal)/portal/student/tech-lab`, `src/lib/tech-lab.ts`)
- 3 steps (Scratch → Python → Data), each a link to an external site (`scratch.mit.edu`, `learnpython.org`, `code.org`).
- Progress is **self-marked** — a "Mark done" button writes to `tech_lab_progress`; completing all 3 unlocks a certificate. Nothing verifies the student learned anything.
- A passive **Trinket** IDE iframe (`TECH_LAB_IDE_URL`) — you can type Python, but there are no challenges, no checking, and it needs the network.
- 3 more curated links.

**Innovation / Pitch Studio** (`src/app/(portal)/portal/student/pitch-studio`, `src/lib/pitch-studio.ts`)
- 5 Design-Thinking stages rendered as **read-only cards** — no interaction.
- The **BMC board** (`bmc-board.tsx`, saved to `pitch_canvas`) — the one genuinely interactive piece.
- 3 more links. **There is no actual "pitch deck"**, no submission, and no feedback loop.

**The gap:** these are enrichment link-lists, not a learning-by-doing experience, and neither connects to the competition. A student can "complete" Tech Lab without writing a line of working code, and can't produce or submit a pitch at all.

## Principles (what "better" must respect here)

1. **Do-and-prove, not click-and-claim.** Progress should come from work the portal can observe (a passing challenge, a saved artifact, a submission) — not a self-marked checkbox.
2. **Low-bandwidth, offline-first.** Ogun State students, often on metered mobile data (see the JAMB-CBT + PWA offline decisions already in the repo). Prefer text + light assets; run what we can in the browser; cache aggressively; buffer to `localStorage` and sync — exactly like `src/lib/offline/practice-queue.ts`.
3. **Mobile-first.** Both pillars must be fully usable on a phone (they're now in the bottom-nav "More" sheet).
4. **Author content without deploys.** Lessons, challenges, rubrics, and worked examples belong in **Sanity**, like resources/news already do — so admins iterate without a release.
5. **RLS by the existing pattern.** New student artifacts follow the `plan_item_progress` shape: student self read/write; coordinators/admins read their school's; definer RPCs for anything cross-table (like `get_my_plans`, and the new `get_my_school`).
6. **Tie into the competition.** Both pillars should feed a student's competition profile — a Tech track and an Innovation track alongside the STEM CBT — otherwise they stay orphan features.

---

## Tech Skills Lab → "Learn · Build · Prove"

**Goal:** a student writes and runs real code *in the portal*, offline, and earns the certificate by passing checks — then submits a capstone for the Tech track.

1. **In-browser Python that actually runs & checks — replace the Trinket iframe.**
   Run Python client-side so challenges are auto-gradable and work offline. Two options (an open decision — see below):
   - **Pyodide** (CPython→WASM): full Python incl. `pandas`/`numpy` — perfect for the "Data" step, but a ~6–10 MB first load (cache once via the service worker, then offline).
   - **Skulpt** (JS Python subset): ~1 MB, instant, offline — great for Scratch→Python basics, but no real `pandas`.
   Likely **both**: Skulpt for steps 1–2, lazy-load Pyodide only on the Data step.
2. **Auto-checked coding challenges per step.** Each step gets 3–5 short challenges ("write `is_even(n)`…") with hidden test cases run against the student's code in the browser. Passing marks the step — evidence-based progress replaces the self-mark button.
3. **Lightweight lessons in-portal (Sanity).** Before the challenges, a short concept + worked example (text/code, optional external video link) so students don't have to leave to learn. Cached for offline.
4. **Capstone mini-project → Tech track submission.** A final task (e.g., "clean & summarise this CSV with pandas", or a small program) submitted like an assessment — status `submitted → reviewed`, visible to coordinators/admins, feeding the competition.
5. **Certificate becomes earned, not clicked** — issued when challenges + capstone are complete.

**Data model:** `tech_challenges` (Sanity or a table: step_key, prompt, starter_code, tests), `tech_submissions` (student_user_id, challenge/capstone id, code, passed, score). Progress rolls up from these instead of `tech_lab_progress` self-marks.

### The arena — a data-science competition (Zindi / Kaggle for schools)

This is the motivating end-state the learn-path feeds into: **"Zindi for Ogun State secondary schools."** It fits this codebase unusually well because the whole thing reduces to grading a predictions file against a hidden answer key — the exact **answer-safe, server-graded** pattern already used for `question_bank` (correct answers never reach the client) and `submit_practice_attempt` (server re-grades). The ground truth *is* the answer key; a metric replaces "count correct."

**The student loop (low-bandwidth by design):**
1. **Read the challenge** — problem, the metric, the deadline.
2. **Download a small dataset** — `train.csv` (with the target) + `test.csv` (target withheld), a few hundred KB, hosted on the Sanity CDN we already use for study packs. Small on purpose: teaching-scale, and cheap on mobile data.
3. **Analyse offline** — on their own machine, in-portal Pyodide, or a Google Colab link. The heavy compute is the student's, not ours.
4. **Upload predictions** — a tiny `id,prediction` CSV.
5. **Get scored + ranked** — a public leaderboard score returns instantly; a hidden private score decides the final ranking.

**Why the architecture is easy here:**
- **Ground truth stays server-only.** A `challenge_truth` table (challenge_id, id, true_value, `is_public`) with **admin-only RLS** — identical to `question_bank`. It never goes to the browser, so the leaderboard can't be gamed by reading the answers.
- **Scoring is a `SECURITY DEFINER` RPC**, not new infra. The client parses the uploaded CSV to JSON and calls `score_submission(challenge_id, predictions jsonb)`. The RPC joins predictions → `challenge_truth` and computes the metric **in SQL**:
  - accuracy = `avg((pred = truth)::int)`; RMSE = `sqrt(avg((pred-truth)^2))`; MAE = `avg(abs(pred-truth))`; (F1/AUC later).
  It writes `public_score` (over `is_public` rows) and `private_score` (the rest), enforces a **daily submission limit**, and returns only the public score. Truth never leaves the server.
- **Public vs private leaderboard** (the Kaggle anti-overfitting trick): rank by `public_score` until the deadline, reveal `private_score` after — so students can't overfit the leaderboard.
- **Leaderboard = a definer RPC** (best `public_score` per student, ranked) — the same shape as the existing results/Hall-of-Fame views. Show name + school + rank.

**Data model:** `challenges` (title, description_md, metric, id_column, target_column, train_url, test_url, deadline, edition_year, published, daily_limit), `challenge_truth` (admin-only), `challenge_submissions` (student_user_id, challenge_id, public_score, private_score, created_at). RLS: challenges read-when-published; truth admin-only; submissions self + school-staff read; leaderboard via RPC.

**Scaffolding for secondary students** (Zindi/Kaggle assume you already can do ML — our students can't yet): the Scratch→Python→Data learn-path is the **on-ramp**; ship a **starter notebook** and a deliberately gentle first challenge (e.g. "predict a student's exam score from study hours" — beginner regression) with a tutorial walkthrough. Difficulty tiers by level (SS1/SS2/SS3).

**Extra decision this raises:** where do students actually run Python? Pyodide in-portal (offline, small data), a **Google Colab** starter link (free, full power, needs internet + a Google account), or their own machine. Likely offer all three; Colab is the realistic default for anything beyond tiny datasets.

---

## Innovation / Pitch Studio → "Discover · Model · Pitch · Submit"

**Goal:** a student walks the design-thinking funnel filling real worksheets, builds a business model and a **pitch deck**, and submits it to the Innovation track for feedback.

1. **Interactive Design-Thinking worksheets (replace the read-only cards).** Each of the 5 stages becomes a saved worksheet tied to one **pitch project**: Empathize (interview/observation notes) → Define (one problem statement) → Ideate (idea list) → Prototype (description/sketch upload) → Test (feedback captured). A visible funnel with completion state.
2. **BMC as part of the project.** Fold the existing `pitch_canvas` board into the project so the model sits alongside the discovery work.
3. **The missing Pitch Deck builder.** A structured, templated deck — Problem · Solution · How it works · Market · Business model · Team · The Ask — fill-in-the-blanks (not freeform slideware), saved, and **printable to PDF** (reuse `print-button.tsx`) for judging. Low-bandwidth by construction.
4. **Submit + status + rubric.** Submit the project (`draft → submitted → reviewed → finalist`), and a judging **rubric** (problem clarity, feasibility, impact, business model, presentation) scored by coordinators/admins; students see the feedback.
5. **A worked example + templates** to model a strong pitch.
6. **Offline:** worksheets/deck buffered in `localStorage` and synced like practice attempts.

**Data model:** `pitch_projects` (owner, title, stage, edition), `pitch_worksheets`/JSON on the project, `pitch_deck` (structured slides JSON), `pitch_submissions` + `pitch_scores` (rubric). RLS mirrors `plan_item_progress` (self + school staff read).

---

## Shared groundwork

- **A judging/review surface** for coordinators + admins (list submissions, open, score against the rubric) — one component reused by both tracks; mirrors the existing plan-progress view.
- **Competition wiring:** surface Tech + Innovation status on the student overview and in results, so the pillars visibly count.
- **Sanity schemas** for lessons, challenges, rubric, and examples — admin-authorable.

## Phased rollout

1. **Phase 1 — make it real (highest value).** Tech: Skulpt REPL + auto-checked challenges for steps 1–2, evidence-based progress. Pitch: turn the 5 stages into saved worksheets on a `pitch_project`. *No judging yet — just do-and-save.*
2. **Phase 2 — create the artifacts.** Pitch **deck builder** + printable export. Tech **capstone** task + Pyodide for the Data step.
3. **Phase 3 — submit & judge.** Submission status + rubric scoring + the coordinator/admin review surface for both tracks; certificates become earned.
4. **Phase 4 — content & polish.** Sanity-authored lessons/challenges/examples, worked-example pitch, analytics, a11y pass.

## Open decisions (need your call)

1. **Is there a real competition Tech track and Innovation track with judges?** If yes, Phase 3 (submission + rubric + judging) is core. If these are purely self-study enrichment, we can stop at Phase 2 and skip judging.
2. **Python engine:** Skulpt-only (light, basics), Pyodide-only (full, heavy first load), or the hybrid (recommended). This is the main bandwidth trade-off.
3. **Prototype uploads in Pitch** (images/sketches) — allow file upload (Supabase Storage/Sanity), or keep it text-only for bandwidth?
4. **Content home:** Sanity (admin-authorable, recommended) vs hard-coded in `src/lib` (faster to ship, needs a deploy to change).

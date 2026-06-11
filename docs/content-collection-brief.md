# Content Collection Brief — Phase 1 (Editions + Results)

What we need from past organisers to build complete, credible Editions and Results pages.
Each item maps to a field in the Sanity content model (`docs/platform-roadmap.md` §3.1), so
once collected it goes straight into the Studio.

> **Collect first, transcribe later.** Don't worry about format — printed sheets, PDFs, WhatsApp
> photos, old flyers are all fine. We turn them into clean content. The two things that are hard to
> recover later are **high-resolution photos** and **accurate results (names/schools)** — prioritise those.

---

## 0. First, the big question

**How many past editions have there been, and which years?** Everything below repeats *per edition*.
List every year the conference ran (e.g. 2021, 2022, 2023, 2024, 2025) — even years with thin records;
a sparse edition page still adds credibility.

---

## 1. Per edition — the "edition record" (one per year)

For **each** past year, collect:

| # | What | Maps to (Sanity `edition`) | Priority | Notes / format |
|---|------|----------------------------|----------|----------------|
| 1 | The year | `year` | Must | e.g. 2024 |
| 2 | That year's theme / title | `theme` | Must | e.g. "Igniting Young Innovators" |
| 3 | Exact start & end dates | `startDate`, `endDate` | Must | DD/MM/YYYY; approx month is OK if exact unknown |
| 4 | Where it was held | (goes in `summary`) | Should | venue(s), town(s), zonal centres |
| 5 | A short recap — 1–3 paragraphs | `summary` | Must | What happened, who took part, the standout moment. Plain prose is fine; we format it. |
| 6 | Key numbers (see §2) | `stats[]` | Should | The credibility headline figures |
| 7 | Sponsors that year (see §4) | `sponsors[]` | Should | Names + logos |
| 8 | Hero photo + gallery (see §3) | `heroImage`, gallery | Must (hero) | One strong banner image minimum |
| 9 | Any press coverage / links | (goes in `summary` or News) | Nice | News articles, radio/TV mentions, social posts |

---

## 2. Key numbers (stats) — per edition

The figures that make the page impressive. Provide whatever is known:

- Number of **schools** that participated
- Number of **students / participants**
- Number of **LGAs / zones** covered
- Number of **finalists**
- Subjects / categories contested
- Any prize totals or scholarships awarded
- Number of judges / volunteers (optional)

Even approximate figures are useful — mark them as approximate and we'll phrase accordingly.

---

## 3. Photos & media — per edition

The single biggest driver of how good the pages look.

- **Hero image** (required): 1 strong, high-resolution landscape photo per edition (winners on stage,
  group shot, event banner). **Originals, not screenshots** — ideally ≥ 1600px wide.
- **Gallery** (10–30 photos per edition ideal): event highlights, prize-giving, students competing,
  group photos. Originals from the photographer's folder are best.
- **Logos / branding**: that year's event logo or flyer artwork if it differed.
- **Video** (optional): YouTube/Vimeo links to any recaps or highlight reels.
- **For each photo, if possible**: a one-line caption (who/what/where) and the year.

> Best delivery: a shared **Google Drive / cloud folder per year** with originals. Avoid sending photos
> through WhatsApp/compressed chat — it destroys resolution.

---

## 4. Sponsors & partners — per edition (and overall)

- Sponsor / partner **name** (exact, official spelling)
- **Logo** — vector (SVG/AI/EPS) or high-res PNG with transparent background preferred
- **Website URL**
- **Tier / level** if there was one (e.g. Platinum / Gold / Silver, or "Partner" / "Supporter")
- Which **year(s)** each sponsor supported

A single master list of all sponsors across all years, tagged with the years, is ideal.

---

## 5. Results — the Hall of Fame (the most valuable, most perishable data)

This is what families and schools search for. We need it as accurately as possible, **per edition**.

**For every placement / award, capture:**

| Column | Maps to (Sanity `result`) | Required | Example |
|--------|---------------------------|----------|---------|
| Edition / year | `edition` | Yes | 2024 |
| Category | `category` | Yes | "Senior Mathematics", "Junior Science" |
| Position | `position` | Yes | 1st / 2nd / 3rd / Finalist / Honourable Mention |
| School name | `schoolName` | Yes | "Mayflower Secondary School" |
| Student name(s) | `studentNames[]` | Yes | "Ada Okeke; Tunde Bello" |
| Zone / LGA | `zone` | Should | "Sagamu" |
| Score / mark | `score` | Optional | 95 |

**Best delivery: a single spreadsheet** with those columns, one row per winner, across all years.
We can import a clean spreadsheet directly. If results only exist as printed sheets or certificates,
send clear photos/scans and we'll transcribe them.

> **Accuracy matters most here** — names and school names will appear publicly and be quoted. Have the
> organiser who ran each edition verify spellings. Flag anything uncertain rather than guessing.

---

## 6. Optional but valuable (feeds News, Gallery, About — later phases)

- **Founder / organiser bios + photos** — name, role, short bio (for the About page / `person`).
- **Testimonials / quotes** from past winners, teachers, or parents.
- **News-worthy moments** per year (records broken, notable winners, dignitaries who attended).
- **The story / mission** — why the conference started, what it's grown into.

---

## 7. Suggested collection package (what to actually ask for)

To make this easy on the organisers, request:

1. **One spreadsheet** — tabs: `Editions` (the §1 facts + §2 stats per year), `Results` (§5 columns),
   `Sponsors` (§4).
2. **One cloud folder per year** — original-resolution photos + any videos/links.
3. **A logos folder** — sponsor + event logos in the best format available.
4. **A short note per edition** — the 1–3 paragraph recap (§1.5) and the founding story (§6).

### Priority order if their time is limited
1. **Results** (most valuable, hardest to recover) →
2. **Hero photo per edition** →
3. **Edition facts + recap + stats** →
4. **Sponsors + logos** →
5. **Gallery photos** →
6. Everything in §6.

Hand us 1–3 above for even one or two past editions and we can ship a credible Editions + Results
launch, then backfill the rest as it arrives.

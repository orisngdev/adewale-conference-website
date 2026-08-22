#!/usr/bin/env node
// Import the zonal finals results (2022-2025) from data/canonical/.
//
// This is almost entirely new data: student_stage_results and individual_awards are
// both empty today, and registration_stage_results holds only what the old CSV
// backfill derived from the raw sheets. The canonical workbook recomputes every
// school total from the student scores, so its school rows supersede those.
//
// Two things make the join work that a naive importer would get wrong:
//
//  * Student names are compared as an unordered SET of words. The 2025 tab writes
//    "STELLA AYOMIPOSI, IDOWU" where the database holds "IDOWU STELLA AYOMIPOSI".
//    On exact strings 2025 matches 2 of 490 rows; on word sets, 477.
//  * School codes are resolved through school_merges.absorbed_school_code, because
//    two schools were issued two codes each. Patterson Memorial's 2023 result is
//    filed under ASC-D860A5, which now resolves to ASC-2EB788.
//
// Default mode is DRY RUN. It writes reports plus one atomic SQL file that defaults
// to ROLLBACK, exactly like merge-schools.mjs.
//
//   node scripts/canonical/import-zonal-results.mjs --prod

import { createHash, randomUUID } from "node:crypto";
import {
  chunk,
  clean,
  createRestClient,
  loadEnv,
  normalizeSchoolName,
  parseBaseArgs,
  readTable,
  requireCredentials,
  writeReport,
  writeSql,
} from "./lib.mjs";

const YEARS = [2022, 2023, 2024, 2025];
const STAGE = "Qualifications";
const STUDENT_EMAIL_DOMAIN = "students.adewaleconference.local";
const SUBJECTS = ["Mathematics", "General Knowledge", "Biology", "Chemistry", "Physics", "Computer"];

function hash(input, length = 12) {
  return createHash("sha1").update(input).digest("hex").slice(0, length);
}

/** Word-set key: order-independent, so "A, B" matches "B A". */
function nameTokens(value) {
  return normalizeSchoolName(value)
    .split(" ")
    .filter((t) => t.length > 1)
    .sort()
    .join(" ");
}

function num(value) {
  const text = clean(value);
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const args = parseBaseArgs(process.argv);
  const envPath = loadEnv(args.envFile);
  console.log(`env       : ${envPath ?? args.envFile}`);
  const { url, key } = requireCredentials();
  console.log(`project   : ${new URL(url).host}`);
  const db = createRestClient(url, key);

  const [schools, merges, registrations, students, existingStage] = await Promise.all([
    db.selectAll("schools", "id,school_code,name"),
    db.selectAll("school_merges", "school_code,absorbed_school_code"),
    db.selectAll("registrations", "id,school_id,edition_year,created_at", { order: "created_at" }),
    // ORDER BY is load-bearing, not cosmetic. Where a school registered twice it has
    // two student rows per person, so the candidate list has two entries and we take
    // the first. Without a stable order that choice changes between runs and the same
    // score lands on a different student row each time, leaving duplicates behind.
    db.selectAll("students", "id,school_id,name,edition_year,deactivated_at,exam_id,access_code,created_at", {
      order: "created_at,id",
    }),
    db.selectAll("registration_stage_results", "registration_id,stage"),
  ]);

  const alias = new Map();
  for (const m of merges) if (m.absorbed_school_code) alias.set(m.absorbed_school_code, m.school_code);
  const idByCode = new Map(schools.filter((s) => s.school_code).map((s) => [s.school_code, s.id]));
  const nameById = new Map(schools.map((s) => [s.id, s.name]));
  const resolveCode = (code) => idByCode.get(alias.get(clean(code)) ?? clean(code));

  const stageByRegistration = new Set(existingStage.map((r) => `${r.registration_id}|${r.stage}`));
  const registrationsBy = new Map();
  for (const r of registrations) {
    const k = `${r.school_id}|${r.edition_year}`;
    if (!registrationsBy.has(k)) registrationsBy.set(k, []);
    registrationsBy.get(k).push(r);
  }
  /** Registrations for a school-year, best candidate first: the row that already
   *  carries stage results, then the oldest. */
  const registrationsFor = (schoolId, year) =>
    [...(registrationsBy.get(`${schoolId}|${year}`) ?? [])].sort((a, b) => {
      const hasStage = (stageByRegistration.has(`${b.id}|${STAGE}`) ? 1 : 0) -
        (stageByRegistration.has(`${a.id}|${STAGE}`) ? 1 : 0);
      if (hasStage) return hasStage;
      return String(a.created_at).localeCompare(String(b.created_at));
    });
  const pickRegistration = (schoolId, year) => registrationsFor(schoolId, year)[0] ?? null;

  // A school that submitted the form twice in one year has two registrations AND
  // two rows in the zonal tab, with different scores. Collapsing them onto one
  // registration would throw a real result away, so they are paired up instead.
  const allocated = new Map();
  const allocateRegistration = (schoolId, year) => {
    const key = `${schoolId}|${year}`;
    const used = allocated.get(key) ?? 0;
    const rows = registrationsFor(schoolId, year);
    allocated.set(key, used + 1);
    return rows[used] ?? null;
  };

  const byExact = new Map();
  const byToken = new Map();
  const byTokenAnyYear = new Map();
  for (const s of students) {
    push(byExact, `${s.school_id}|${s.edition_year}|${normalizeSchoolName(s.name)}`, s);
    push(byToken, `${s.school_id}|${s.edition_year}|${nameTokens(s.name)}`, s);
    push(byTokenAnyYear, `${s.school_id}|${nameTokens(s.name)}`, s);
  }

  const qualificationKey = await readTable(args.sourceDir, "qualification-key.csv");
  const normalisedType = new Map();
  for (const row of qualificationKey) {
    for (const year of YEARS) {
      const label = clean(row[`${year} label`]);
      if (label && label !== "—") normalisedType.set(`${year}|${label.toLowerCase()}`, row["Normalised Type"]);
    }
  }

  const plan = {
    schoolRows: [],
    studentRows: [],
    newStudents: [],
    awards: [],
    examIdUpdates: [],
    unattachable: [],
    ambiguousStudents: [],
  };
  const stats = { schoolTotal: 0, studentTotal: 0, matchExact: 0, matchToken: 0, matchAnyYear: 0 };

  for (const year of YEARS) {
    // ── school level ────────────────────────────────────────────────────────
    const schoolOutcome = new Map();
    for (const row of await readTable(args.sourceDir, `zonal-${year}-schools.csv`)) {
      stats.schoolTotal += 1;
      const schoolId = resolveCode(row["School ID"]);
      const qualified = clean(row["Qualified?"]).toLowerCase() === "yes";
      const outcome = qualified ? "advanced" : "eliminated";
      if (schoolId) schoolOutcome.set(schoolId, outcome);
      const registration = schoolId ? allocateRegistration(schoolId, year) : null;
      if (!registration) {
        plan.unattachable.push({
          year,
          school_code: clean(row["School ID"]),
          canonical_name: clean(row["Canonical School Name"]),
          resolved_school: schoolId ? nameById.get(schoolId) : "UNKNOWN CODE",
          students: clean(row["# Students"]),
          total_score: clean(row["Total Score"]),
          qualified: clean(row["Qualified?"]),
          reason: !schoolId
            ? "school code not in database"
            : registrationsFor(schoolId, year).length
              ? "school has fewer registrations than zonal result rows for this year"
              : "school has no registration for this year",
        });
        continue;
      }
      const recorded = clean(row["Qualification (as recorded)"]);
      plan.schoolRows.push({
        registration_id: registration.id,
        stage: STAGE,
        outcome,
        score: num(row["Total Score"]),
        qualification_type: clean(row["Qualification Type"]) ||
          normalisedType.get(`${year}|${recorded.toLowerCase()}`) || null,
        lga_rank: num(row["LGA Rank"]),
        state_rank: num(row["State Rank"]),
        note: [
          recorded ? `Qualification: ${recorded}` : null,
          `Zonal finals ${year}: ${clean(row["# Students"])} sat, best ${clean(row["Best Student Score"])}, mean ${clean(row["Mean Score"])}`,
        ].filter(Boolean).join(". "),
      });
    }

    // ── student level ───────────────────────────────────────────────────────
    for (const row of await readTable(args.sourceDir, `zonal-${year}-students.csv`)) {
      stats.studentTotal += 1;
      const schoolId = resolveCode(row["School ID"]);
      const name = clean(row.Student);
      if (!schoolId || !name) continue;
      const tokens = nameTokens(name);
      const exact = byExact.get(`${schoolId}|${year}|${normalizeSchoolName(name)}`);
      const token = byToken.get(`${schoolId}|${year}|${tokens}`);
      const anyYear = byTokenAnyYear.get(`${schoolId}|${tokens}`);
      const candidates = (exact ?? token ?? anyYear ?? null)?.slice().sort((a, b) =>
        String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || a.id.localeCompare(b.id),
      ) ?? null;
      if (candidates && candidates.length > 1) {
        plan.ambiguousStudents.push({
          year, school: nameById.get(schoolId), student: name, candidates: candidates.length,
        });
      }
      if (exact) stats.matchExact += 1;
      else if (token) stats.matchToken += 1;
      else if (anyYear) stats.matchAnyYear += 1;

      const attendance = clean(row.Attendance);
      const note = [
        clean(row["Exam ID"]) ? `Exam ${clean(row["Exam ID"])}` : null,
        attendance || null,
        clean(row.Zone) || null,
        clean(row.Center) ? `Centre: ${clean(row.Center)}` : null,
        clean(row["Student Qualification"]) || null,
      ].filter(Boolean).join(". ");
      const breakdown = year === 2022
        ? Object.fromEntries(SUBJECTS.map((s) => [s, num(row[s])]).filter(([, v]) => v !== null))
        : null;
      const outcome = attendance.toLowerCase() === "absent"
        ? "eliminated"
        : schoolOutcome.get(schoolId) ?? "eliminated";

      let studentId = candidates?.[0]?.id ?? null;
      let accessCode = candidates?.[0]?.access_code ?? null;
      if (!studentId) {
        // Sat the exam but was never recorded as a rep. Deterministic access_code
        // keeps a re-run idempotent.
        accessCode = hash(`zonal:${year}:${row["School ID"]}:${tokens}`, 10).toUpperCase();
        plan.newStudents.push({
          id: randomUUID(),
          school_id: schoolId,
          name,
          edition_year: year,
          access_code: accessCode,
          auth_email: `zonal.${accessCode.toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`,
          exam_id: clean(row["Exam ID"]) || null,
        });
      } else if (clean(row["Exam ID"]) && !candidates[0].exam_id) {
        plan.examIdUpdates.push({ id: studentId, exam_id: clean(row["Exam ID"]) });
      }

      plan.studentRows.push({
        access_code: accessCode,
        student_id: studentId,
        edition_year: year,
        stage: STAGE,
        outcome,
        score: num(row.Score),
        note,
        breakdown: breakdown && Object.keys(breakdown).length ? breakdown : null,
      });

      const individual = clean(row["Student Qualification"]);
      if (individual) {
        const registration = pickRegistration(schoolId, year);
        plan.awards.push({
          access_code: accessCode,
          student_id: studentId,
          edition_year: year,
          registration_id: registration?.id ?? null,
          stage: STAGE,
          title: individual,
          note: `Individual qualification recorded in the ${year} zonal finals results`,
        });
      }
    }
  }

  // A single INSERT .. ON CONFLICT cannot touch the same conflict key twice
  // ("cannot affect row a second time"), and two source rows can legitimately land
  // on one key: two aliased school codes in the same year, or two zonal rows the
  // name matcher resolved to the same student. Collapse before emitting.
  const collapsed = {
    school: dedupe(plan.schoolRows, (r) => `${r.registration_id}|${r.stage}`),
    student: dedupe(plan.studentRows, (r) => `${r.access_code}|${r.stage}|${r.edition_year}`),
    award: dedupe(plan.awards, (a) => `${a.access_code}|${a.edition_year}|${a.title}`),
    examId: dedupe(plan.examIdUpdates, (u) => u.id),
    newStudent: dedupe(plan.newStudents, (s) => s.access_code),
  };
  plan.schoolRows = collapsed.school.kept;
  plan.studentRows = collapsed.student.kept;
  plan.awards = collapsed.award.kept;
  plan.examIdUpdates = collapsed.examId.kept;
  plan.newStudents = collapsed.newStudent.kept;

  console.log("\n── plan ──────────────────────────────────────────────");
  console.log(`school result rows        : ${plan.schoolRows.length} of ${stats.schoolTotal}`);
  console.log(`  unattachable            : ${plan.unattachable.length}`);
  console.log(`student result rows       : ${plan.studentRows.length} of ${stats.studentTotal}`);
  console.log(`  matched exact name      : ${stats.matchExact}`);
  console.log(`  matched word-set        : ${stats.matchToken}`);
  console.log(`  matched other edition   : ${stats.matchAnyYear}`);
  console.log(`  new student rows        : ${plan.newStudents.length}`);
  console.log(`exam_id backfilled        : ${plan.examIdUpdates.length}`);
  console.log(`individual awards         : ${plan.awards.length}`);
  console.log(`ambiguous student matches : ${plan.ambiguousStudents.length}`);
  console.log(
    `duplicate keys collapsed  : school ${collapsed.school.dropped}, student ${collapsed.student.dropped}, ` +
      `award ${collapsed.award.dropped}, exam_id ${collapsed.examId.dropped}, new student ${collapsed.newStudent.dropped}`,
  );

  const reports = [
    await writeReport(args.reportDir, "zonal-unattachable.csv", plan.unattachable),
    await writeReport(args.reportDir, "zonal-new-students.csv", plan.newStudents),
    await writeReport(args.reportDir, "zonal-ambiguous-students.csv", plan.ambiguousStudents),
    // Every row the dedupe removed, so nothing is dropped out of sight.
    await writeReport(args.reportDir, "zonal-collapsed-duplicates.csv", [
      ...collapsed.school.droppedRows.map((r) => ({ kind: "school result", ...r })),
      ...collapsed.student.droppedRows.map((r) => ({ kind: "student result", ...r })),
      ...collapsed.examId.droppedRows.map((r) => ({ kind: "exam_id", ...r })),
    ]),
  ];
  console.log(`\nreports:\n${reports.map((r) => `  ${r}`).join("\n")}`);

  const sqlPath = await writeSql(args.reportDir, "import-zonal-results.sql", emitSql(plan));
  console.log(`\nSQL:\n  ${sqlPath}`);
  console.log(`\n  rehearse: psql "$SUPABASE_DB_URL" -f ${sqlPath}`);
  console.log(`  apply   : psql "$SUPABASE_DB_URL" -v apply=true -f ${sqlPath}`);
}

function lit(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function emitSql(plan) {
  const out = [];
  const w = (line = "") => out.push(line);
  w("-- Zonal finals results 2022-2025 — generated by scripts/canonical/import-zonal-results.mjs");
  w("-- One transaction, defaults to ROLLBACK. Regenerate rather than hand-editing.");
  w("");
  w("\\set ON_ERROR_STOP on");
  w("\\if :{?apply}");
  w("\\else");
  w("  \\set apply false");
  w("\\endif");
  w("");
  w("begin;");
  w("");
  w("do $$");
  w("begin");
  w("  if not exists (select 1 from information_schema.columns where table_schema='public'");
  w("      and table_name='student_stage_results' and column_name='edition_year') then");
  w("    raise exception 'apply migration 20260822090000 first';");
  w("  end if;");
  w("end $$;");
  w("");

  // New students first, so their results can join on access_code.
  if (plan.newStudents.length) {
    w("-- ── students who sat the exam but were never recorded as reps ───────────────");
    for (const batch of chunk(plan.newStudents, 200)) {
      w("insert into public.students (id, school_id, name, edition_year, access_code, auth_email, exam_id) values");
      w(batch.map((s) => `  (${lit(s.id)}, ${lit(s.school_id)}, ${lit(s.name)}, ${s.edition_year}, ` +
        `${lit(s.access_code)}, ${lit(s.auth_email)}, ${lit(s.exam_id)})`).join(",\n") +
        "\non conflict (access_code) do nothing;");
    }
    w("");
  }

  if (plan.examIdUpdates.length) {
    w("-- ── exam numbers onto students that already existed ────────────────────────");
    for (const batch of chunk(plan.examIdUpdates, 300)) {
      w("update public.students s set exam_id = v.exam_id from (values");
      w(batch.map((u) => `  (${lit(u.id)}::uuid, ${lit(u.exam_id)})`).join(",\n"));
      w(") as v(id, exam_id) where s.id = v.id and s.exam_id is null;");
    }
    w("");
  }

  if (plan.schoolRows.length) {
    w("-- ── school totals, ranks and qualification route ───────────────────────────");
    for (const batch of chunk(plan.schoolRows, 200)) {
      w("insert into public.registration_stage_results");
      w("  (registration_id, stage, outcome, score, qualification_type, lga_rank, state_rank, note) values");
      w(batch.map((r) => `  (${lit(r.registration_id)}, ${lit(r.stage)}, ${lit(r.outcome)}, ` +
        `${r.score ?? "null"}, ${lit(r.qualification_type)}, ${r.lga_rank ?? "null"}, ` +
        `${r.state_rank ?? "null"}, ${lit(r.note)})`).join(",\n"));
      w("on conflict (registration_id, stage) do update set");
      w("  outcome = excluded.outcome, score = excluded.score,");
      w("  qualification_type = excluded.qualification_type, lga_rank = excluded.lga_rank,");
      w("  state_rank = excluded.state_rank, note = excluded.note, updated_at = now();");
    }
    w("");
  }

  if (plan.studentRows.length) {
    w("-- ── per-student scores, keyed by access_code so new and existing rows both work");
    for (const batch of chunk(plan.studentRows, 200)) {
      w("insert into public.student_stage_results");
      w("  (student_id, stage, edition_year, outcome, score, note, breakdown)");
      w("select st.id, v.stage, v.edition_year, v.outcome, v.score, v.note, v.breakdown");
      w("from (values");
      w(batch.map((r) => `  (${lit(r.access_code)}, ${lit(r.stage)}, ${r.edition_year}, ${lit(r.outcome)}, ` +
        `${r.score ?? "null"}, ${lit(r.note)}, ${r.breakdown ? `${lit(JSON.stringify(r.breakdown))}::jsonb` : "null::jsonb"})`)
        .join(",\n"));
      w(") as v(access_code, stage, edition_year, outcome, score, note, breakdown)");
      w("join public.students st on st.access_code = v.access_code");
      w("on conflict (student_id, stage, edition_year) do update set");
      w("  outcome = excluded.outcome, score = excluded.score, note = excluded.note,");
      w("  breakdown = excluded.breakdown, updated_at = now();");
    }
    w("");
  }

  if (plan.awards.length) {
    w("-- ── 2025 individual qualification labels ───────────────────────────────────");
    for (const batch of chunk(plan.awards, 200)) {
      w("insert into public.individual_awards (edition_year, student_id, registration_id, stage, title, note)");
      w("select v.edition_year, st.id, v.registration_id, v.stage, v.title, v.note");
      w("from (values");
      w(batch.map((a) => `  (${a.edition_year}, ${lit(a.access_code)}, ${a.registration_id ? `${lit(a.registration_id)}::uuid` : "null::uuid"}, ` +
        `${lit(a.stage)}, ${lit(a.title)}, ${lit(a.note)})`).join(",\n"));
      w(") as v(edition_year, access_code, registration_id, stage, title, note)");
      w("join public.students st on st.access_code = v.access_code");
      w("where not exists (select 1 from public.individual_awards ia");
      w("  where ia.student_id = st.id and ia.edition_year = v.edition_year and ia.title = v.title);");
    }
    w("");
  }

  w("-- ── summary ────────────────────────────────────────────────────────────────");
  w("select");
  w("  (select count(*) from public.registration_stage_results where stage = 'Qualifications') as school_results,");
  w("  (select count(*) from public.student_stage_results)                                    as student_results,");
  w("  (select count(*) from public.student_stage_results where breakdown is not null)         as with_subjects,");
  w("  (select count(*) from public.individual_awards)                                        as awards,");
  w("  (select count(*) from public.students)                                                 as students,");
  w("  (select count(*) from public.students where exam_id is not null)                       as with_exam_id;");
  w("");
  w("\\if :apply");
  w("commit;");
  w("\\echo '>>> COMMITTED'");
  w("\\else");
  w("rollback;");
  w("\\echo '>>> ROLLED BACK — nothing was changed.'");
  w("\\endif");
  return out.join("\n");
}

/** Keep the first row per key; report how many were dropped. */
function dedupe(rows, keyOf) {
  const seen = new Set();
  const kept = [];
  let dropped = 0;
  const droppedRows = [];
  for (const row of rows) {
    const key = keyOf(row);
    if (seen.has(key)) {
      dropped += 1;
      droppedRows.push({ key, ...row });
      continue;
    }
    seen.add(key);
    kept.push(row);
  }
  return { kept, dropped, droppedRows };
}

function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});

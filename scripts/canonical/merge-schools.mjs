#!/usr/bin/env node
// Collapse duplicate school rows onto the canonical ASC-XXXXXX School IDs from
// data/canonical/, then adopt the canonical name, LGA, category and email.
//
// 741 rows in prod describe 534 real schools, because five separate code paths each
// find-or-create with a different normalizer against a table with no natural key.
// This script is the one-time repair; migration 20260822090000 adds the key and the
// follow-up unique index makes recurrence impossible.
//
// Default mode is DRY RUN: it writes reports to data/canonical/reports/ and touches
// nothing. Review those, then re-run with --apply.
//
//   node scripts/canonical/merge-schools.mjs                     # dry run, .env
//   node scripts/canonical/merge-schools.mjs --prod               # dry run, .env.prod
//   node scripts/canonical/merge-schools.mjs --prod --apply       # write

import {
  clean,
  counter,
  createRestClient,
  loadEnv,
  normalizeSchoolName,
  parseBaseArgs,
  readTable,
  requireCredentials,
  writeReport,
  writeSql,
} from "./lib.mjs";

const YEARS = [2022, 2023, 2024, 2025, 2026];

// Two schools were issued two canonical codes each by the cleanup workbook. Both are
// confirmed one school by evidence the workbook did not cross-check: identical school
// email and coordinators, and for Patterson the same principal and street address too.
// Patterson's 2023 registration was filed under a person's name, which is also where
// its 2023 zonal result currently sits.
//
// Read as: absorbed code -> surviving code.
const CODE_ALIASES = new Map([
  // ASERO HIGH SCHOOL, ASERO, ABEOKUTA (2024) -> ASERO HIGH SCHOOL SENIOR (2022, 2023)
  ["ASC-6522C6", "ASC-3DD972"],
  // OYEDELE INIOLUWA BEULAH (2023) -> PATTERSON MEMORIAL BAPTIST GRAMMAR SCHOOL
  ["ASC-D860A5", "ASC-2EB788"],
]);

function resolveCode(code) {
  return CODE_ALIASES.get(code) ?? code;
}

// Every table with a school_id FK. registrations is ON DELETE SET NULL while the rest
// cascade, so nothing may be left behind when the absorbed row is deleted.
const CHILD_TABLES = [
  "registrations",
  "learning_plans",
  "plan_assignments",
  "student_replacements",
  "info_change_requests",
];

function printHelp() {
  console.log(`Usage:
  node scripts/canonical/merge-schools.mjs [--prod | --env-file PATH] [--apply]
                                          [--source-dir DIR] [--report-dir DIR]

Default is a dry run. Required env for --apply:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SECRET_KEY
`);
}

// ── canonical side ───────────────────────────────────────────────────────────

async function loadCanonical(sourceDir) {
  const master = await readTable(sourceDir, "school-master.csv");
  const byCode = new Map();
  const byName = new Map();
  for (const row of master) {
    const code = row["School ID"];
    if (!code) continue;
    byCode.set(code, {
      code,
      name: row["Canonical School Name"],
      lga: row.LGA,
      category: row["School Category"],
      email: row["School Email"],
    });
    byName.set(normalizeSchoolName(row["Canonical School Name"]), code);
  }

  // (year, normalized submitted spelling) -> code, plus an any-year fallback.
  const byYearSpelling = new Map();
  const bySpelling = new Map();
  // Rows the cleanup refused, keyed by spelling so the DB row inherits its verdict.
  const exclusions = new Map();

  for (const year of YEARS) {
    const rows = await readTable(sourceDir, `registration-${year}.csv`);
    const spellingColumn = rows.length && "Full Name of School" in rows[0] ? "Full Name of School" : "School";
    for (const row of rows) {
      const spelling = normalizeSchoolName(row[spellingColumn]);
      if (!spelling) continue;
      const code = row["School ID"];
      if (!code) {
        exclusions.set(spelling, row["Name Resolution"] || "Unresolved");
        continue;
      }
      addTo(byYearSpelling, `${year}|${spelling}`, code);
      addTo(bySpelling, spelling, code);
    }
  }

  // The zonal workbook resolves two schools the registration workbook gave up on
  // (ensydam@outlook.com -> ENSYDAM MODEL COLLEGE, Grace College -> GRACE GROUP OF
  // SCHOOLS), confirmed at student level. Used only as a fallback for rows nothing
  // else matched, so it cannot perturb an already-resolved row.
  const aliases = new Map();
  for (const row of await readTable(sourceDir, "name-decisions-applied.csv")) {
    const from = normalizeSchoolName(row["School name in results"]);
    const target = byName.get(normalizeSchoolName(row["Resolved to"]));
    if (from && target) addTo(aliases, from, target);
  }

  return { master, byCode, byName, byYearSpelling, bySpelling, aliases, exclusions };
}

function addTo(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

// ── database side ────────────────────────────────────────────────────────────

async function loadDatabase(db) {
  const [schools, registrations, members, students] = await Promise.all([
    db.selectAll("schools", "id,name,lga,category,address,email,airtable_id,school_code,created_at", {
      order: "created_at",
    }),
    db.selectAll("registrations", "id,school_id,edition_year,status", { order: "created_at" }),
    db.selectAll("school_members", "id,school_id,email,status,profile_id,onboarded_at,created_at", {
      order: "created_at",
    }),
    db.selectAll("students", "id,school_id,name,auth_user_id,deactivated_at,edition_year,created_at", {
      order: "created_at",
    }),
  ]);

  const others = {};
  for (const table of CHILD_TABLES) {
    if (table === "registrations") continue;
    others[table] = await db.selectAll(table, "id,school_id");
  }

  return { schools, registrations, members, students, others };
}

// ── mapping ──────────────────────────────────────────────────────────────────

/**
 * Resolve every DB school row to a canonical code. Evidence is weighted so the
 * strongest signal wins: the school's name matched inside the year tab for a year it
 * actually registered in, then its name anywhere in the canonical data.
 */
function buildMapping(canonical, dbData) {
  const registrationsBySchool = new Map();
  for (const reg of dbData.registrations) {
    if (!reg.school_id) continue;
    if (!registrationsBySchool.has(reg.school_id)) registrationsBySchool.set(reg.school_id, []);
    registrationsBySchool.get(reg.school_id).push(reg);
  }

  const assigned = new Map();
  const unmapped = [];
  const ambiguous = [];

  for (const school of dbData.schools) {
    const name = normalizeSchoolName(school.name);
    const votes = new Map();
    const bump = (code, weight) => votes.set(code, (votes.get(code) ?? 0) + weight);

    for (const reg of registrationsBySchool.get(school.id) ?? []) {
      for (const code of canonical.byYearSpelling.get(`${reg.edition_year}|${name}`) ?? []) bump(code, 3);
    }
    for (const code of canonical.bySpelling.get(name) ?? []) bump(code, 1);
    for (const code of canonical.byName.has(name) ? [canonical.byName.get(name)] : []) bump(code, 1);

    if (!votes.size) {
      // Second chance from the zonal workbook's own name decisions.
      for (const code of canonical.aliases.get(name) ?? []) bump(code, 1);
    }

    if (!votes.size) {
      unmapped.push(school);
      continue;
    }

    // Alias first, then consolidate: a row voting for both codes of an aliased pair
    // must end up with one combined tally, not two that look like a tie.
    const resolved = new Map();
    for (const [code, weight] of votes) {
      const target = resolveCode(code);
      resolved.set(target, (resolved.get(target) ?? 0) + weight);
    }
    const ranked = [...resolved.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
      ambiguous.push({ school, ranked });
    }
    assigned.set(school.id, ranked[0][0]);
  }

  return { assigned, unmapped, ambiguous, registrationsBySchool };
}

// ── planning ─────────────────────────────────────────────────────────────────

/** The row we keep. Prefer real Airtable provenance, then the richest history, then age. */
function pickSurvivor(rows, registrationsBySchool, code) {
  return [...rows].sort((a, b) => {
    const holdsCode = (a.school_code === code ? 0 : 1) - (b.school_code === code ? 0 : 1);
    if (holdsCode) return holdsCode;
    const provenance = (a.airtable_id ? 0 : 1) - (b.airtable_id ? 0 : 1);
    if (provenance) return provenance;
    const history =
      (registrationsBySchool.get(b.id)?.length ?? 0) - (registrationsBySchool.get(a.id)?.length ?? 0);
    if (history) return history;
    return String(a.created_at).localeCompare(String(b.created_at));
  })[0];
}

/** Of a set of duplicate memberships, the one worth keeping. */
function pickMember(rows) {
  return [...rows].sort((a, b) => {
    const linked = (a.profile_id ? 0 : 1) - (b.profile_id ? 0 : 1);
    if (linked) return linked;
    const onboarded = (a.onboarded_at ? 0 : 1) - (b.onboarded_at ? 0 : 1);
    if (onboarded) return onboarded;
    return String(a.created_at).localeCompare(String(b.created_at));
  })[0];
}

/** Of a set of same-named active students, the one that stays active. */
function pickStudent(rows) {
  return [...rows].sort((a, b) => {
    const linked = (a.auth_user_id ? 0 : 1) - (b.auth_user_id ? 0 : 1);
    if (linked) return linked;
    return String(a.created_at).localeCompare(String(b.created_at));
  })[0];
}

function planMerge(canonical, dbData, mapping) {
  const membersBySchool = groupBy(dbData.members, "school_id");
  const studentsBySchool = groupBy(dbData.students, "school_id");
  const othersBySchool = {};
  for (const [table, rows] of Object.entries(dbData.others)) othersBySchool[table] = groupBy(rows, "school_id");

  const groups = new Map();
  for (const school of dbData.schools) {
    const code = mapping.assigned.get(school.id);
    if (!code) continue;
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(school);
  }

  const plan = {
    groups: [],
    flagged: [],
    fieldChanges: [],
    memberDrops: [],
    studentDeactivations: [],
    stats: counter(),
  };

  for (const [code, rows] of groups) {
    const target = canonical.byCode.get(code);
    const survivor = pickSurvivor(rows, mapping.registrationsBySchool, code);
    const absorbed = rows.filter((r) => r.id !== survivor.id);

    // Memberships: dedupe on lower(email) across the whole group. The constraint is
    // unique (school_id, email), so the loser must go before anything is re-pointed.
    const memberGroups = new Map();
    for (const row of rows) {
      for (const member of membersBySchool.get(row.id) ?? []) {
        const key = (member.email ?? "").trim().toLowerCase();
        if (!memberGroups.has(key)) memberGroups.set(key, []);
        memberGroups.get(key).push(member);
      }
    }
    const memberDropIds = [];
    for (const [email, dupes] of memberGroups) {
      if (dupes.length < 2) continue;
      const keep = pickMember(dupes);
      for (const member of dupes) {
        if (member.id === keep.id) continue;
        memberDropIds.push(member.id);
        plan.memberDrops.push({
          school_code: code,
          canonical_name: target?.name ?? "",
          email,
          dropped_member_id: member.id,
          dropped_from_school: rows.find((r) => r.id === member.school_id)?.name ?? "",
          kept_member_id: keep.id,
          kept_has_profile: keep.profile_id ? "yes" : "no",
          kept_onboarded: keep.onboarded_at ? "yes" : "no",
        });
      }
    }

    // Students: students_active_name_uniq is (school_id, lower(name)) WHERE active,
    // so same-named active rows must be deactivated before the group is re-pointed.
    const studentGroups = new Map();
    for (const row of rows) {
      for (const student of studentsBySchool.get(row.id) ?? []) {
        if (student.deactivated_at) continue;
        const key = (student.name ?? "").trim().toLowerCase();
        if (!studentGroups.has(key)) studentGroups.set(key, []);
        studentGroups.get(key).push(student);
      }
    }
    const studentDeactivateIds = [];
    for (const [name, dupes] of studentGroups) {
      if (dupes.length < 2) continue;
      const keep = pickStudent(dupes);
      for (const student of dupes) {
        if (student.id === keep.id) continue;
        studentDeactivateIds.push(student.id);
        plan.studentDeactivations.push({
          school_code: code,
          canonical_name: target?.name ?? "",
          student_name: student.name,
          deactivated_student_id: student.id,
          deactivated_edition_year: student.edition_year ?? "",
          kept_student_id: keep.id,
          kept_edition_year: keep.edition_year ?? "",
          kept_has_login: keep.auth_user_id ? "yes" : "no",
        });
      }
    }

    // Field corrections on the survivor. Name, LGA and category are authoritative;
    // email only fills a gap, since the canonical column is blank for many schools.
    const patch = {};
    if (target) {
      if (clean(survivor.name) !== target.name) patch.name = target.name;
      if (clean(survivor.lga) !== target.lga) patch.lga = target.lga;
      if (clean(survivor.category) !== target.category) patch.category = target.category;
      if (!clean(survivor.email) && target.email) patch.email = target.email.trim();
    }
    if (survivor.school_code !== code) patch.school_code = code;
    for (const [field, value] of Object.entries(patch)) {
      if (field === "school_code") continue;
      plan.fieldChanges.push({
        school_code: code,
        survivor_id: survivor.id,
        field,
        from: survivor[field] ?? "",
        to: value,
      });
    }

    const moved = { registrations: 0 };
    for (const row of absorbed) {
      moved.registrations += mapping.registrationsBySchool.get(row.id)?.length ?? 0;
    }
    for (const table of Object.keys(dbData.others)) {
      moved[table] = absorbed.reduce((n, row) => n + (othersBySchool[table].get(row.id)?.length ?? 0), 0);
    }

    plan.groups.push({
      code,
      canonical: target,
      survivor,
      absorbed,
      patch,
      memberDropIds,
      studentDeactivateIds,
      moved,
      movedMembers: absorbed.reduce((n, r) => n + (membersBySchool.get(r.id)?.length ?? 0), 0),
      movedStudents: absorbed.reduce((n, r) => n + (studentsBySchool.get(r.id)?.length ?? 0), 0),
    });

    plan.stats.add("canonical schools");
    if (absorbed.length) plan.stats.add("merge groups");
    plan.stats.add("rows absorbed", absorbed.length);
  }

  // Rows the cleanup deliberately excluded keep their data but get no school_code.
  for (const school of mapping.unmapped) {
    const reason = canonical.exclusions.get(normalizeSchoolName(school.name)) ?? "Not in canonical workbook";
    plan.flagged.push({ school, reason });
    plan.stats.add("rows flagged");
  }

  return plan;
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    if (!row[key]) continue;
    if (!map.has(row[key])) map.set(row[key], []);
    map.get(row[key]).push(row);
  }
  return map;
}

// ── reporting ────────────────────────────────────────────────────────────────

async function writeReports(reportDir, plan, mapping, dbData) {
  const rows = [];
  for (const group of plan.groups) {
    rows.push({
      school_code: group.code,
      canonical_name: group.canonical?.name ?? "",
      lga: group.canonical?.lga ?? "",
      category: group.canonical?.category ?? "",
      role: "survivor",
      db_school_id: group.survivor.id,
      db_name: group.survivor.name,
      db_lga: group.survivor.lga ?? "",
      db_category: group.survivor.category ?? "",
      airtable_id: group.survivor.airtable_id ?? "",
      group_size: group.absorbed.length + 1,
      registrations_gained: group.moved.registrations,
      members_gained: group.movedMembers,
      students_gained: group.movedStudents,
      members_dropped: group.memberDropIds.length,
      students_deactivated: group.studentDeactivateIds.length,
      fields_changed: Object.keys(group.patch).filter((f) => f !== "school_code").join(" "),
    });
    for (const row of group.absorbed) {
      rows.push({
        school_code: group.code,
        canonical_name: group.canonical?.name ?? "",
        role: "absorbed",
        db_school_id: row.id,
        db_name: row.name,
        db_lga: row.lga ?? "",
        db_category: row.category ?? "",
        airtable_id: row.airtable_id ?? "",
        group_size: group.absorbed.length + 1,
      });
    }
  }
  for (const entry of plan.flagged) {
    rows.push({
      school_code: "",
      canonical_name: "",
      role: "flagged",
      db_school_id: entry.school.id,
      db_name: entry.school.name,
      db_lga: entry.school.lga ?? "",
      db_category: entry.school.category ?? "",
      fields_changed: `exclusion_reason=${entry.reason}`,
    });
  }

  const written = [];
  written.push(await writeReport(reportDir, "merge-plan.csv", rows));
  written.push(await writeReport(reportDir, "merge-field-changes.csv", plan.fieldChanges));
  written.push(await writeReport(reportDir, "merge-member-drops.csv", plan.memberDrops));
  written.push(await writeReport(reportDir, "merge-student-deactivations.csv", plan.studentDeactivations));
  written.push(
    await writeReport(
      reportDir,
      "merge-ambiguous.csv",
      mapping.ambiguous.map((a) => ({
        db_school_id: a.school.id,
        db_name: a.school.name,
        candidates: a.ranked.map(([code, score]) => `${code}:${score}`).join(" "),
      })),
    ),
  );
  return written;
}

// ── SQL emission ─────────────────────────────────────────────────────────────

function lit(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function idList(ids) {
  return ids.map((id) => lit(id)).join(", ");
}

/**
 * The whole merge as ONE transaction. Emitting SQL rather than driving PostgREST
 * matters for two reasons: 204 merges either all land or none do, and the same file
 * can be rehearsed against real data with ROLLBACK before it is ever committed.
 */
function emitSql(plan, expected) {
  const out = [];
  const w = (line = "") => out.push(line);

  w("-- Canonical school merge — generated by scripts/canonical/merge-schools.mjs");
  w("-- Do not hand-edit: regenerate instead, so the guards match the plan.");
  w("--");
  w(`-- ${plan.groups.length} canonical schools, ${expected.absorbed} rows absorbed,`);
  w(`-- ${plan.flagged.length} rows flagged, ${plan.memberDrops.length} duplicate members dropped,`);
  w(`-- ${plan.studentDeactivations.length} students deactivated.`);
  w("--");
  w("-- Rehearse (changes nothing):  psql \"$SUPABASE_DB_URL\" -f merge-schools.sql");
  w("-- Apply:                       psql \"$SUPABASE_DB_URL\" -v apply=true -f merge-schools.sql");
  w();
  w("\\set ON_ERROR_STOP on");
  w("\\timing off");
  w("\\if :{?apply}");
  w("\\else");
  w("  \\set apply false");
  w("\\endif");
  w();
  w("begin;");
  w();
  w("-- ── preconditions ───────────────────────────────────────────────────────────");
  w("do $$");
  w("begin");
  w("  if not exists (");
  w("    select 1 from information_schema.columns");
  w("    where table_schema = 'public' and table_name = 'schools' and column_name = 'school_code'");
  w("  ) then");
  w("    raise exception 'migration 20260822090000_canonical_school_identity.sql has not been applied';");
  w("  end if;");
  w("  if not exists (select 1 from information_schema.tables");
  w("                where table_schema = 'public' and table_name = 'school_merges') then");
  w("    raise exception 'public.school_merges is missing; apply migration 20260822090000 first';");
  w("  end if;");
  w("  if not exists (");
  w("    select 1 from information_schema.columns");
  w("    where table_schema = 'public' and table_name = 'school_merges'");
  w("      and column_name = 'absorbed_school_code'");
  w("  ) then");
  w("    raise exception 'school_merges.absorbed_school_code is missing; apply migration 20260822090200 first';");
  w("  end if;");
  w("end $$;");
  w();
  w("-- The plan was computed against a snapshot of the table. If the row count has");
  w("-- moved, a school was created or removed since, and the plan must be regenerated.");
  w("do $$");
  w("declare n int;");
  w("begin");
  w("  select count(*) into n from public.schools;");
  w(`  if n <> ${expected.schoolsBefore} then`);
  w(`    raise exception 'public.schools has % rows, plan was built for ${expected.schoolsBefore} — regenerate the plan', n;`);
  w("  end if;");
  w("end $$;");
  w();
  w("-- Baseline for the post-merge assertions. Every school_id FK except");
  w("-- registrations is ON DELETE CASCADE, so a child row that failed to move would");
  w("-- be silently destroyed by the delete below — these counts catch that.");
  w("create temp table _merge_baseline on commit drop as");
  w("select");
  w("  (select count(*) from public.registrations)          as registrations,");
  w("  (select count(*) from public.school_members)         as members,");
  w("  (select count(*) from public.students)               as students,");
  w("  (select count(*) from public.learning_plans)         as learning_plans,");
  w("  (select count(*) from public.plan_assignments)       as plan_assignments,");
  w("  (select count(*) from public.student_replacements)   as student_replacements,");
  w("  (select count(*) from public.info_change_requests)   as info_change_requests;");
  w();

  plan.groups.forEach((group, index) => {
    if (!group.absorbed.length && !Object.keys(group.patch).length) return;
    const absorbedIds = group.absorbed.map((r) => r.id);
    w(`-- ── ${index + 1}/${plan.groups.length}  ${group.code}  ${(group.canonical?.name ?? "").replace(/\n/g, " ")}`);

    // Constraint-blocking rows must go before anything is re-pointed:
    // school_members is unique (school_id, email); students_active_name_uniq is
    // (school_id, lower(name)) where deactivated_at is null.
    if (group.memberDropIds.length) {
      w(`delete from public.school_members where id in (${idList(group.memberDropIds)});`);
    }
    if (group.studentDeactivateIds.length) {
      w(`update public.students set deactivated_at = now() where id in (${idList(group.studentDeactivateIds)});`);
    }

    if (absorbedIds.length) {
      const inList = idList(absorbedIds);
      for (const table of ["school_members", "students", ...CHILD_TABLES]) {
        w(`update public.${table} set school_id = ${lit(group.survivor.id)} where school_id in (${inList});`);
      }

      const values = group.absorbed
        .map((row) =>
          "  (" +
          [
            lit(group.survivor.id),
            lit(group.code),
            lit(row.id),
            lit(row.name),
            lit(row.school_code),
            lit(row.lga),
            lit(row.category),
            lit(row.airtable_id),
            String(group.moved.registrations),
            String(group.movedMembers),
            String(group.memberDropIds.length),
            String(group.movedStudents),
            String(group.studentDeactivateIds.length),
            `${lit(JSON.stringify(Object.fromEntries(Object.entries(group.moved).filter(([k]) => k !== "registrations"))))}::jsonb`,
            lit(`Merged into ${group.canonical?.name ?? group.code}`),
          ].join(", ") +
          ")",
        )
        .join(",\n");
      w("insert into public.school_merges (survivor_id, school_code, absorbed_id, absorbed_name,");
      w("  absorbed_school_code, absorbed_lga, absorbed_category, absorbed_airtable_id,");
      w("  moved_registrations, moved_members, dropped_members, moved_students,");
      w("  deactivated_students, moved_other, note) values");
      w(`${values};`);

      w(`delete from public.schools where id in (${inList});`);
    }

    if (Object.keys(group.patch).length) {
      const sets = Object.entries(group.patch).map(([field, value]) => `${field} = ${lit(value)}`);
      sets.push("updated_at = now()");
      w(`update public.schools set ${sets.join(", ")} where id = ${lit(group.survivor.id)};`);
    }
    w();
  });

  if (plan.flagged.length) {
    w("-- ── rows the cleanup deliberately excluded: kept, flagged, no school_code ───");
    for (const entry of plan.flagged) {
      w(
        `update public.schools set exclusion_reason = ${lit(entry.reason)}, updated_at = now() ` +
          `where id = ${lit(entry.school.id)};`,
      );
    }
    w();
  }

  w("-- ── post-merge assertions ───────────────────────────────────────────────────");
  w("do $$");
  w("declare b record; n int;");
  w("begin");
  w("  select * into b from _merge_baseline;");
  w("  select count(*) into n from public.schools;");
  w(`  if n <> ${expected.schoolsAfter} then raise exception 'schools is % rows, expected ${expected.schoolsAfter}', n; end if;`);
  w("  select count(*) into n from public.schools where school_code is not null;");
  w(`  if n <> ${expected.canonical} then raise exception 'canonical schools is %, expected ${expected.canonical}', n; end if;`);
  w("  select count(*) into n from public.schools where exclusion_reason is not null;");
  w(`  if n <> ${expected.flagged} then raise exception 'flagged schools is %, expected ${expected.flagged}', n; end if;`);
  w();
  w("  -- Nothing may be lost. registrations is ON DELETE SET NULL, the rest cascade.");
  w("  select count(*) into n from public.registrations where school_id is null;");
  w("  if n <> 0 then raise exception '% registrations lost their school', n; end if;");
  w("  select count(*) into n from public.registrations;");
  w("  if n <> b.registrations then raise exception 'registrations changed from % to %', b.registrations, n; end if;");
  w("  select count(*) into n from public.students;");
  w("  if n <> b.students then raise exception 'students changed from % to %', b.students, n; end if;");
  w("  select count(*) into n from public.learning_plans;");
  w("  if n <> b.learning_plans then raise exception 'learning_plans changed from % to %', b.learning_plans, n; end if;");
  w("  select count(*) into n from public.plan_assignments;");
  w("  if n <> b.plan_assignments then raise exception 'plan_assignments changed from % to %', b.plan_assignments, n; end if;");
  w("  select count(*) into n from public.student_replacements;");
  w("  if n <> b.student_replacements then raise exception 'student_replacements changed from % to %', b.student_replacements, n; end if;");
  w("  select count(*) into n from public.info_change_requests;");
  w("  if n <> b.info_change_requests then raise exception 'info_change_requests changed from % to %', b.info_change_requests, n; end if;");
  w();
  w("  -- Members are the one table that legitimately shrinks: exact duplicates dropped.");
  w("  select count(*) into n from public.school_members;");
  w(`  if n <> b.members - ${plan.memberDrops.length} then`);
  w(`    raise exception 'school_members is %, expected % (baseline minus ${plan.memberDrops.length})', n, b.members - ${plan.memberDrops.length};`);
  w("  end if;");
  w();
  w("  -- The whole point: one row per canonical name.");
  w("  select count(*) into n from (");
  w("    select public.school_norm_name(name) from public.schools");
  w("    group by 1 having count(*) > 1");
  w("  ) d;");
  w("  if n <> 0 then raise exception '% normalized school names are still duplicated', n; end if;");
  w();
  w("  raise notice 'all assertions passed';");
  w("end $$;");
  w();
  w("-- ── summary ─────────────────────────────────────────────────────────────────");
  w("select");
  w("  (select count(*) from public.schools)                                  as schools,");
  w("  (select count(*) from public.schools where school_code is not null)    as canonical,");
  w("  (select count(*) from public.schools where exclusion_reason is not null) as flagged,");
  w("  (select count(*) from public.school_merges)                            as merges_recorded,");
  w("  (select count(*) from public.registrations)                            as registrations,");
  w("  (select count(*) from public.school_members)                           as members,");
  w("  (select count(*) from public.students where deactivated_at is null)    as active_students;");
  w();
  w("\\if :apply");
  w("commit;");
  w("\\echo '>>> COMMITTED'");
  w("\\else");
  w("rollback;");
  w("\\echo '>>> ROLLED BACK — nothing was changed. Re-run with -v apply=true to commit.'");
  w("\\endif");
  w("");

  return out.join("\n");
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const args = parseBaseArgs(process.argv);
  const envPath = loadEnv(args.envFile);
  console.log(`env       : ${envPath ?? `${args.envFile} (not found, using shell environment)`}`);

  const { url, key } = requireCredentials();
  console.log(`project   : ${new URL(url).host}`);
  const db = createRestClient(url, key);

  const canonical = await loadCanonical(args.sourceDir);
  const dbData = await loadDatabase(db);
  console.log(
    `\ncanonical : ${canonical.byCode.size} schools, ${canonical.aliases.size} name aliases, ` +
      `${canonical.exclusions.size} excluded spellings`,
  );
  console.log(
    `database  : ${dbData.schools.length} schools, ${dbData.registrations.length} registrations, ` +
      `${dbData.members.length} members, ${dbData.students.length} students`,
  );

  const mapping = buildMapping(canonical, dbData);
  const plan = planMerge(canonical, dbData, mapping);

  const absorbed = plan.groups.reduce((n, g) => n + g.absorbed.length, 0);
  const expected = {
    schoolsBefore: dbData.schools.length,
    schoolsAfter: dbData.schools.length - absorbed,
    absorbed,
    canonical: plan.groups.length,
    flagged: plan.flagged.length,
  };

  console.log("\n── plan ──────────────────────────────────────────────");
  console.log(`canonical schools kept   : ${plan.groups.length}`);
  console.log(`merge groups (>1 row)    : ${plan.groups.filter((g) => g.absorbed.length).length}`);
  console.log(`school rows absorbed     : ${absorbed}`);
  console.log(`rows flagged, not merged : ${plan.flagged.length}`);
  console.log(`survivor field changes   : ${plan.fieldChanges.length}`);
  console.log(`duplicate members dropped: ${plan.memberDrops.length}`);
  console.log(`students deactivated     : ${plan.studentDeactivations.length}`);
  console.log(`ambiguous mappings       : ${mapping.ambiguous.length}`);
  console.log(
    `\nschools ${expected.schoolsBefore} -> ${expected.schoolsAfter}` +
      ` (${expected.canonical} canonical + ${expected.flagged} flagged)`,
  );
  console.log(`members  ${dbData.members.length} -> ${dbData.members.length - plan.memberDrops.length}`);

  const reports = await writeReports(args.reportDir, plan, mapping, dbData);
  console.log(`\nreports written:\n${reports.map((r) => `  ${r}`).join("\n")}`);

  if (mapping.ambiguous.length) {
    console.log("\nRefusing to emit SQL: ambiguous mappings must be resolved first.");
    process.exitCode = 1;
    return;
  }

  const sqlPath = await writeSql(args.reportDir, "merge-schools.sql", emitSql(plan, expected));
  console.log(`\nSQL written:\n  ${sqlPath}`);
  console.log("\nThe SQL is one transaction and defaults to ROLLBACK, so rehearsing changes nothing:");
  console.log(`  psql "$SUPABASE_DB_URL" -f ${sqlPath}`);
  console.log("Then, once the summary and assertions look right:");
  console.log(`  psql "$SUPABASE_DB_URL" -v apply=true -f ${sqlPath}`);

  if (args.apply) {
    console.log("\nNote: --apply no longer writes from this script. Run the SQL above instead.");
  }
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});

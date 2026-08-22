#!/usr/bin/env node
// Import the 2022 Grand Finale progression from data/canonical/zonal-2022-schools.csv.
//
// 2022 is the only edition whose Grand Finale progression survives anywhere: the old
// CSV backfill had group tables for 2023 and 2024 only, so tournament_groups holds
// nothing for 2022 and the knockout rounds are absent entirely.
//
// The six GF columns encode a funnel that checks out exactly — each stage's arrivals
// equal the previous stage's advancers:
//
//     Grand Finale Group Stage   40 schools, 2 groups   20 evicted, 20 advanced
//     Round of 16                20                     12 evicted,  8 advanced
//     Quarter Finals              8                      4 evicted,  4 advanced
//     Semi Finals                 4                      2 evicted,  2 advanced
//     Finals                      2                      APT Scholars beat Trinity Ofada
//
// So the cell values read: 'Not Qualified' = never reached this stage (no row at all),
// 'Evicted' = reached it and went out, a placing = reached it and went through. The
// Finals are the one exception, where 2nd is the runner-up rather than an advancer.
//
//   node scripts/canonical/import-grand-finale-2022.mjs --prod

import {
  chunk,
  clean,
  createRestClient,
  loadEnv,
  parseBaseArgs,
  readTable,
  requireCredentials,
  writeReport,
  writeSql,
} from "./lib.mjs";

const YEAR = 2022;
const GROUP_STAGE = "Grand Finale Group Stage";
// Source column -> the stage name the rest of the schema already uses.
const STAGES = [
  ["GF Group Stage", GROUP_STAGE],
  ["GF Second Round", "Round of 16"],
  ["GF Q/Finals", "Quarter Finals"],
  ["GF S/Finals", "Semi Finals"],
  ["GF Finals", "Finals"],
];
const NOT_REACHED = "not qualified";
const EVICTED = "evicted";

function placing(value) {
  const m = clean(value).match(/^(\d+)/);
  return m ? Number(m[1]) : null;
}

async function main() {
  const args = parseBaseArgs(process.argv);
  const envPath = loadEnv(args.envFile);
  console.log(`env       : ${envPath ?? args.envFile}`);
  const { url, key } = requireCredentials();
  console.log(`project   : ${new URL(url).host}`);
  const db = createRestClient(url, key);

  const [schools, merges, registrations, stageResults] = await Promise.all([
    db.selectAll("schools", "id,school_code,name"),
    db.selectAll("school_merges", "school_code,absorbed_school_code"),
    db.selectAll("registrations", "id,school_id,edition_year,created_at", { order: "created_at" }),
    db.selectAll("registration_stage_results", "registration_id,stage"),
  ]);
  const alias = new Map();
  for (const m of merges) if (m.absorbed_school_code) alias.set(m.absorbed_school_code, m.school_code);
  const idByCode = new Map(schools.filter((s) => s.school_code).map((s) => [s.school_code, s.id]));
  const nameById = new Map(schools.map((s) => [s.id, s.name]));
  const resolveCode = (code) => idByCode.get(alias.get(clean(code)) ?? clean(code));

  const qualified = new Set(
    stageResults.filter((r) => r.stage === "Qualifications").map((r) => r.registration_id),
  );
  const regsBySchool = new Map();
  for (const r of registrations) {
    if (r.edition_year !== YEAR) continue;
    if (!regsBySchool.has(r.school_id)) regsBySchool.set(r.school_id, []);
    regsBySchool.get(r.school_id).push(r);
  }
  // Tie the Grand Finale to the same registration that already carries the school's
  // 2022 Qualifications result, so a school that submitted twice keeps one story.
  const pickRegistration = (schoolId) => {
    const rows = regsBySchool.get(schoolId) ?? [];
    return rows.find((r) => qualified.has(r.id)) ?? rows[0] ?? null;
  };

  const rows = (await readTable(args.sourceDir, `zonal-${YEAR}-schools.csv`))
    .filter((r) => clean(r["GF Group"]));

  const groups = new Map();
  const entries = [];
  const stageRows = [];
  const skipped = [];

  for (const row of rows) {
    const schoolId = resolveCode(row["School ID"]);
    const registration = schoolId ? pickRegistration(schoolId) : null;
    if (!registration) {
      skipped.push({
        school_code: clean(row["School ID"]),
        canonical_name: clean(row["Canonical School Name"]),
        resolved: schoolId ? nameById.get(schoolId) : "UNKNOWN CODE",
        gf_group: clean(row["GF Group"]),
        reason: schoolId ? "no 2022 registration" : "school code not in database",
      });
      continue;
    }

    const groupName = clean(row["GF Group"]);
    if (!groups.has(groupName)) groups.set(groupName, { name: groupName, advance: 0 });

    for (const [index, [column, stage]] of STAGES.entries()) {
      const value = clean(row[column]);
      const lowered = value.toLowerCase();
      if (!value || lowered === NOT_REACHED) continue;

      const rank = placing(value);
      const isFinal = index === STAGES.length - 1;
      // Reached and went through, unless evicted — or runner-up in the final.
      const advanced = lowered !== EVICTED && !(isFinal && rank !== 1);
      if (stage === GROUP_STAGE && advanced) groups.get(groupName).advance += 1;

      stageRows.push({
        registration_id: registration.id,
        stage,
        outcome: advanced ? "advanced" : "eliminated",
        rank,
        note: `Grand Finale ${YEAR}${stage === GROUP_STAGE ? ` group ${groupName}` : ""}: ${value}`,
        reason: isFinal && rank === 1 ? "Champion" : isFinal && rank === 2 ? "Runner-up" : null,
      });

      if (stage === GROUP_STAGE) {
        entries.push({
          group_name: groupName,
          registration_id: registration.id,
          rank,
          note: `Group ${groupName}: ${value}`,
        });
      }
    }
  }

  console.log("\n── plan ──────────────────────────────────────────────");
  console.log(`schools in the Grand Finale : ${rows.length}`);
  console.log(`groups                      : ${[...groups.values()].map((g) => `${g.name} (advance ${g.advance})`).join(", ")}`);
  console.log(`group entries               : ${entries.length}`);
  console.log(`stage result rows           : ${stageRows.length}`);
  for (const [, stage] of STAGES) {
    const at = stageRows.filter((r) => r.stage === stage);
    console.log(`  ${stage.padEnd(26)}: ${String(at.length).padStart(2)} reached, ` +
      `${at.filter((r) => r.outcome === "advanced").length} advanced`);
  }
  console.log(`skipped                     : ${skipped.length}`);

  const reports = [await writeReport(args.reportDir, "grand-finale-2022-skipped.csv", skipped)];
  console.log(`\nreports:\n${reports.map((r) => `  ${r}`).join("\n")}`);

  const sqlPath = await writeSql(
    args.reportDir,
    "import-grand-finale-2022.sql",
    emitSql([...groups.values()], entries, stageRows),
  );
  console.log(`\nSQL:\n  ${sqlPath}`);
  console.log(`\n  rehearse: psql "$SUPABASE_DB_URL" -f ${sqlPath}`);
  console.log(`  apply   : psql "$SUPABASE_DB_URL" -v apply=true -f ${sqlPath}`);
}

function lit(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function emitSql(groups, entries, stageRows) {
  const out = [];
  const w = (line = "") => out.push(line);
  w(`-- 2022 Grand Finale progression — generated by scripts/canonical/import-grand-finale-2022.mjs`);
  w("-- One transaction, defaults to ROLLBACK.");
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
  w(`  if not exists (select 1 from public.editions where year = ${YEAR}) then`);
  w(`    raise exception 'editions has no row for ${YEAR}; tournament_groups.edition_year references it';`);
  w("  end if;");
  w("end $$;");
  w("");
  w("-- ── the two groups ──────────────────────────────────────────────────────────");
  w("insert into public.tournament_groups (edition_year, stage, name, sort_order, advance_count) values");
  w(groups.map((g, i) => `  (${YEAR}, ${lit(GROUP_STAGE)}, ${lit(g.name)}, ${i}, ${g.advance})`).join(",\n"));
  w("on conflict (edition_year, stage, name) do update set advance_count = excluded.advance_count,");
  w("  sort_order = excluded.sort_order, updated_at = now();");
  w("");
  w("-- ── who was in which group, and where they finished in it ───────────────────");
  for (const batch of chunk(entries, 200)) {
    w("insert into public.tournament_group_entries (group_id, registration_id, rank, note)");
    w("select g.id, v.registration_id, v.rank, v.note");
    w("from (values");
    w(batch.map((e) => `  (${lit(e.group_name)}, ${lit(e.registration_id)}::uuid, ${e.rank ?? "null"}, ${lit(e.note)})`).join(",\n"));
    w(") as v(group_name, registration_id, rank, note)");
    w(`join public.tournament_groups g on g.edition_year = ${YEAR} and g.stage = ${lit(GROUP_STAGE)}`);
    w("  and g.name = v.group_name");
    w("on conflict (registration_id) do update set");
    w("  group_id = excluded.group_id, rank = excluded.rank, note = excluded.note, updated_at = now();");
  }
  w("");
  w("-- ── group stage and every knockout round reached ────────────────────────────");
  for (const batch of chunk(stageRows, 200)) {
    w("insert into public.registration_stage_results (registration_id, stage, outcome, note, reason) values");
    w(batch.map((r) => `  (${lit(r.registration_id)}, ${lit(r.stage)}, ${lit(r.outcome)}, ${lit(r.note)}, ${lit(r.reason)})`).join(",\n"));
    w("on conflict (registration_id, stage) do update set");
    w("  outcome = excluded.outcome, note = excluded.note, reason = excluded.reason, updated_at = now();");
  }
  w("");
  w("-- ── the funnel should narrow exactly as the source says ─────────────────────");
  w("do $$");
  w("declare n int;");
  w("begin");
  for (const [, stage] of STAGES) {
    const reached = stageRows.filter((r) => r.stage === stage).length;
    w(`  select count(*) into n from public.registration_stage_results sr`);
    w(`    join public.registrations r on r.id = sr.registration_id`);
    w(`    where sr.stage = ${lit(stage)} and r.edition_year = ${YEAR};`);
    w(`  if n <> ${reached} then raise exception '${stage.replace(/'/g, "''")} has %, expected ${reached}', n; end if;`);
  }
  w("  raise notice 'grand finale funnel matches the source';");
  w("end $$;");
  w("");
  w("select stage, count(*) as schools, count(*) filter (where outcome = 'advanced') as advanced");
  w("  from public.registration_stage_results sr");
  w("  join public.registrations r on r.id = sr.registration_id");
  w(`  where r.edition_year = ${YEAR} group by stage order by count(*) desc;`);
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

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});

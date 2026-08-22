#!/usr/bin/env node
// Create the registrations implied by the zonal finals results.
//
// Nine school-years have an exam result with no registration row to hang it on, and
// two of them reached the 2022 Grand Finale — ADEDOKUN INTERNATIONAL SCHOOLS, IFO
// went out in the Quarter Finals and Abusi Odumare Academy in the Round of 16. A
// school cannot reach a knockout round of a competition it never entered, so the
// registration is what is missing, not the result.
//
// Six of the seven appear in data/canonical/name-decisions-applied.csv: the cleanup
// resolved their result-sheet names to real schools but never propagated the
// participation year back into School Master, which is why the two workbooks
// disagree about who took part.
//
// Rows created here carry source_key 'asc-result:<year>:<code>' so they are always
// distinguishable from form submissions ('asc-reg:...'), and reps stays empty because
// no rep list survives for them.
//
// Run this BEFORE re-running import-zonal-results.mjs and import-grand-finale-2022.mjs,
// which will then find a registration to attach to.
//
//   node scripts/canonical/create-missing-registrations.mjs --prod

import {
  clean,
  createRestClient,
  loadEnv,
  parseBaseArgs,
  readTable,
  requireCredentials,
  writeReport,
  writeSql,
} from "./lib.mjs";

const YEARS = [2022, 2023, 2024, 2025];
// Furthest-reached stage, in order, for setting current_stage on a 2022 row.
const GF_PROGRESSION = [
  ["GF Group Stage", "Grand Finale Group Stage"],
  ["GF Second Round", "Round of 16"],
  ["GF Q/Finals", "Quarter Finals"],
  ["GF S/Finals", "Semi Finals"],
  ["GF Finals", "Finals"],
];

async function main() {
  const args = parseBaseArgs(process.argv);
  const envPath = loadEnv(args.envFile);
  console.log(`env       : ${envPath ?? args.envFile}`);
  const { url, key } = requireCredentials();
  console.log(`project   : ${new URL(url).host}`);
  const db = createRestClient(url, key);

  const [schools, merges, registrations] = await Promise.all([
    db.selectAll("schools", "id,school_code,name,lga,category"),
    db.selectAll("school_merges", "school_code,absorbed_school_code"),
    db.selectAll("registrations", "id,school_id,edition_year"),
  ]);
  const alias = new Map();
  for (const m of merges) if (m.absorbed_school_code) alias.set(m.absorbed_school_code, m.school_code);
  const byCode = new Map(schools.filter((s) => s.school_code).map((s) => [s.school_code, s]));
  const resolveCode = (code) => byCode.get(alias.get(clean(code)) ?? clean(code));

  const have = new Map();
  for (const r of registrations) {
    if (!r.school_id) continue;
    const k = `${r.school_id}|${r.edition_year}`;
    have.set(k, (have.get(k) ?? 0) + 1);
  }

  // How many result rows does each school-year have, and how many registrations?
  const needed = new Map();
  for (const year of YEARS) {
    for (const row of await readTable(args.sourceDir, `zonal-${year}-schools.csv`)) {
      const school = resolveCode(row["School ID"]);
      if (!school) continue;
      const k = `${school.id}|${year}`;
      if (!needed.has(k)) needed.set(k, { school, year, rows: [] });
      needed.get(k).rows.push(row);
    }
  }

  const create = [];
  for (const [k, entry] of needed) {
    const shortfall = entry.rows.length - (have.get(k) ?? 0);
    for (let i = 0; i < shortfall; i += 1) {
      const row = entry.rows[entry.rows.length - 1 - i];
      let stage = "Qualifications";
      if (entry.year === 2022 && clean(row["GF Group"])) {
        for (const [column, name] of GF_PROGRESSION) {
          const value = clean(row[column]).toLowerCase();
          if (value && value !== "not qualified") stage = name;
        }
      }
      create.push({
        school_id: entry.school.id,
        school_code: entry.school.school_code,
        school_name: entry.school.name,
        edition_year: entry.year,
        current_stage: stage,
        source_key: `asc-result:${entry.year}:${entry.school.school_code}${i ? `:${i + 1}` : ""}`,
        total_score: clean(row["Total Score"]),
        students: clean(row["# Students"]),
        qualified: clean(row["Qualified?"]),
        details: {
          "School Full Name": entry.school.name,
          "School LGA": entry.school.lga ?? "",
          "School Category": entry.school.category ?? "",
          Source: "Zonal finals results sheet",
          Reconstructed:
            "Created from the zonal finals results because no registration row existed for this edition.",
        },
      });
    }
  }

  console.log("\n── plan ──────────────────────────────────────────────");
  console.log(`registrations to create : ${create.length}`);
  for (const c of create) {
    console.log(
      `  ${c.edition_year}  ${c.school_name.slice(0, 44).padEnd(46)} score=${c.total_score.padStart(4)} ` +
        `students=${c.students} qualified=${c.qualified} -> ${c.current_stage}`,
    );
  }
  console.log(`\nregistrations ${registrations.length} -> ${registrations.length + create.length}`);

  const reports = [await writeReport(args.reportDir, "created-registrations.csv", create.map((c) => ({
    edition_year: c.edition_year,
    school_code: c.school_code,
    school_name: c.school_name,
    source_key: c.source_key,
    current_stage: c.current_stage,
    total_score: c.total_score,
    students: c.students,
    qualified: c.qualified,
  })))];
  console.log(`\nreports:\n${reports.map((r) => `  ${r}`).join("\n")}`);

  const sqlPath = await writeSql(
    args.reportDir,
    "create-missing-registrations.sql",
    emitSql(create, registrations.length),
  );
  console.log(`\nSQL:\n  ${sqlPath}`);
  console.log(`\n  rehearse: psql "$SUPABASE_DB_URL" -f ${sqlPath}`);
  console.log(`  apply   : psql "$SUPABASE_DB_URL" -v apply=true -f ${sqlPath}`);
  console.log("\nAfter applying, re-run these so the results attach:");
  console.log("  node scripts/canonical/import-zonal-results.mjs --prod");
  console.log("  node scripts/canonical/import-grand-finale-2022.mjs --prod");
}

function lit(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function emitSql(create, before) {
  const out = [];
  const w = (line = "") => out.push(line);
  w("-- Registrations implied by the zonal finals results — generated by");
  w("-- scripts/canonical/create-missing-registrations.mjs. One transaction, ROLLBACK by default.");
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
  w("declare n int;");
  w("begin");
  w("  select count(*) into n from public.registrations;");
  w(`  if n <> ${before} then raise exception 'registrations has % rows, plan was built for ${before} — regenerate', n; end if;`);
  w("end $$;");
  w("");
  w("-- status 'verified' because the exam result is proof they took part. reps stays");
  w("-- empty: no rep list survives for these, and the students are already imported.");
  w("insert into public.registrations");
  w("  (school_id, edition_year, status, reps, current_stage, source_key, details) values");
  w(create.map((c) => `  (${lit(c.school_id)}, ${c.edition_year}, 'verified', '[]'::jsonb, ` +
    `${lit(c.current_stage)}, ${lit(c.source_key)}, ${lit(JSON.stringify(c.details))}::jsonb)`).join(",\n") + ";");
  w("");
  w("do $$");
  w("declare n int;");
  w("begin");
  w("  select count(*) into n from public.registrations;");
  w(`  if n <> ${before + create.length} then raise exception 'registrations is %, expected ${before + create.length}', n; end if;`);
  w("  select count(*) into n from public.registrations where source_key like 'asc-result:%';");
  w(`  if n <> ${create.length} then raise exception 'reconstructed rows is %, expected ${create.length}', n; end if;`);
  w("  select count(*) into n from public.registrations where school_id is null;");
  w("  if n <> 0 then raise exception '% registrations have no school', n; end if;");
  w("  raise notice 'created % registrations from results', n;");
  w("end $$;");
  w("");
  w("select r.edition_year, s.name, r.current_stage, r.source_key");
  w("  from public.registrations r join public.schools s on s.id = r.school_id");
  w("  where r.source_key like 'asc-result:%' order by r.edition_year, s.name;");
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

#!/usr/bin/env node
// Reconcile registrations against the canonical year tabs, and stamp source_key.
//
// The plan for this step assumed the database was short ~6 registrations, from
// comparing per-year totals. Matching row by row shows that is wrong: every
// canonical row has a counterpart. The totals differ because
//   * Excel stores timestamps as floats, so a re-export can land a second out, and
//   * where a school submitted the form twice in one year, the original backfill
//     kept one copy and the cleanup workbook kept the other.
// Inserting the "missing" rows would therefore have created duplicates.
//
// So this script CHANGES NO DATA except stamping registrations.source_key, which
// gives future re-imports an exact key instead of this matching guesswork. Every
// disagreement is reported, never corrected: moving a registration between editions
// moves its competition history with it, and that is not a script's call.
//
//   node scripts/canonical/reconcile-registrations.mjs --prod

import {
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

const YEARS = [2022, 2023, 2024, 2025, 2026];
// Excel serials are floats, so the same instant can re-export a second either way.
const TIMESTAMP_TOLERANCE_MS = 2000;

function parseStamp(value) {
  const text = clean(value);
  if (!text) return null;
  // Canonical CSVs carry '2023-05-31 16:02:55'; details carries '5/31/2023 16:02:55'.
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (iso) {
    const [, y, mo, d, h, mi, s] = iso;
    return Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  }
  if (us) {
    const [, mo, d, y, h, mi, s] = us;
    return Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  }
  return null;
}

function emailOf(value) {
  return clean(value).toLowerCase();
}

async function main() {
  const args = parseBaseArgs(process.argv);
  const envPath = loadEnv(args.envFile);
  console.log(`env       : ${envPath ?? args.envFile}`);
  const { url, key } = requireCredentials();
  console.log(`project   : ${new URL(url).host}`);
  const db = createRestClient(url, key);

  const [schools, registrations] = await Promise.all([
    db.selectAll("schools", "id,school_code,name"),
    db.selectAll("registrations", "id,school_id,edition_year,contact_email,source_key,details", {
      order: "created_at",
    }),
  ]);
  const merges = await db.selectAll("school_merges", "school_code,absorbed_school_code");
  const alias = new Map();
  for (const m of merges) if (m.absorbed_school_code) alias.set(m.absorbed_school_code, m.school_code);
  const idByCode = new Map(schools.filter((s) => s.school_code).map((s) => [s.school_code, s.id]));
  const resolveCode = (code) => idByCode.get(alias.get(code) ?? code);

  // Indexes: exact stamp+email, then email alone, then submitted school name.
  const byEmail = new Map();
  const bySchoolName = new Map();
  const bySchoolYear = new Map();
  for (const reg of registrations) {
    const details = reg.details ?? {};
    const stamp = parseStamp(details["Original: Timestamp"]);
    const email = emailOf(details["Original: Email Address"] || reg.contact_email);
    const entry = { reg, stamp };
    push(byEmail, `${reg.edition_year}|${email}`, entry);
    push(bySchoolName, `${reg.edition_year}|${normalizeSchoolName(details["School Full Name"])}`, entry);
    push(bySchoolYear, `${reg.edition_year}|${reg.school_id}`, entry);
  }

  const matched = new Map(); // registration id -> source_key
  const rows = [];
  const claimed = new Set();

  for (const year of YEARS) {
    const tab = await readTable(args.sourceDir, `registration-${year}.csv`);
    const nameColumn = tab.length && "Full Name of School" in tab[0] ? "Full Name of School" : "School";
    for (const row of tab) {
      const sourceKey = `asc-reg:${year}:${row.__row}`;
      const stamp = parseStamp(row.Timestamp);
      const email = emailOf(row["Email Address"] || row["Coordinator email"]);
      const schoolName = normalizeSchoolName(row[nameColumn]);
      const schoolId = row["School ID"] ? resolveCode(row["School ID"]) : null;

      const tryPick = (candidates, requireStamp) => {
        for (const c of candidates ?? []) {
          if (claimed.has(c.reg.id)) continue;
          if (requireStamp) {
            if (stamp === null || c.stamp === null) continue;
            if (Math.abs(c.stamp - stamp) > TIMESTAMP_TOLERANCE_MS) continue;
          }
          return c.reg;
        }
        return null;
      };

      let reg = tryPick(byEmail.get(`${year}|${email}`), true);
      let how = "timestamp+email";
      if (!reg) {
        reg = tryPick(byEmail.get(`${year}|${email}`), false);
        how = "email+year";
      }
      if (!reg) {
        reg = tryPick(bySchoolName.get(`${year}|${schoolName}`), false);
        how = "school name+year";
      }
      if (!reg && schoolId) {
        reg = tryPick(bySchoolYear.get(`${year}|${schoolId}`), false);
        how = "school code+year";
      }

      if (reg) {
        claimed.add(reg.id);
        matched.set(reg.id, sourceKey);
      }
      rows.push({
        source_key: sourceKey,
        year,
        matched_how: reg ? how : "UNMATCHED",
        registration_id: reg?.id ?? "",
        db_edition_year: reg?.edition_year ?? "",
        year_disagreement: reg && reg.edition_year !== year ? "YES" : "",
        school_code: row["School ID"] || "",
        canonical_school: row["Canonical School Name"] || "",
        submitted_school: row[nameColumn] || "",
        timestamp: row.Timestamp || "",
        email,
      });
    }
  }

  const unmatchedCanonical = rows.filter((r) => r.matched_how === "UNMATCHED");
  const disagreements = rows.filter((r) => r.year_disagreement === "YES");
  const unmatchedDb = registrations.filter((r) => !matched.has(r.id));

  console.log("\n── reconciliation ────────────────────────────────────");
  console.log(`canonical rows          : ${rows.length}`);
  for (const how of ["timestamp+email", "email+year", "school name+year", "school code+year"]) {
    console.log(`  matched by ${how.padEnd(18)}: ${rows.filter((r) => r.matched_how === how).length}`);
  }
  console.log(`canonical rows unmatched: ${unmatchedCanonical.length}`);
  console.log(`db rows unmatched       : ${unmatchedDb.length}`);
  console.log(`edition-year disagreements: ${disagreements.length}`);
  console.log(`source_key values to stamp: ${matched.size}`);

  const reports = [
    await writeReport(args.reportDir, "reconcile-registrations.csv", rows),
    await writeReport(
      args.reportDir,
      "reconcile-unmatched-db.csv",
      unmatchedDb.map((r) => ({
        registration_id: r.id,
        edition_year: r.edition_year,
        contact_email: r.contact_email ?? "",
        submitted_school: (r.details ?? {})["School Full Name"] ?? "",
        original_timestamp: (r.details ?? {})["Original: Timestamp"] ?? "",
        sheet_tab: (r.details ?? {})["Sheet Tab"] ?? "",
        sheet_row: (r.details ?? {})["Sheet Row"] ?? "",
      })),
    ),
  ];
  console.log(`\nreports:\n${reports.map((r) => `  ${r}`).join("\n")}`);

  // SQL: stamps only. No inserts, no deletes, no edition_year changes.
  const out = [];
  out.push("-- Stamp registrations.source_key from the canonical year tabs.");
  out.push("-- Generated by scripts/canonical/reconcile-registrations.mjs. Stamps only:");
  out.push("-- no rows are inserted, deleted, or moved between editions.");
  out.push("");
  out.push("\\set ON_ERROR_STOP on");
  out.push("\\if :{?apply}");
  out.push("\\else");
  out.push("  \\set apply false");
  out.push("\\endif");
  out.push("");
  out.push("begin;");
  out.push("");
  for (const [id, sourceKey] of matched) {
    out.push(`update public.registrations set source_key = '${sourceKey}' where id = '${id}';`);
  }
  out.push("");
  out.push("do $$");
  out.push("declare n int;");
  out.push("begin");
  out.push("  select count(*) into n from public.registrations where source_key is not null;");
  out.push(`  if n <> ${matched.size} then raise exception 'source_key set on %, expected ${matched.size}', n; end if;`);
  out.push("  raise notice 'source_key stamped on % registrations', n;");
  out.push("end $$;");
  out.push("");
  out.push("select count(*) as total, count(source_key) as stamped,");
  out.push("       count(*) - count(source_key) as unstamped from public.registrations;");
  out.push("");
  out.push("\\if :apply");
  out.push("commit;");
  out.push("\\echo '>>> COMMITTED'");
  out.push("\\else");
  out.push("rollback;");
  out.push("\\echo '>>> ROLLED BACK — nothing was changed.'");
  out.push("\\endif");

  const sqlPath = await writeSql(args.reportDir, "reconcile-registrations.sql", out.join("\n"));
  console.log(`\nSQL:\n  ${sqlPath}`);
  console.log(`\n  rehearse: psql "$SUPABASE_DB_URL" -f ${sqlPath}`);
  console.log(`  apply   : psql "$SUPABASE_DB_URL" -v apply=true -f ${sqlPath}`);
}

function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});

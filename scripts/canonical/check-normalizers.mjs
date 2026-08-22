#!/usr/bin/env node
// Guard the one invariant this schema now depends on: three implementations of the
// school-name normalizer agreeing character for character.
//
// `schools_norm_name_key` is a unique index on public.school_norm_name(name). Any
// caller that normalizes differently looks a school up under the wrong key, misses
// the existing row, and then fails the insert against the index — a 23505 on a real
// registration rather than a quiet mismatch. This already happened once: the app
// copies were missing the "&" rule, so "R&D College" resolved to "r d college" while
// the database had "r and d college".
//
// The three:
//   1. public.school_norm_name       supabase/migrations/20260822090000_…sql
//   2. normalizeSchoolName           src/lib/school-identity.ts   (compiled here)
//   3. normalizeSchoolName           scripts/canonical/lib.mjs
//
// 2 and 3 are executed against the fixtures below. For 1, the SQL expression is
// compared against its expected form; pass a database URL to execute it instead:
//
//   node scripts/canonical/check-normalizers.mjs                    # static
//   node scripts/canonical/check-normalizers.mjs --db-url "$SUPABASE_DB_URL"
//
// Exits non-zero on any disagreement, so CI can gate on it.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "../..");
const TS_SOURCE = "src/lib/school-identity.ts";
const JS_SOURCE = "scripts/canonical/lib.mjs";
const MIGRATION = "supabase/migrations/20260822090000_canonical_school_identity.sql";

// The SQL body, whitespace-normalized. Editing the function without updating the two
// runtime copies has to fail here rather than in production.
const EXPECTED_SQL =
  "select btrim(regexp_replace(lower(replace(p, '&', ' and ')), '[^a-z0-9]+', ' ', 'g'))";

// Each case exists because it distinguishes a plausible wrong implementation.
const FIXTURES = [
  ["Adewale High School", "adewale high school"],
  ["  ADEWALE   HIGH  SCHOOL  ", "adewale high school"],          // collapse + trim
  ["R&D College", "r and d college"],                              // the rule that drifted
  ["R & D College", "r and d college"],                            // & already spaced
  ["A&B&C", "a and b and c"],                                      // every occurrence
  ["Nawair-Ud-Deen High School", "nawair ud deen high school"],     // hyphens
  ["St. Mary's Comp. School", "st mary s comp school"],            // punctuation splits
  ["Grace (Group) of Schools", "grace group of schools"],
  ["Baptist School, Oke-Ijeun", "baptist school oke ijeun"],
  ["ẸGBA Comprehensive", "gba comprehensive"],                      // non-ASCII dropped
  ["Cherubim & Seraphim Coll. 2", "cherubim and seraphim coll 2"],  // digits survive
  ["Ansar-Ud-Deen  &  Co", "ansar ud deen and co"],
  ["---", ""],                                                     // nothing left
  ["", ""],
];

const args = process.argv.slice(2);
const dbUrl = args.includes("--db-url") ? args[args.indexOf("--db-url") + 1] : null;

let failures = 0;
function report(label, ok, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

/** Compile the TypeScript copy so it can be executed rather than eyeballed. */
function loadTypeScriptCopy() {
  const out = mkdtempSync(join(tmpdir(), "asc-normalizer-"));
  try {
    execFileSync(
      "npx",
      ["tsc", TS_SOURCE, "--outDir", out, "--target", "es2022", "--module", "es2022",
       "--moduleResolution", "bundler", "--skipLibCheck"],
      { cwd: ROOT, stdio: "pipe" },
    );
  } catch (error) {
    console.error(`\nCould not compile ${TS_SOURCE}:\n${error.stdout ?? error.message}`);
    process.exit(1);
  }
  // The project is CommonJS by default, so the ESM output needs the .mjs extension.
  const emitted = join(out, "school-identity.js");
  const module = join(out, "school-identity.mjs");
  renameSync(emitted, module);
  return { module, cleanup: () => rmSync(out, { recursive: true, force: true }) };
}

function runFixtures(label, fn) {
  const wrong = FIXTURES.filter(([input, expected]) => fn(input) !== expected);
  report(
    label,
    wrong.length === 0,
    wrong.length
      ? wrong.map(([i, e]) => `${JSON.stringify(i)} → ${JSON.stringify(fn(i))}, expected ${JSON.stringify(e)}`).join("; ")
      : `${FIXTURES.length} cases`,
  );
}

console.log("School-name normalizer lockstep\n");

// 1 ── the SQL definition
const migration = readFileSync(join(ROOT, MIGRATION), "utf8");
const body = migration.match(/create or replace function public\.school_norm_name[\s\S]*?as \$\$([\s\S]*?)\$\$/);
if (!body) {
  report(`${MIGRATION}: school_norm_name found`, false, "could not locate the function body");
} else {
  const actual = body[1].replace(/\s+/g, " ").trim();
  report(`${MIGRATION} (static)`, actual === EXPECTED_SQL, actual === EXPECTED_SQL ? "" : `got: ${actual}`);
}

if (dbUrl) {
  const rows = FIXTURES.map(([input]) => input);
  const sql =
    "select public.school_norm_name(v) from unnest(array[" +
    rows.map((r) => `'${r.replace(/'/g, "''")}'`).join(",") +
    "]) as v";
  try {
    const out = execFileSync("psql", [dbUrl, "-Atc", sql], { encoding: "utf8" });
    const got = out.replace(/\n$/, "").split("\n");
    const wrong = FIXTURES.filter(([, expected], i) => got[i] !== expected);
    report(
      "public.school_norm_name (executed)",
      wrong.length === 0,
      wrong.length ? wrong.map(([i, e], n) => `${JSON.stringify(i)} → ${JSON.stringify(got[n])}, expected ${JSON.stringify(e)}`).join("; ") : `${FIXTURES.length} cases`,
    );
  } catch (error) {
    report("public.school_norm_name (executed)", false, String(error.message).split("\n")[0]);
  }
} else {
  console.log("  --    public.school_norm_name (executed) — skipped, pass --db-url to run it");
}

// 2 ── the TypeScript copy the app uses
const ts = loadTypeScriptCopy();
try {
  const { normalizeSchoolName } = await import(pathToFileURL(ts.module).href);
  runFixtures(TS_SOURCE, normalizeSchoolName);
} finally {
  ts.cleanup();
}

// 3 ── the copy the canonical scripts use
const { normalizeSchoolName: scriptCopy } = await import(pathToFileURL(join(ROOT, JS_SOURCE)).href);
runFixtures(JS_SOURCE, scriptCopy);

console.log();
if (failures) {
  console.error(`${failures} check${failures === 1 ? "" : "s"} failed. The normalizers have drifted — see the header of ${TS_SOURCE}.`);
  process.exit(1);
}
console.log("All three normalizers agree.");

#!/usr/bin/env node
// Read-only Google Sheet backfill helper.
//
// Input is local CSV exports of the source spreadsheet tabs. The script never
// edits Google Sheets. It defaults to dry-run and writes to Supabase only with
// --apply.

import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_SOURCE_DIR = "data/backfill/competition-history";
const DEFAULT_ENV_FILE = ".env";
const PROD_ENV_FILE = ".env.prod";
const STUDENT_EMAIL_DOMAIN = "students.adewaleconference.local";
const GROUP_STAGE = "Grand Finale Group Stage";
const QUALIFICATION_STAGE = "Qualifications";
const FIRST_KNOCKOUT_STAGE = "Round of 16";
const DEFAULT_STAGES = [
  "Registration",
  QUALIFICATION_STAGE,
  GROUP_STAGE,
  FIRST_KNOCKOUT_STAGE,
  "Quarter Finals",
  "Semi Finals",
  "Finals",
  "Completed",
];

const SOURCES = {
  registrations: {
    2022: "registrations-2022.csv",
    2023: "registrations-2023.csv",
    2024: "registrations-2024.csv",
    2025: "registrations-2025.csv",
  },
  qualifications: {
    2022: "zonal-results-2022.csv",
    2023: "zonal-ranking-2023.csv",
    2024: "zonal-results-2024.csv",
    2025: "zonal-results-2025.csv",
  },
  groups: {
    2023: "group-table-live-2023.csv",
    2024: "group-table-live-2024.csv",
  },
};

const REGISTRATION_ALIASES = {
  schoolName: ["Full Name of School", "School Full Name"],
  schoolLga: ["School Local Government Area", "School LGA"],
  schoolCategory: ["School Category"],
  schoolAddress: ["School Physical Address", "School Address"],
  schoolEmail: ["School Official Email Address (if you have)", "School Email Address"],
  teacherName: ["Full Name of Teacher-in-Charge", "Teacher Full Name"],
  teacherGender: ["Gender of Teacher-in-Charge", "Teacher Gender"],
  teacherPhone: ["Phone Number of Teacher-in-Charge", "Teacher Phone Number"],
  teacherEmail: ["Email Address of Teacher-in-Charge", "Teacher Email Address"],
  principalName: ["Full Name of School Principal", "Principal Full Name"],
  principalGender: ["Gender of School Principal", "Principal Gender"],
  principalPhone: ["Phone Number of School Principal", "Principal Phone Number"],
  principalEmail: ["Email Address of School Principal", "Principal Email Address"],
  preferredCenter: ["Which center do you prefer for the Zonal Final Exam?  "],
  timestamp: ["Timestamp"],
};

function parseArgs(argv) {
  const args = {
    apply: false,
    allowMissing: false,
    sourceDir: DEFAULT_SOURCE_DIR,
    envFile: DEFAULT_ENV_FILE,
    years: [2022, 2023, 2024, 2025],
    yearsExplicit: false,
    skipGroups: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--allow-missing") args.allowMissing = true;
    else if (arg === "--skip-groups") args.skipGroups = true;
    else if (arg === "--prod") args.envFile = PROD_ENV_FILE;
    else if (arg === "--env-file") args.envFile = argv[++i] ?? args.envFile;
    else if (arg.startsWith("--env-file=")) args.envFile = arg.slice("--env-file=".length);
    else if (arg === "--source-dir") args.sourceDir = argv[++i] ?? args.sourceDir;
    else if (arg.startsWith("--source-dir=")) args.sourceDir = arg.slice("--source-dir=".length);
    else if (arg === "--years") {
      args.years = parseYears(argv[++i]);
      args.yearsExplicit = true;
    } else if (arg.startsWith("--years=")) {
      args.years = parseYears(arg.slice("--years=".length));
      args.yearsExplicit = true;
    }
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function parseYears(value = "") {
  const years = value
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v));
  if (!years.length) throw new Error("--years must contain at least one year, e.g. --years=2023,2024,2025");
  const unsupported = years.filter((year) => !SOURCES.registrations[year]);
  if (unsupported.length) throw new Error(`Unsupported year(s): ${unsupported.join(", ")}`);
  return years;
}

function loadEnv(envFile) {
  const resolved = path.resolve(envFile);
  try {
    process.loadEnvFile(resolved);
    return resolved;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`Failed to load env file ${resolved}: ${error.message}`);
  }
}

function printHelp() {
  console.log(`Usage:
  node scripts/backfill-competition-history.mjs [--prod | --env-file PATH] [--apply] [--source-dir DIR] [--years 2023,2024] [--skip-groups] [--allow-missing]

Env: loads ${DEFAULT_ENV_FILE} by default; --prod loads ${PROD_ENV_FILE}; --env-file PATH loads a specific file.
Values already set in the shell environment take precedence over the env file.

Default mode is dry-run. Required Supabase env vars for --apply:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SECRET_KEY

Expected CSV names under ${DEFAULT_SOURCE_DIR}/:
  ${Object.values(SOURCES.registrations).join(", ")}
  ${Object.values(SOURCES.qualifications).join(", ")}
  ${Object.values(SOURCES.groups).join(", ")}

Use --allow-missing during setup to dry-run only the CSV files currently present.
`);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);

  return rows.filter((r) => r.some((v) => clean(v)));
}

async function readCsv(sourceDir, fileName, required = false) {
  const filePath = path.resolve(sourceDir, fileName);
  try {
    await access(filePath);
  } catch {
    if (required) throw new Error(`Missing required CSV export: ${filePath}`);
    return [];
  }
  return parseCsv(await readFile(filePath, "utf8"));
}

function rowsToObjects(rows, meta) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => clean(h));
  return rows.slice(1).map((values, i) => {
    const row = { __meta: { ...meta, source_row: i + 2 }, __headers: headers };
    const seen = new Map();
    headers.forEach((header, index) => {
      if (!header) return;
      const count = seen.get(header) ?? 0;
      seen.set(header, count + 1);
      row[count ? `${header}__${count + 1}` : header] = clean(values[index]);
    });
    return row;
  });
}

function clean(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").trim();
}

function norm(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bogun\s+statte\b/g, "")
    .replace(/\bogun\s+state\b/g, "")
    .replace(/\bgra\s+quarters?\b/g, "")
    .replace(/\bogun\b/g, "")
    .replace(/\bidi\s+aba\s+abeokuta\b/g, "")
    .replace(/\bidi\s+ori\b/g, "")
    .replace(/\bunivrse\b/g, "universe")
    .replace(/\bsucces\b/g, "success")
    .replace(/\boguntola\b/g, "ogunpola")
    .replace(/\bsnr\b/g, "senior")
    .replace(/\bsec\b/g, "secondary")
    .replace(/\s+/g, " ")
    .trim();
}

function schoolKey(name, lga, category) {
  return `${norm(name)}|${norm(lga)}|${norm(category)}`;
}

function pick(row, aliases) {
  for (const key of aliases) {
    const value = clean(row[key]);
    if (value) return value;
  }
  return "";
}

function numberValue(value) {
  const cleaned = clean(value).replace(/,/g, "");
  if (!cleaned || cleaned === "#N/A" || cleaned === "#REF!") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function hash(input, length = 12) {
  return createHash("sha1").update(input).digest("hex").slice(0, length);
}

function claimCode(input) {
  return hash(input, 8).toUpperCase();
}

function studentCode(input) {
  return `H${hash(input, 9).toUpperCase()}`;
}

function lowerEmail(value) {
  const v = clean(value).toLowerCase();
  return v.includes("@") ? v : null;
}

function canonicalDetails(row, mapped) {
  const details = {
    "Sheet Source": row.__meta.source,
    "Sheet Tab": row.__meta.tab,
    "Sheet Row": String(row.__meta.source_row),
    "School Full Name": mapped.school.name,
    "School LGA": mapped.school.lga,
    "School Category": mapped.school.category,
    "School Address": mapped.school.address,
    "School Email Address": mapped.school.email,
    "Teacher Full Name": mapped.teacher.name,
    "Teacher Gender": mapped.teacher.gender,
    "Teacher Phone Number": mapped.teacher.phone,
    "Teacher Email Address": mapped.teacher.email,
    "Principal Full Name": mapped.principal.name,
    "Principal Gender": mapped.principal.gender,
    "Principal Phone Number": mapped.principal.phone,
    "Principal Email Address": mapped.principal.email,
  };

  for (const rep of mapped.reps) {
    details[`Student Rep ${rep.n} Full Name`] = rep.name;
    details[`Student Rep ${rep.n} DOB`] = rep.dob;
    details[`Student Rep ${rep.n} Gender`] = rep.gender;
    details[`Student Rep ${rep.n} Class`] = rep.level;
    details[`Student Rep ${rep.n} Guardian Name`] = rep.guardianName;
    details[`Student Rep ${rep.n} Guardian Number`] = rep.guardianPhone;
  }

  for (const header of row.__headers ?? []) {
    if (!header) continue;
    const value = clean(row[header]);
    if (value) details[`Original: ${header}`] = value;
  }
  return details;
}

function mapRegistrationRow(row, year) {
  const schoolName = pick(row, REGISTRATION_ALIASES.schoolName);
  if (!schoolName) return null;
  const submittedAt = parseTimestamp(pick(row, REGISTRATION_ALIASES.timestamp), year);
  const parsedYear = new Date(submittedAt).getUTCFullYear();
  const effectiveYear = SOURCES.registrations[parsedYear] ? parsedYear : year;
  const sourceSlug = norm(row.__meta.tab).replace(/\s+/g, "-");

  const reps = [1, 2, 3]
    .map((n) => ({
      n,
      name: pick(row, [`Full Name of Student Rep ${n}`, `Student Rep ${n} Full Name`]),
      dob: pick(row, [`Date of Birth of Student Rep ${n}`, `Student Rep ${n} DOB`]),
      gender: pick(row, [`Gender of Student Rep ${n}`, `Student Rep ${n} Gender`]),
      level: pick(row, [`Current Class of Student Rep ${n}`, `Student Rep ${n} Class`]),
      guardianName: pick(row, [
        `Student Rep ${n} Parent/Guardian's name`,
        `Student Rep ${n} Guardian Name`,
      ]),
      guardianPhone: pick(row, [
        `Student Rep ${n}  Parent/Guardian's number`,
        `Student Rep ${n} Parent/Guardian's number`,
        `Student Rep ${n} Guardian Number`,
      ]),
    }))
    .filter((r) => r.name);

  const mapped = {
    year: effectiveYear,
    sourceYear: year,
    sourceRow: row.__meta.source_row,
    externalId: `sheet:asc-history:${effectiveYear}:${sourceSlug}:row:${row.__meta.source_row}`,
    submittedAt,
    school: {
      name: schoolName,
      lga: pick(row, REGISTRATION_ALIASES.schoolLga),
      category: pick(row, REGISTRATION_ALIASES.schoolCategory),
      address: pick(row, REGISTRATION_ALIASES.schoolAddress),
      email: lowerEmail(pick(row, REGISTRATION_ALIASES.schoolEmail)),
    },
    qualificationZone: pick(row, REGISTRATION_ALIASES.preferredCenter) || null,
    teacher: {
      name: pick(row, REGISTRATION_ALIASES.teacherName),
      gender: pick(row, REGISTRATION_ALIASES.teacherGender),
      phone: pick(row, REGISTRATION_ALIASES.teacherPhone),
      email: lowerEmail(pick(row, REGISTRATION_ALIASES.teacherEmail)),
    },
    principal: {
      name: pick(row, REGISTRATION_ALIASES.principalName),
      gender: pick(row, REGISTRATION_ALIASES.principalGender),
      phone: pick(row, REGISTRATION_ALIASES.principalPhone),
      email: lowerEmail(pick(row, REGISTRATION_ALIASES.principalEmail)),
    },
    reps,
  };
  mapped.details = canonicalDetails(row, mapped);
  return mapped;
}

function parseTimestamp(value, year) {
  const raw = clean(value);
  if (!raw) return `${year}-01-01T00:00:00.000Z`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return `${year}-01-01T00:00:00.000Z`;
}

function dedupeRegistrations(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.year}|${schoolKey(row.school.name, row.school.lga, row.school.category)}`;
    const current = grouped.get(key);
    if (!current || new Date(row.submittedAt) > new Date(current.submittedAt)) grouped.set(key, row);
  }
  return {
    chosen: [...grouped.values()],
    duplicatesSkipped: rows.length - grouped.size,
  };
}

function parseQualificationRows(year, rows) {
  if (!rows.length) return new Map();
  if (year === 2025) return parseKnownQualificationBlock(rows, { contestantSchool: 4, contestantScore: 2, qualifiedSchool: 38, qualifiedScore: 39, reason: 40, zone: 37 });
  if (year === 2024) return parseKnownQualificationBlock(rows, { contestantSchool: 3, contestantScore: 6, qualifiedSchool: 21, qualifiedScore: 22, reason: 23, zone: 20, qualifiedLimit: 48 });
  if (year === 2023) return parseKnownQualificationBlock(rows, { contestantSchool: 27, contestantScore: 28, qualifiedSchool: 5, qualifiedScore: 6, reason: 7, zone: 9, qualifiedLimit: 48 });
  if (year === 2022) return parseKnownQualificationBlock(rows, { contestantSchool: 18, contestantScore: 17, qualifiedSchool: 11, qualifiedScore: 12, reason: null, zone: 19, qualifiedLimit: 40 });
  return new Map();
}

function parseKnownQualificationBlock(rows, columns) {
  const scores = new Map();
  const qualified = new Map();
  const body = rows.slice(1);

  for (const row of body) {
    const school = clean(row[columns.contestantSchool]);
    const score = numberValue(row[columns.contestantScore]);
    if (school && score != null) {
      const key = norm(school);
      const current = scores.get(key) ?? { school, score: 0 };
      current.score += score;
      scores.set(key, current);
    }

    const qualifiedSchool = clean(row[columns.qualifiedSchool]);
    if (qualifiedSchool && (!columns.qualifiedLimit || qualified.size < columns.qualifiedLimit)) {
      const key = norm(qualifiedSchool);
      qualified.set(key, {
        school: qualifiedSchool,
        score: numberValue(row[columns.qualifiedScore]),
        reason: normalizeReason(columns.reason == null ? "" : row[columns.reason]),
        zone: columns.zone == null ? "" : clean(row[columns.zone]),
      });
    }
  }

  const out = new Map();
  for (const [key, scored] of scores) {
    out.set(key, {
      sourceSchool: scored.school,
      score: scored.score,
      outcome: qualified.has(key) ? "advanced" : "eliminated",
      reason: qualified.get(key)?.reason ?? null,
      zone: qualified.get(key)?.zone ?? null,
    });
  }
  for (const [key, q] of qualified) {
    const current = out.get(key);
    out.set(key, {
      sourceSchool: q.school,
      score: q.score ?? current?.score ?? null,
      outcome: "advanced",
      reason: q.reason,
      zone: q.zone || current?.zone || null,
    });
  }
  return out;
}

function lookupQualification(qualificationMap, schoolName) {
  const key = norm(schoolName);
  const exact = qualificationMap.get(key);
  if (exact) return exact;

  const candidates = [...qualificationMap.entries()].filter(([sourceKey]) => {
    if (!sourceKey || !key) return false;
    return sourceKey.startsWith(key) || key.startsWith(sourceKey);
  });
  return candidates.length === 1 ? candidates[0][1] : null;
}

function normalizeReason(value) {
  const raw = clean(value);
  const n = norm(raw);
  if (!raw) return "Manual Selection";
  if (n.includes("wildcard")) return "Wildcard";
  if (n.includes("top 10")) return "Top 10";
  if (n.includes("state")) return "State-wide Qualification";
  if (n.includes("division")) return "Divisional Qualification";
  if (n.includes("zonal") || n.includes("lga champion")) return "Zonal Champion";
  return "Manual Selection";
}

function parseGroupRows(year, rows) {
  if (!rows.length) return [];
  const entries = [];
  let currentGroup = "";
  for (const row of rows.slice(2)) {
    const groupCell = clean(row[0]);
    if (/^group\s+[a-z]/i.test(groupCell)) currentGroup = groupCell;
    const group = /^group\s+[a-z]/i.test(groupCell) ? groupCell : currentGroup;
    const seed = numberValue(row[1]);
    const school = clean(row[2]);
    const score = numberValue(row[14]);
    if (!group || !school || seed == null) continue;
    entries.push({ year, group, school, seed, score });
  }

  const byGroup = new Map();
  for (const entry of entries) {
    const list = byGroup.get(entry.group) ?? [];
    list.push(entry);
    byGroup.set(entry.group, list);
  }
  for (const list of byGroup.values()) {
    [...list]
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.seed - b.seed)
      .forEach((entry, index) => {
        entry.rank = index + 1;
      });
  }
  return entries;
}

function summarizePlanned(plan) {
  const byYear = new Map();
  for (const reg of plan.registrations) {
    const row = byYear.get(reg.year) ?? emptyYearSummary();
    row.registrations += 1;
    row.reps += reg.reps.length;
    byYear.set(reg.year, row);
  }
  for (const result of plan.qualificationResults) {
    const row = byYear.get(result.year) ?? emptyYearSummary();
    row.qualificationResults += 1;
    if (result.outcome === "advanced") row.qualificationAdvanced += 1;
    if (result.outcome === "eliminated") row.qualificationEliminated += 1;
    byYear.set(result.year, row);
  }
  for (const result of plan.groupStageResults) {
    const row = byYear.get(result.year) ?? emptyYearSummary();
    row.groupStageResults += 1;
    if (result.outcome === "advanced") row.groupStageAdvanced += 1;
    if (result.outcome === "eliminated") row.groupStageEliminated += 1;
    byYear.set(result.year, row);
  }
  for (const group of plan.groups) {
    const row = byYear.get(group.year) ?? emptyYearSummary();
    row.groups += 1;
    byYear.set(group.year, row);
  }
  for (const entry of plan.groupEntries) {
    const row = byYear.get(entry.year) ?? emptyYearSummary();
    row.groupEntries += 1;
    byYear.set(entry.year, row);
  }
  return [...byYear.entries()].sort(([a], [b]) => a - b);
}

function emptyYearSummary() {
  return {
    registrations: 0,
    reps: 0,
    qualificationResults: 0,
    qualificationAdvanced: 0,
    qualificationEliminated: 0,
    groupStageResults: 0,
    groupStageAdvanced: 0,
    groupStageEliminated: 0,
    groups: 0,
    groupEntries: 0,
  };
}

function summarizeMovedRows(registrations) {
  const counts = new Map();
  for (const reg of registrations) {
    if (!reg.sourceYear || reg.sourceYear === reg.year) continue;
    const key = `${reg.sourceYear}->${reg.year}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function initSupabase(apply) {
  if (!apply) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY for --apply.");
  }
  return createRestClient(url, key);
}

function createRestClient(baseUrl, key) {
  const root = baseUrl.replace(/\/$/, "");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  async function request(table, { method = "GET", query = new URLSearchParams(), body, prefer } = {}) {
    const url = `${root}/rest/v1/${table}${query.toString() ? `?${query.toString()}` : ""}`;
    const response = await fetch(url, {
      method,
      headers: prefer ? { ...headers, Prefer: prefer } : headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      return { data: null, error: { message: `${response.status} ${await response.text()}` } };
    }
    if (response.status === 204) return { data: null, error: null };
    const text = await response.text();
    return { data: text ? JSON.parse(text) : null, error: null };
  }

  return {
    from(table) {
      return new RestTable(table, request);
    },
    async rpc(name, payload) {
      return request(`rpc/${name}`, { method: "POST", body: payload, prefer: "return=minimal" });
    },
  };
}

class RestTable {
  constructor(table, request) {
    this.table = table;
    this.request = request;
    this.method = "GET";
    this.query = new URLSearchParams();
    this.body = undefined;
    this.prefer = undefined;
  }

  select(columns) {
    this.query.set("select", columns);
    if (this.method === "POST") this.prefer = "return=representation";
    return this;
  }

  insert(rows) {
    this.method = "POST";
    this.body = rows;
    this.prefer = "return=minimal";
    return this;
  }

  upsert(rows, options = {}) {
    this.method = "POST";
    this.body = rows;
    if (options.onConflict) this.query.set("on_conflict", options.onConflict);
    const resolution = options.ignoreDuplicates ? "ignore-duplicates" : "merge-duplicates";
    this.prefer = `resolution=${resolution},return=minimal`;
    return this;
  }

  in(column, values) {
    this.query.set(column, `in.(${values.map(formatInValue).join(",")})`);
    return this;
  }

  eq(column, value) {
    this.query.set(column, `eq.${value}`);
    return this;
  }

  then(resolve, reject) {
    return this.request(this.table, {
      method: this.method,
      query: this.query,
      body: this.body,
      prefer: this.prefer,
    }).then(resolve, reject);
  }
}

function formatInValue(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function buildPlan(args) {
  const rawRegs = [];
  const qualificationByYear = new Map();
  const groupEntriesRaw = [];
  const missingSources = [];

  for (const year of args.years) {
    const registrationFile = SOURCES.registrations[year];
    const registrationCsv = await readCsv(args.sourceDir, registrationFile, !args.allowMissing);
    if (!registrationCsv.length) {
      missingSources.push(registrationFile);
      continue;
    }
    const registrationRows = rowsToObjects(
      registrationCsv,
      { source: "ASC PMO 2021 - Date", tab: `${year} Registration` },
    );
    rawRegs.push(...registrationRows.map((row) => mapRegistrationRow(row, year)).filter(Boolean));

    const qualificationRows = await readCsv(args.sourceDir, SOURCES.qualifications[year], false);
    qualificationByYear.set(year, parseQualificationRows(year, qualificationRows));

    if (!args.skipGroups && SOURCES.groups[year]) {
      groupEntriesRaw.push(...parseGroupRows(year, await readCsv(args.sourceDir, SOURCES.groups[year], false)));
    }
  }

  const { chosen: registrations, duplicatesSkipped } = dedupeRegistrations(rawRegs);
  const regsByYearAndName = new Map(registrations.map((r) => [`${r.year}|${norm(r.school.name)}`, r]));

  const qualificationResults = [];
  for (const reg of registrations) {
    const q = lookupQualification(qualificationByYear.get(reg.year) ?? new Map(), reg.school.name);
    if (!q) continue;
    if (q.zone && !reg.qualificationZone) reg.qualificationZone = q.zone;
    qualificationResults.push({
      year: reg.year,
      externalId: reg.externalId,
      schoolName: reg.school.name,
      stage: QUALIFICATION_STAGE,
      outcome: q.outcome,
      score: q.score,
      reason: q.reason,
      note: q.outcome === "advanced" ? "Backfilled from qualification result sheet." : "Backfilled as not advanced from qualification result sheet.",
    });
  }

  const groups = [];
  const groupEntries = [];
  const groupStageResults = [];
  const groupKeys = new Set();
  const unmatchedGroupSchools = [];
  for (const entry of groupEntriesRaw) {
    const reg = regsByYearAndName.get(`${entry.year}|${norm(entry.school)}`);
    if (!reg) {
      unmatchedGroupSchools.push(`${entry.year}: ${entry.school}`);
      continue;
    }
    const groupKey = `${entry.year}|${entry.group}`;
    if (!groupKeys.has(groupKey)) {
      groups.push({
        year: entry.year,
        name: entry.group,
        sortOrder: groupSortOrder(entry.group),
        advanceCount: 2,
      });
      groupKeys.add(groupKey);
    }
    groupEntries.push({
      year: entry.year,
      groupName: entry.group,
      registrationExternalId: reg.externalId,
      schoolName: reg.school.name,
      seed: entry.seed,
      rank: entry.rank,
      score: entry.score,
      note: "Backfilled from Grand Finale group table.",
      advanceOverride: entry.rank != null ? entry.rank <= 2 : null,
    });
    groupStageResults.push({
      year: entry.year,
      externalId: reg.externalId,
      schoolName: reg.school.name,
      stage: GROUP_STAGE,
      outcome: entry.rank != null && entry.rank <= 2 ? "advanced" : "eliminated",
      score: entry.score,
      reason: null,
      note: `Backfilled from ${entry.group}; rank ${entry.rank ?? "unknown"}.`,
    });
  }

  const qualificationByExternalId = new Map(qualificationResults.map((result) => [result.externalId, result]));
  for (const entry of groupEntries) {
    const existing = qualificationByExternalId.get(entry.registrationExternalId);
    if (existing) {
      existing.outcome = "advanced";
      existing.note = existing.note || "Backfilled as advanced because the school appears in the Grand Finale group table.";
      continue;
    }
    const reg = registrations.find((r) => r.externalId === entry.registrationExternalId);
    if (!reg) continue;
    const result = {
      year: reg.year,
      externalId: reg.externalId,
      schoolName: reg.school.name,
      stage: QUALIFICATION_STAGE,
      outcome: "advanced",
      score: null,
      reason: "Manual Selection",
      note: "Backfilled as advanced because the school appears in the Grand Finale group table.",
    };
    qualificationResults.push(result);
    qualificationByExternalId.set(result.externalId, result);
  }
  const groupedIdsByYear = new Map();
  for (const entry of groupEntries) {
    const ids = groupedIdsByYear.get(entry.year) ?? new Set();
    ids.add(entry.registrationExternalId);
    groupedIdsByYear.set(entry.year, ids);
  }
  for (const result of qualificationResults) {
    const groupedIds = groupedIdsByYear.get(result.year);
    if (!groupedIds || groupedIds.has(result.externalId)) continue;
    if (result.outcome === "advanced") {
      result.outcome = "eliminated";
      result.reason = null;
      result.note = "Backfilled as not advanced because the complete Grand Finale group table is the qualification source for this year.";
    }
  }

  return { registrations, qualificationResults, groupStageResults, groups, groupEntries, duplicatesSkipped, unmatchedGroupSchools, missingSources };
}

function groupSortOrder(name) {
  const match = clean(name).match(/group\s+([a-z])/i);
  return match ? match[1].toUpperCase().charCodeAt(0) - 64 : 0;
}

async function applyPlan(supabase, plan) {
  const summary = {
    editionsUpserted: 0,
    schoolsCreated: 0,
    registrationsUpserted: 0,
    studentsInserted: 0,
    studentDuplicateRowsCollapsed: 0,
    studentRowsUpdated: 0,
    membershipsUpserted: 0,
    qualificationResultsUpserted: 0,
    groupStageResultsUpserted: 0,
    groupsUpserted: 0,
    groupEntriesUpserted: 0,
    errors: [],
  };

  const { data: existingSchools, error: schoolReadError } = await supabase
    .from("schools")
    .select("id, name, lga, category");
  if (schoolReadError) throw new Error(`schools read failed: ${schoolReadError.message}`);

  const editionRows = [...new Set(plan.registrations.map((r) => r.year))].map((year) => ({
    year,
    title: `Adewale Students Conference ${year}`,
    registration_open: false,
    stages: DEFAULT_STAGES,
    current_stage: "Completed",
  }));
  for (const batch of chunk(editionRows, 200)) {
    const { error } = await supabase.from("editions").upsert(batch, { onConflict: "year" });
    if (error) summary.errors.push(`edition upsert: ${error.message}`);
    else summary.editionsUpserted += batch.length;
  }

  const schoolsByKey = new Map((existingSchools ?? []).map((s) => [schoolKey(s.name, s.lga, s.category), s]));
  const schoolInserts = new Map();
  for (const reg of plan.registrations) {
    const key = schoolKey(reg.school.name, reg.school.lga, reg.school.category);
    if (!schoolsByKey.has(key) && !schoolInserts.has(key)) {
      schoolInserts.set(key, {
        name: reg.school.name,
        lga: reg.school.lga || null,
        category: reg.school.category || null,
        address: reg.school.address || null,
        email: reg.school.email || null,
      });
    }
  }

  if (schoolInserts.size) {
    const { data, error } = await supabase
      .from("schools")
      .insert([...schoolInserts.values()])
      .select("id, name, lga, category");
    if (error) summary.errors.push(`school insert: ${error.message}`);
    for (const school of data ?? []) {
      summary.schoolsCreated += 1;
      schoolsByKey.set(schoolKey(school.name, school.lga, school.category), school);
    }
  }

  const registrationsPayload = [];
  const memberships = [];
  for (const reg of plan.registrations) {
    const school = schoolsByKey.get(schoolKey(reg.school.name, reg.school.lga, reg.school.category));
    if (!school) {
      summary.errors.push(`school not found for ${reg.year} ${reg.school.name}`);
      continue;
    }
    const contactEmail = reg.teacher.email || reg.principal.email || reg.school.email || null;
    registrationsPayload.push({
      school_id: school.id,
      owner_id: null,
      edition_year: reg.year,
      status: "verified",
      current_stage: currentStageFor(reg.externalId, plan),
      qualification_zone: reg.qualificationZone || reg.school.lga || null,
      reps: reg.reps.map((r) => ({ name: r.name, level: r.level })),
      details: reg.details,
      contact_email: contactEmail,
      contact_name: reg.teacher.name || null,
      claim_code: claimCode(reg.externalId),
      verify_token: hash(`${reg.externalId}:verify`, 32),
      verify_token_expires_at: new Date("2099-01-01T00:00:00.000Z").toISOString(),
      airtable_id: reg.externalId,
      created_at: reg.submittedAt,
    });
    if (reg.teacher.email) memberships.push({ school_id: school.id, email: reg.teacher.email, full_name: reg.teacher.name || null, status: "approved" });
    if (reg.principal.email && reg.principal.email !== reg.teacher.email) {
      memberships.push({ school_id: school.id, email: reg.principal.email, full_name: reg.principal.name || null, status: "approved" });
    }
  }

  for (const batch of chunk(registrationsPayload, 200)) {
    const { error } = await supabase.from("registrations").upsert(batch, { onConflict: "airtable_id" });
    if (error) summary.errors.push(`registration upsert: ${error.message}`);
    else summary.registrationsUpserted += batch.length;
  }

  if (memberships.length) {
    const unique = [...new Map(memberships.map((m) => [`${m.school_id}|${m.email}`, m])).values()];
    for (const batch of chunk(unique, 200)) {
      const { error } = await supabase.from("school_members").upsert(batch, { onConflict: "school_id,email", ignoreDuplicates: true });
      if (error) summary.errors.push(`membership upsert: ${error.message}`);
      else summary.membershipsUpserted += batch.length;
    }
  }

  const dbRegs = [];
  for (const ids of chunk(plan.registrations.map((r) => r.externalId), 100)) {
    const { data, error: regReadError } = await supabase
      .from("registrations")
      .select("id, airtable_id, school_id, edition_year")
      .in("airtable_id", ids);
    if (regReadError) throw new Error(`registrations reload failed: ${regReadError.message}`);
    dbRegs.push(...(data ?? []));
  }
  const regsByExternalId = new Map((dbRegs ?? []).map((r) => [r.airtable_id, r]));

  await upsertHistoricalStudents(supabase, plan, regsByExternalId, summary);
  await upsertQualificationResults(supabase, plan, regsByExternalId, summary);
  await upsertGroupStageResults(supabase, plan, regsByExternalId, summary);
  await upsertGroups(supabase, plan, regsByExternalId, summary);

  return summary;
}

function currentStageFor(externalId, plan) {
  const groupResult = plan.groupStageResults.find((result) => result.externalId === externalId);
  if (groupResult?.outcome === "advanced") return FIRST_KNOCKOUT_STAGE;
  if (groupResult?.outcome === "eliminated") return GROUP_STAGE;
  const qualification = plan.qualificationResults.find((result) => result.externalId === externalId);
  if (qualification?.outcome === "advanced") return GROUP_STAGE;
  return QUALIFICATION_STAGE;
}

async function upsertHistoricalStudents(supabase, plan, regsByExternalId, summary) {
  const schoolIds = [...new Set([...regsByExternalId.values()].map((r) => r.school_id).filter(Boolean))];
  const existing = new Map();
  for (const ids of chunk(schoolIds, 150)) {
    const { data, error } = await supabase.from("students").select("id, school_id, name, level, edition_year").in("school_id", ids);
    if (error) {
      summary.errors.push(`students read: ${error.message}`);
      continue;
    }
    for (const student of data ?? []) existing.set(`${student.school_id}|${norm(student.name)}`, student);
  }

  const desiredStudents = new Map();
  let studentOccurrences = 0;
  for (const reg of plan.registrations) {
    const dbReg = regsByExternalId.get(reg.externalId);
    if (!dbReg?.school_id) continue;
    for (const rep of reg.reps) {
      studentOccurrences += 1;
      const key = `${dbReg.school_id}|${norm(rep.name)}`;
      const code = studentCode(`${reg.externalId}:${rep.n}:${rep.name}`);
      const row = {
        school_id: dbReg.school_id,
        name: rep.name,
        level: rep.level || null,
        edition_year: reg.year,
        access_code: code,
        auth_email: `historical.${code.toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`,
        auth_user_id: null,
      };
      const currentDesired = desiredStudents.get(key);
      if (!currentDesired || reg.year > currentDesired.edition_year) desiredStudents.set(key, row);
    }
  }
  summary.studentDuplicateRowsCollapsed = Math.max(0, studentOccurrences - desiredStudents.size);

  const inserts = [];
  const updates = [];
  for (const [key, row] of desiredStudents) {
    const current = existing.get(key);
    if (current) {
      if (current.edition_year !== row.edition_year || (current.level ?? "") !== (row.level ?? "")) {
        updates.push({ id: current.id, edition_year: row.edition_year, level: row.level || null });
      }
      continue;
    }
    inserts.push(row);
  }

  for (const batch of chunk(updates, 200)) {
    const { error } = await supabase.rpc("sync_retag_students", { p_rows: batch });
    if (error) summary.errors.push(`student update: ${error.message}`);
    else summary.studentRowsUpdated += batch.length;
  }
  for (const batch of chunk(inserts, 200)) {
    const { error } = await supabase.from("students").insert(batch);
    if (error) summary.errors.push(`student insert: ${error.message}`);
    else summary.studentsInserted += batch.length;
  }
}

async function upsertQualificationResults(supabase, plan, regsByExternalId, summary) {
  const rows = plan.qualificationResults
    .map((result) => {
      const reg = regsByExternalId.get(result.externalId);
      if (!reg) return null;
      return {
        registration_id: reg.id,
        stage: result.stage,
        outcome: result.outcome,
        score: result.score,
        reason: result.reason,
        note: result.note,
      };
    })
    .filter(Boolean);
  for (const batch of chunk(rows, 200)) {
    const { error } = await supabase.from("registration_stage_results").upsert(batch, { onConflict: "registration_id,stage" });
    if (error) summary.errors.push(`qualification result upsert: ${error.message}`);
    else summary.qualificationResultsUpserted += batch.length;
  }
}

async function upsertGroupStageResults(supabase, plan, regsByExternalId, summary) {
  const rows = plan.groupStageResults
    .map((result) => {
      const reg = regsByExternalId.get(result.externalId);
      if (!reg) return null;
      return {
        registration_id: reg.id,
        stage: result.stage,
        outcome: result.outcome,
        score: result.score,
        reason: result.reason,
        note: result.note,
      };
    })
    .filter(Boolean);
  for (const batch of chunk(rows, 200)) {
    const { error } = await supabase.from("registration_stage_results").upsert(batch, { onConflict: "registration_id,stage" });
    if (error) summary.errors.push(`group-stage result upsert: ${error.message}`);
    else summary.groupStageResultsUpserted += batch.length;
  }
}

async function upsertGroups(supabase, plan, regsByExternalId, summary) {
  if (!plan.groups.length) return;
  const groupRows = plan.groups.map((group) => ({
    edition_year: group.year,
    stage: GROUP_STAGE,
    name: group.name,
    sort_order: group.sortOrder,
    advance_count: group.advanceCount,
  }));
  for (const batch of chunk(groupRows, 200)) {
    const { error } = await supabase.from("tournament_groups").upsert(batch, { onConflict: "edition_year,stage,name" });
    if (error) summary.errors.push(`group upsert: ${error.message}`);
    else summary.groupsUpserted += batch.length;
  }

  const { data: dbGroups, error: groupReadError } = await supabase
    .from("tournament_groups")
    .select("id, edition_year, stage, name")
    .in("edition_year", [...new Set(plan.groups.map((g) => g.year))])
    .eq("stage", GROUP_STAGE);
  if (groupReadError) {
    summary.errors.push(`group reload: ${groupReadError.message}`);
    return;
  }
  const groupsByKey = new Map((dbGroups ?? []).map((g) => [`${g.edition_year}|${g.name}`, g]));
  const entryRows = plan.groupEntries
    .map((entry) => {
      const group = groupsByKey.get(`${entry.year}|${entry.groupName}`);
      const reg = regsByExternalId.get(entry.registrationExternalId);
      if (!group || !reg) return null;
      return {
        group_id: group.id,
        registration_id: reg.id,
        seed: entry.seed,
        rank: entry.rank,
        score: entry.score,
        note: entry.note,
        advance_override: entry.advanceOverride,
      };
    })
    .filter(Boolean);
  for (const batch of chunk(entryRows, 200)) {
    const { error } = await supabase.from("tournament_group_entries").upsert(batch, { onConflict: "registration_id" });
    if (error) summary.errors.push(`group entry upsert: ${error.message}`);
    else summary.groupEntriesUpserted += batch.length;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const loadedEnv = loadEnv(args.envFile);
  const plan = await buildPlan(args);

  console.log(args.apply ? "Mode: APPLY" : "Mode: DRY RUN");
  console.log(`Env file: ${loadedEnv ?? `${path.resolve(args.envFile)} (not found)`}`);
  console.log(`Source dir: ${path.resolve(args.sourceDir)}`);
  if (plan.missingSources.length) {
    console.warn("Missing registration CSV export(s):");
    for (const source of plan.missingSources) console.warn(`  - ${source}`);
  }
  console.log(`Duplicate registration rows skipped: ${plan.duplicatesSkipped}`);
  for (const [move, count] of summarizeMovedRows(plan.registrations)) {
    console.log(`Cross-year registration rows moved by timestamp ${move}: ${count}`);
  }
  for (const [year, row] of summarizePlanned(plan)) {
    console.log(
      `${year}: ${row.registrations} registrations, ${row.reps} reps, ${row.qualificationResults} qualification results (${row.qualificationAdvanced} advanced, ${row.qualificationEliminated} not advanced), ${row.groupStageResults} group-stage results (${row.groupStageAdvanced} advanced, ${row.groupStageEliminated} not advanced), ${row.groups} groups, ${row.groupEntries} group entries`,
    );
  }
  if (plan.unmatchedGroupSchools.length) {
    console.warn(`Unmatched group schools: ${plan.unmatchedGroupSchools.length}`);
    for (const item of plan.unmatchedGroupSchools.slice(0, 20)) console.warn(`  - ${item}`);
    if (plan.unmatchedGroupSchools.length > 20) console.warn("  ...");
  }

  const supabase = initSupabase(args.apply);
  if (!args.apply) {
    console.log("No database writes performed. Re-run with --apply to backfill Supabase.");
    return;
  }
  if (plan.missingSources.length) {
    throw new Error("Refusing --apply while required registration CSV exports are missing.");
  }

  const summary = await applyPlan(supabase, plan);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

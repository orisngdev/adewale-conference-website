// Shared plumbing for the canonical data scripts. Those scripts (merge-schools,
// reconcile-registrations, import-zonal-results and the rest) were one-time imports and
// have been deleted; this file survives them because check-normalizers.mjs executes its
// normalizeSchoolName as one of the three copies it holds to each other.
//
// normalizeSchoolName is character-for-character equal to public.school_norm_name in
// 20260822090000_canonical_school_identity.sql and to normalizeSchoolName in
// src/lib/school-identity.ts. Five divergent copies of this function are what fragmented the
// schools table in the first place — do not fork a sixth.

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SOURCE_DIR = "data/canonical";
export const DEFAULT_REPORT_DIR = "data/canonical/reports";
export const DEFAULT_ENV_FILE = ".env";
export const PROD_ENV_FILE = ".env.prod";

// ── text ─────────────────────────────────────────────────────────────────────

export function clean(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").trim();
}

/** Canonical school-name normalizer. Mirrors public.school_norm_name exactly. */
export function normalizeSchoolName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Natural key for a school when no school_code is available yet. */
export function schoolKey(name, lga, category) {
  return [normalizeSchoolName(name), normalizeSchoolName(lga), normalizeSchoolName(category)].join("|");
}

// ── CSV ──────────────────────────────────────────────────────────────────────

export function parseCsv(text) {
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

export async function readCsv(sourceDir, fileName, required = true) {
  const filePath = path.resolve(sourceDir, fileName);
  try {
    await access(filePath);
  } catch {
    if (required) throw new Error(`Missing canonical CSV: ${filePath}`);
    return [];
  }
  return parseCsv(await readFile(filePath, "utf8"));
}

/**
 * Header-keyed rows. Duplicate headers get a __2, __3 suffix; every row carries
 * __row (the 1-based line number in the CSV) so a finding can be traced back.
 */
export function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => clean(h));
  return rows.slice(1).map((values, i) => {
    const row = { __row: i + 2 };
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

export async function readTable(sourceDir, fileName, required = true) {
  return rowsToObjects(await readCsv(sourceDir, fileName, required));
}

// ── reports ──────────────────────────────────────────────────────────────────

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  // Guard the leading characters spreadsheet software treats as a formula.
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** Write a report CSV and return its path. Columns come from the first row's keys. */
export async function writeReport(reportDir, fileName, rows) {
  await mkdir(reportDir, { recursive: true });
  const filePath = path.resolve(reportDir, fileName);
  if (!rows.length) {
    await writeFile(filePath, "", "utf8");
    return filePath;
  }
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvCell(row[h])).join(","));
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}

/** Write a generated SQL file and return its path. */
export async function writeSql(reportDir, fileName, sql) {
  await mkdir(reportDir, { recursive: true });
  const filePath = path.resolve(reportDir, fileName);
  await writeFile(filePath, sql.endsWith("\n") ? sql : `${sql}\n`, "utf8");
  return filePath;
}

// ── args + env ───────────────────────────────────────────────────────────────

/**
 * Flags shared by every canonical script. Dry-run is the default everywhere:
 * nothing writes without --apply.
 */
export function parseBaseArgs(argv, extra = {}) {
  const args = {
    apply: false,
    sourceDir: DEFAULT_SOURCE_DIR,
    reportDir: DEFAULT_REPORT_DIR,
    envFile: DEFAULT_ENV_FILE,
    ...extra,
  };
  const rest = [];
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--prod") args.envFile = PROD_ENV_FILE;
    else if (arg === "--env-file") args.envFile = argv[++i] ?? args.envFile;
    else if (arg.startsWith("--env-file=")) args.envFile = arg.slice("--env-file=".length);
    else if (arg === "--source-dir") args.sourceDir = argv[++i] ?? args.sourceDir;
    else if (arg.startsWith("--source-dir=")) args.sourceDir = arg.slice("--source-dir=".length);
    else if (arg === "--report-dir") args.reportDir = argv[++i] ?? args.reportDir;
    else if (arg.startsWith("--report-dir=")) args.reportDir = arg.slice("--report-dir=".length);
    else rest.push(arg);
  }
  args._rest = rest;
  return args;
}

export function loadEnv(envFile) {
  const resolved = path.resolve(envFile);
  try {
    process.loadEnvFile(resolved);
    return resolved;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`Failed to load env file ${resolved}: ${error.message}`);
  }
}

export function requireCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.");
  }
  return { url, key };
}

// ── misc ─────────────────────────────────────────────────────────────────────

export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function counter() {
  const map = new Map();
  return {
    add(key, n = 1) {
      map.set(key, (map.get(key) ?? 0) + n);
    },
    get(key) {
      return map.get(key) ?? 0;
    },
    entries() {
      return [...map.entries()].sort((a, b) => b[1] - a[1]);
    },
  };
}

// ── PostgREST ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000;

export function createRestClient(baseUrl, key) {
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

    /** Every row in a table, paged past PostgREST's row cap. Throws on error. */
    async selectAll(table, select, { order, filters } = {}) {
      const out = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const query = new URLSearchParams();
        query.set("select", select);
        if (order) query.set("order", order);
        for (const [column, value] of Object.entries(filters ?? {})) query.set(column, value);
        query.set("limit", String(PAGE_SIZE));
        query.set("offset", String(offset));
        const { data, error } = await request(table, { query });
        if (error) throw new Error(`Read ${table} failed: ${error.message}`);
        const page = data ?? [];
        out.push(...page);
        if (page.length < PAGE_SIZE) return out;
      }
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
    this.filtered = false;
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

  update(patch) {
    this.method = "PATCH";
    this.body = patch;
    this.prefer = "return=minimal";
    return this;
  }

  delete() {
    this.method = "DELETE";
    this.prefer = "return=minimal";
    return this;
  }

  eq(column, value) {
    this.filtered = true;
    this.query.set(column, `eq.${value}`);
    return this;
  }

  neq(column, value) {
    this.filtered = true;
    this.query.set(column, `neq.${value}`);
    return this;
  }

  is(column, value) {
    this.filtered = true;
    this.query.set(column, `is.${value}`);
    return this;
  }

  in(column, values) {
    this.filtered = true;
    this.query.set(column, `in.(${values.map(formatInValue).join(",")})`);
    return this;
  }

  order(column) {
    this.query.set("order", column);
    return this;
  }

  limit(n) {
    this.query.set("limit", String(n));
    return this;
  }

  then(resolve, reject) {
    // An unfiltered PATCH or DELETE would hit every row in the table. Never allow it.
    if ((this.method === "PATCH" || this.method === "DELETE") && !this.filtered) {
      return Promise.reject(
        new Error(`Refusing unfiltered ${this.method} on ${this.table}`),
      ).then(resolve, reject);
    }
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

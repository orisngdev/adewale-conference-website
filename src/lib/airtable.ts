const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

type AirtableRecordFields = Record<string, string>;

export interface AirtableRecord<TFields extends object> {
  id: string;
  createdTime: string;
  fields: TFields;
}

export interface SchoolRecordFields {
  "School Name"?: string;
  "School Category"?: string;
  "School Local Government Area"?: string;
  "School Address"?: string;
  "School Email"?: string;
}

function getRequiredEnvValue(serverKey: string, publicKey: string, label: string) {
  const value = process.env[serverKey] ?? process.env[publicKey];

  if (!value) {
    throw new Error(`${label} is not configured.`);
  }

  return value;
}

function getAirtableApiToken() {
  return getRequiredEnvValue(
    "AIRTABLE_API_TOKEN",
    "NEXT_PUBLIC_AIRTABLE_API_TOKEN",
    "Airtable API token",
  );
}

// True only when a real Airtable PAT is present (not the .env placeholder).
export function isAirtableConfigured() {
  const token =
    process.env.AIRTABLE_API_TOKEN ?? process.env.NEXT_PUBLIC_AIRTABLE_API_TOKEN;
  return Boolean(token && token.startsWith("pat"));
}

// Whether to write records to Airtable. Enabled by default; set
// AIRTABLE_WRITES_ENABLED=false to skip Airtable (e.g. while testing the portal
// mirror) without polluting the real base.
export function isAirtableWritesEnabled() {
  return process.env.AIRTABLE_WRITES_ENABLED !== "false";
}

function getAirtableBaseId() {
  return getRequiredEnvValue(
    "AIRTABLE_BASE_ID",
    "NEXT_PUBLIC_AIRTABLE_BASE_ID",
    "Airtable base ID",
  );
}

async function parseAirtableError(response: Response) {
  try {
    const payload = (await response.json()) as {
      error?: { message?: string; type?: string };
    };

    if (payload.error?.type && payload.error.message) {
      return `${payload.error.type}: ${payload.error.message}`;
    }

    if (payload.error?.message) {
      return payload.error.message;
    }
  } catch {
    return response.statusText || "Unknown Airtable error";
  }

  return response.statusText || "Unknown Airtable error";
}

export function getParticipantsTableId() {
  return getRequiredEnvValue(
    "AIRTABLE_PARTICIPANTS_TABLE_ID",
    "NEXT_PUBLIC_AIRTABLE_PARTICIPANTS_TABLE_ID",
    "Airtable participants table ID",
  );
}

export function getSponsorshipTableId() {
  return getRequiredEnvValue(
    "AIRTABLE_SPONSORSHIP_TABLE_ID",
    "NEXT_PUBLIC_AIRTABLE_SPONSORSHIP_TABLE_ID",
    "Airtable sponsorship table ID",
  );
}

export function getSchoolDatabaseTableId() {
  return getRequiredEnvValue(
    "AIRTABLE_SCHOOLS_TABLE_ID",
    "NEXT_PUBLIC_AIRTABLE_SCHOOLS_TABLE_ID",
    "Airtable schools table ID",
  );
}

function buildAirtableUrl(tableId: string, params?: URLSearchParams) {
  const baseId = getAirtableBaseId();
  const url = new URL(`${AIRTABLE_API_BASE}/${baseId}/${tableId}`);

  if (params) {
    url.search = params.toString();
  }

  return url;
}

async function airtableFetch(url: URL, init?: RequestInit) {
  const apiToken = getAirtableApiToken();

  // Reads are cached for 60s (Airtable is a slow external hop, and the admin
  // views tolerate a minute of staleness); writes are never cached.
  const isRead = !init?.method || init.method.toUpperCase() === "GET";
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...(isRead ? { next: { revalidate: 60 } } : { cache: "no-store" as const }),
  });

  if (!response.ok) {
    throw new Error(await parseAirtableError(response));
  }

  return response;
}

export async function createAirtableRecord(
  tableId: string,
  fields: AirtableRecordFields,
) {
  const response = await airtableFetch(buildAirtableUrl(tableId), {
    method: "POST",
    body: JSON.stringify({
      records: [{ fields }],
      typecast: false,
    }),
  });

  return response.json();
}

// Patch a single record's fields (leaves other fields untouched). Used to write
// a student swap back to the participant row so the one-way sync doesn't revert
// it. No-op when Airtable writes are disabled.
export async function updateAirtableRecord(
  tableId: string,
  recordId: string,
  fields: AirtableRecordFields,
) {
  if (!isAirtableWritesEnabled()) return null;
  const response = await airtableFetch(
    buildAirtableUrl(`${tableId}/${recordId}`),
    {
      method: "PATCH",
      body: JSON.stringify({ fields, typecast: false }),
    },
  );
  return response.json();
}

export async function listAirtableRecords<TFields extends object>(
  tableId: string,
  params?: URLSearchParams,
) {
  const records: AirtableRecord<TFields>[] = [];
  let offset: string | null = null;

  do {
    const requestParams = new URLSearchParams(params?.toString() ?? "");
    if (offset) {
      requestParams.set("offset", offset);
    }

    const response = await airtableFetch(
      buildAirtableUrl(tableId, requestParams),
    );
    const payload = (await response.json()) as {
      offset?: string;
      records?: AirtableRecord<TFields>[];
    };

    records.push(...(payload.records ?? []));
    offset = payload.offset ?? null;
  } while (offset);

  return records;
}

function normalizeSchoolValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeFormulaValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function findSchoolByNameCategoryLga(
  tableId: string,
  schoolName: string,
  schoolCategory: string,
  schoolLga: string,
) {
  const params = new URLSearchParams();
  params.append("fields[]", "School Name");
  params.append("fields[]", "School Category");
  params.append("fields[]", "School Local Government Area");
  params.set(
    "filterByFormula",
    `AND({School Category}="${escapeFormulaValue(schoolCategory)}",{School Local Government Area}="${escapeFormulaValue(schoolLga)}")`,
  );

  const records = await listAirtableRecords<SchoolRecordFields>(
    tableId,
    params,
  );
  const normalizedName = normalizeSchoolValue(schoolName);

  return (
    records.find((record) => {
      const existingName = record.fields["School Name"];
      if (typeof existingName !== "string") {
        return false;
      }

      return normalizeSchoolValue(existingName) === normalizedName;
    }) ?? null
  );
}

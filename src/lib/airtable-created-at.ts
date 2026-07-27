import type { AirtableRecord } from "./airtable";

const CREATED_AT_FIELD_NAMES = [
  "Created time",
  "created_at",
  "Created At",
  "Created Time",
  "Submitted At",
  "Submission Time",
];

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function airtableCreatedAt<TFields extends Record<string, unknown>>(
  record: AirtableRecord<TFields>,
): string {
  for (const fieldName of CREATED_AT_FIELD_NAMES) {
    const fromField = isoOrNull(record.fields[fieldName]);
    if (fromField) return fromField;
  }

  return isoOrNull(record.createdTime) ?? new Date(0).toISOString();
}

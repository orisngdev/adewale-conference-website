import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * School identity. One normalizer, shared by every path that looks a school up or
 * creates one.
 *
 * `public.schools` used to have no unique key on any natural column, and five code
 * paths each find-or-created with a different normalizer — or, in the registration
 * RPC, none at all. 741 rows described 534 real schools. Migration
 * 20260822090100 added `unique (school_norm_name(name))`, so the database now
 * enforces one specific normalization and every caller has to agree with it
 * character for character. A caller using its own variant would look up "R&D
 * College" as "r d college", miss the existing "r and d college", and then fail the
 * insert against the index instead of matching.
 *
 * Keep in lockstep with:
 *   - `public.school_norm_name`      (supabase/migrations/20260822090000_…sql)
 *   - `normalizeSchoolName`          (scripts/canonical/lib.mjs)
 *
 * This is deliberately NOT `normalizeSearchText` from ./search — that one tokenizes
 * free text for `ilike` filtering and has no "&" rule, so it is a different job.
 */
export function normalizeSchoolName(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Natural key for a school that has no canonical `school_code` yet. */
export function schoolKey(
  name?: string | null,
  lga?: string | null,
  category?: string | null,
) {
  return [
    normalizeSchoolName(name),
    normalizeSchoolName(lga),
    normalizeSchoolName(category),
  ].join("|");
}

export type SchoolIdentity = {
  name: string;
  lga?: string | null;
  category?: string | null;
  address?: string | null;
  email?: string | null;
  airtableId?: string | null;
};

export type ResolvedSchool = {
  id: string;
  name: string;
  created: boolean;
};

/**
 * Find a school by normalized name, creating it only if it genuinely does not
 * exist. Returns null only when the lookup and the insert both fail.
 *
 * Matching is on the name alone, not name+lga+category, because the duplicate rows
 * this replaced disagreed about LGA as often as they agreed: CENTURY TOWER MODEL
 * COLLEGE existed three times under three different LGAs. Including LGA in the key
 * is what let those through.
 */
export async function resolveSchool(
  db: SupabaseClient,
  input: SchoolIdentity,
): Promise<ResolvedSchool | null> {
  const normalized = normalizeSchoolName(input.name);
  if (!normalized) return null;

  const existing = await findSchoolByName(db, input.name);
  if (existing) {
    // Backfill only what is missing; never overwrite curated canonical values.
    const patch: Record<string, string> = {};
    if (input.airtableId) patch.airtable_id = input.airtableId;
    if (Object.keys(patch).length) {
      await db.from("schools").update(patch).eq("id", existing.id).is("airtable_id", null);
    }
    return { id: existing.id, name: existing.name, created: false };
  }

  const { data: created, error } = await db
    .from("schools")
    .insert({
      name: input.name.trim(),
      lga: input.lga ?? null,
      category: input.category ?? null,
      address: input.address ?? null,
      email: input.email ?? null,
      airtable_id: input.airtableId ?? null,
    })
    .select("id, name")
    .single();

  if (created) return { id: created.id, name: created.name, created: true };

  // 23505 = unique violation. Either schools_norm_name_key (a concurrent insert, or
  // a spelling this normalizer folds onto an existing row) or airtable_id. Re-read
  // rather than surfacing an error: the row we wanted now exists.
  if (error?.code === "23505") {
    const raced = await findSchoolByName(db, input.name);
    if (raced) return { id: raced.id, name: raced.name, created: false };
  }
  return null;
}

/** Look a school up by normalized name, matching the DB's own normalization. */
export async function findSchoolByName(db: SupabaseClient, name: string) {
  const normalized = normalizeSchoolName(name);
  if (!normalized) return null;

  // Narrow with a cheap token filter, then compare normalized names exactly, so the
  // comparison is the same one the unique index performs.
  const token = normalized.split(" ")[0];
  const { data } = await db
    .from("schools")
    .select("id, name")
    .ilike("name", `%${token}%`)
    .limit(200);

  return (data ?? []).find((s) => normalizeSchoolName(s.name) === normalized) ?? null;
}

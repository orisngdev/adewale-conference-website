import type { createClient } from "@/supabase/server";
import type { RegistrationStatus } from "@/supabase/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface RegistrationStats {
  total: number;
  submitted: number;
  verified: number;
  declined: number;
  review: number;
  accepted: number;
}

export const EMPTY_REGISTRATION_STATS: RegistrationStats = {
  total: 0,
  submitted: 0,
  verified: 0,
  declined: 0,
  review: 0,
  accepted: 0,
};

const STATUSES: RegistrationStatus[] = ["submitted", "verified", "declined"];

async function countRegistrations(
  supabase: SupabaseClient,
  opts: { editionYear?: number | null; status?: RegistrationStatus } = {},
) {
  let query = supabase.from("registrations").select("id", { count: "exact", head: true });
  if (opts.editionYear != null) query = query.eq("edition_year", opts.editionYear);
  if (opts.status) query = query.eq("status", opts.status);

  const { count, error } = await query;
  if (error) {
    console.error("registration count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getRegistrationStats(
  supabase: SupabaseClient,
  editionYear?: number | null,
): Promise<RegistrationStats> {
  const [total, submitted, verified, declined] = await Promise.all([
    countRegistrations(supabase, { editionYear }),
    ...STATUSES.map((status) => countRegistrations(supabase, { editionYear, status })),
  ]);

  return {
    total,
    submitted,
    verified,
    declined,
    review: submitted,
    accepted: verified,
  };
}

export async function getRegistrationStatsByEdition(
  supabase: SupabaseClient,
  years: number[],
) {
  const entries = await Promise.all(
    years.map(async (year) => [year, await getRegistrationStats(supabase, year)] as const),
  );
  return new Map(entries);
}

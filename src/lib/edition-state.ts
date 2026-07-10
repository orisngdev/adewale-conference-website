import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/supabase/env";

// Whether any edition is currently open for registration — the single switch
// admin flips in Portal → Editions. Read with a plain anon client (editions_read
// RLS is public), no cookies, so callers can be statically cached / ISR'd.
// Fail-open when the portal bridge isn't configured (Airtable-only mode) or the
// lookup errors: a downed DB should never hide the registration form, because
// the API route re-checks authoritatively at submit time anyway.
export async function getRegistrationOpen(): Promise<{ open: boolean; year: number | null }> {
  if (!isSupabaseConfigured) return { open: true, year: null };
  try {
    const supabase = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("editions")
      .select("year")
      .eq("registration_open", true)
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { open: true, year: null };
    return data ? { open: true, year: data.year as number } : { open: false, year: null };
  } catch {
    return { open: true, year: null };
  }
}

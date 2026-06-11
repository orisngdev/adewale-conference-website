import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// Service-role client for trusted server-side writes (bypasses RLS). Use ONLY in
// server code (route handlers, server actions) — never expose the secret key to
// the browser. Returns null until SUPABASE_SECRET_KEY is set, so callers can
// skip the mirror gracefully when the bridge isn't configured.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
